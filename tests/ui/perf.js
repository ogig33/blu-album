// Performance measurement of BluAlbum with a large generated library (big-library.js) in the mock player.
// Not a test: no pass / fail, it prints the times and the memory of the main views per library size, for a
// comparison before and after a change. Results also in test-results/perf/<date>-<browser>.json.
// Usage: node perf.js [path/to/blualbum.html] [--albums 2000,10000,30000] [--browser chrome|safari]
//                     [--latency <base ms>,<ms per KB>] [--cover <KB>] [--scale <n>] [--scroll-max <s>]
//                     [--cover-queue <places>,<base ms>,<ms per px>] [--no-scroll]
//        node perf.js --calibrate <player IP>
//        node perf.js --covers <player IP>
// --albums: library sizes, one run each (default 2000,10000,30000). --browser: Chrome (default; with long tasks,
// JS heap and process memory) or Safari (WebKit build: times only). --latency: answer time of the mock player per
// request (default 10,0.5: 10 ms + 0.5 ms per KB, calibrated at the owner's player on 2026-11-28 with single
// requests; the player may answer slower under 3 parallel requests). --cover: size of the cover image of every
// album at 600 px (default 170 KB, the measured average of the grid covers with "Optimize Artwork" off; smaller
// for a request with width). --scale: device pixel ratio (default 1, 2 = Retina). --scroll-max:
// scrolling to the end of All stops after this many seconds (default 180; the row then shows the tiles reached).
// --no-scroll: without scrolling. --cover-queue <places>,<base ms>,<ms per px>: the player works on covers in a queue
// (perf.js --covers at the owner's player, 2026-11-28: about 2 at the same time, each about 130 ms + 0.29 ms per px
// of the asked width, 600 px without width; the time includes the transfer); default 2,130,0.29, 0 = no queue
// (covers then answer with --latency).
// --calibrate: reads 4 lists from the real player (read-only, each 3 times) and prints the answer times with the
// --latency values that fit them; then the times and sizes of 10 covers without a size and at 600 / 400 / 300 / 200 px.
// --covers: loads covers of the real player with 1 to 10 requests at the same time (read-only, see coverLoad()).
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium, webkit } = require("playwright");
const { createPlayer, fx } = require("./mock-player");
const { createLibrary } = require("./big-library");

const arg = (name, def) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : def);
const APP = pathToFileURL(
  path.resolve(
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : path.join(__dirname, "..", "..", "blualbum.html"),
  ),
).href;
const SIZES = arg("--albums", "2000,10000,30000").split(",").map(Number);
const BROWSER = arg("--browser", "chrome");
const [BASE_MS, PER_KB] = arg("--latency", "10,0.5").split(",").map(Number);
const COVER_KB = +arg("--cover", "170");
const SCROLL_MAX = +arg("--scroll-max", "180");
const SCROLL = !process.argv.includes("--no-scroll");
const SCALE = +arg("--scale", "1");
const [Q_WORKERS, Q_BASE, Q_PX] = arg("--cover-queue", "2,130,0.29").split(",").map(Number);
const IP = "192.0.2.50"; // mock player (documentation range, never a real device)
const RESULTS = path.join(__dirname, "test-results", "perf");
if (
  SIZES.some((n) => !(n > 0)) ||
  !(BASE_MS >= 0) ||
  !(PER_KB >= 0) ||
  !["chrome", "safari"].includes(BROWSER) ||
  !(SCALE > 0) ||
  !(Q_WORKERS >= 0)
) {
  console.error("Invalid options, see the usage at the top of perf.js");
  process.exit(2);
}

// ---------- calibration against the real player ----------
async function calibrate(ip) {
  const base = `http://${ip}:11000`;
  const lists = [
    "/Browse?key=LocalMusic%3A",
    "/Browse?withContextMenuItems=1&key=" +
      encodeURIComponent("LocalMusic:S:Album/%2Flibrary%2Fv1%2FAlbums%3Fservice=LocalMusic&limit=50&section=A"),
    "/library/v1/Albums?service=LocalMusic&section=all&length=1&sort=decade",
    "/library/v1/Albums?service=LocalMusic&section=all",
  ];
  // per list the median of 3 (the first request after a pause can be much slower)
  const points = [];
  for (const p of lists) {
    const got = [];
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      const body = await (await fetch(base + p, { headers: { "Accept-Language": "en" } })).text();
      const ms = performance.now() - t,
        kb = Buffer.byteLength(body) / 1000;
      got.push([kb, ms]);
      console.log(`${ms.toFixed(0).padStart(6)} ms ${kb.toFixed(1).padStart(8)} KB  ${p.slice(0, 90)}`);
    }
    points.push(got.sort((x, y) => x[1] - y[1])[1]);
  }
  // Least squares: ms = a + b * KB
  const n = points.length,
    sx = points.reduce((s, p) => s + p[0], 0),
    sy = points.reduce((s, p) => s + p[1], 0);
  const sxx = points.reduce((s, p) => s + p[0] * p[0], 0),
    sxy = points.reduce((s, p) => s + p[0] * p[1], 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx),
    a = (sy - b * sx) / n;
  console.log(`\nFits --latency ${Math.max(0, a).toFixed(0)},${Math.max(0, b).toFixed(2)}`);
  // Covers: the first 10 albums of section A, as the grid asks today (no size) and in tile sizes (width = height)
  const secA = await (await fetch(base + lists[1], { headers: { "Accept-Language": "en" } })).text();
  const imgs = [...secA.matchAll(/ image="(\/Artwork\?[^"]*)"/g)].slice(0, 10).map((m) => m[1].replace(/&amp;/g, "&"));
  console.log(`\nCovers (${imgs.length} albums of section A, total of all):`);
  for (const size of [0, 600, 400, 300, 200]) {
    let ms = 0,
      kb = 0;
    for (const u of imgs) {
      const t = performance.now();
      const r = await fetch(base + u + (size ? `&width=${size}&height=${size}` : "") + "&followRedirects=1");
      kb += (await r.arrayBuffer()).byteLength / 1000;
      ms += performance.now() - t;
    }
    console.log(`${ms.toFixed(0).padStart(6)} ms ${kb.toFixed(0).padStart(8)} KB  ${size ? size + " px" : "no size"}`);
  }
}

// ---------- covers in parallel at the real player ----------
// Loads covers of the library with 1, 2, 3, 6 and 10 requests at the same time (the browser loads up to 6 per host),
// each time 24 other covers (no cover twice: a cache of the player would not count), without a size and at 400 / 200
// px; at the end the first 24 once more (a cache of the player would show there). Read-only.
async function coverLoad(ip) {
  const base = `http://${ip}:11000`;
  const get = async (p) => (await fetch(base + p, { headers: { "Accept-Language": "en" } })).text();
  const key = (k) => "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(k);
  const attrs = (x, a) => [...x.matchAll(new RegExp(` ${a}="([^"]*)"`, "g"))].map((m) => m[1].replace(/&amp;/g, "&"));
  const secs = attrs(
    await get(key("LocalMusic:bySection:Album/%2Flibrary%2Fv1%2FAlbums%3Fservice=LocalMusic")),
    "browseKey",
  );
  const SIZES = [0, 400, 200],
    PAR = [1, 2, 3, 6, 10],
    N = 24;
  const imgs = [];
  for (const k of secs) {
    if (imgs.length >= SIZES.length * PAR.length * N) break;
    imgs.push(...attrs(await get(key(k)), "image").filter((u) => u.startsWith("/Artwork?")));
  }
  const run = async (list, size, par) => {
    const times = [];
    let kb = 0,
      next = 0;
    const t0 = performance.now();
    await Promise.all(
      Array.from({ length: par }, async () => {
        while (next < list.length) {
          const u = list[next++],
            t = performance.now();
          const r = await fetch(base + u + (size ? `&width=${size}&height=${size}` : "") + "&followRedirects=1");
          kb += (await r.arrayBuffer()).byteLength / 1000;
          times.push(performance.now() - t);
        }
      }),
    );
    const all = performance.now() - t0,
      avg = times.reduce((s, x) => s + x, 0) / times.length;
    console.log(
      `${(size ? size + " px" : "no size").padEnd(8)} ${String(par).padStart(3)} ${all.toFixed(0).padStart(7)} ms ` +
        `${((list.length / all) * 1000).toFixed(1).padStart(6)} /s ${avg.toFixed(0).padStart(6)} ms ` +
        `${Math.max(...times)
          .toFixed(0)
          .padStart(6)} ms ${(kb / list.length).toFixed(0).padStart(5)} KB`,
    );
  };
  console.log(`${imgs.length} covers found; ${N} per row\n`);
  console.log("size     par   total     covers   avg/cover  max   KB/cover");
  let at = 0;
  for (const size of SIZES)
    for (const par of PAR) {
      const list = imgs.slice(at, at + N);
      at += N;
      if (list.length < N) return console.log("Not enough covers in the library for every row");
      await run(list, size, par);
    }
  console.log("\nThe first 24 once more (cache of the player?):");
  await run(imgs.slice(0, N), 0, 1);
}

// ---------- measurement ----------
const launch = () => (BROWSER === "safari" ? webkit.launch() : chromium.launch({ channel: "chrome" }));
const MB = (b) => (b / 1e6).toFixed(1);

// Cover images: a noisy picture as JPEG of about COVER_KB at 600 px (the most the grid gets, see imgUrl()), and the
// same picture at every width from 50 to 550 px in steps of 50 with the same JPEG quality (the player scales the
// stored cover down to the asked width, API test E31); drawn by the browser, no image library needed.
// Returns Map width -> Buffer.
async function makeCovers(browser) {
  const page = await browser.newPage();
  const b64 = await page.evaluate((kb) => {
    const c = document.createElement("canvas");
    c.width = c.height = 600;
    const x = c.getContext("2d"),
      img = x.createImageData(600, 600);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4,
        v = ((p % 600) + Math.floor(p / 600)) / 6;
      img.data[i] = v + Math.random() * 90;
      img.data[i + 1] = 120 + Math.random() * 90;
      img.data[i + 2] = 255 - v + Math.random() * 90;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    let q = 0.95,
      url = c.toDataURL("image/jpeg", q);
    while (url.length * 0.75 > kb * 1000 && q > 0.2) url = c.toDataURL("image/jpeg", (q -= 0.05));
    const out = { 600: url };
    for (let w = 50; w < 600; w += 50) {
      const s = document.createElement("canvas");
      s.width = s.height = w;
      s.getContext("2d").drawImage(c, 0, 0, w, w);
      out[w] = s.toDataURL("image/jpeg", q);
    }
    return Object.fromEntries(Object.entries(out).map(([w, u]) => [w, u.split(",")[1]]));
  }, COVER_KB);
  await page.close();
  return new Map(Object.entries(b64).map(([w, b]) => [+w, Buffer.from(b, "base64")]));
}
// Cover of a /Artwork request: the asked width rounded up to 50 px, at most 600 px; without width 600 px
const coverFor = (covers, q) => {
  const w = +q.get("width") || 600;
  return { type: "image/jpeg", body: covers.get(Math.min(600, Math.ceil(w / 50) * 50)) };
};

// Process memory (resident) of the browser's renderer and GPU processes (Chrome only), bytes
async function processMemory(browser) {
  try {
    const cdp = await browser.newBrowserCDPSession();
    const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
    await cdp.detach();
    const pids = processInfo.filter((p) => p.type !== "browser").map((p) => p.id);
    const rss = execSync(`ps -o rss= -p ${pids.join(",")}`, { encoding: "utf8" })
      .split("\n")
      .reduce((s, l) => s + (+l.trim() || 0), 0);
    return rss * 1024;
  } catch {
    return null;
  }
}

async function measure(browser, n, covers) {
  const genres = [...fx("04").matchAll(/ text="([^"]*)" type="genre"/g)].map((m) => m[1]);
  const lib = createLibrary(n, { genres });
  const player = createPlayer({
    usb: false,
    big: lib,
    artwork: (q) => coverFor(covers, q),
    latency: (url, bytes) => BASE_MS + (PER_KB * bytes) / 1000,
    queue: Q_WORKERS
      ? {
          match: /^\/Artwork$/,
          workers: Q_WORKERS,
          ms: (url) => Q_BASE + Q_PX * (Math.min(600, +new URL(url).searchParams.get("width")) || 600),
        }
      : null,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(`http://${IP}:11000/**`, player.route);
  await page.route("https://api.github.com/**", (r) => r.abort());
  await page.addInitScript(() => {
    Object.entries({ genrechips: "1", qchips: "1", decadechips: "1", "searchin:artist": "1", sort: "title" }).forEach(
      ([k, v]) => localStorage.setItem(k, v),
    );
    // Long tasks (Chrome): main thread blocked for more than 50 ms
    window.__lt = [];
    try {
      new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => e.duration))).observe({
        type: "longtask",
      });
    } catch {
      window.__lt = null;
    }
  });
  const cdp = BROWSER === "chrome" ? await ctx.newCDPSession(page) : null;
  if (cdp) await cdp.send("Performance.enable");
  await page.goto(APP);

  const rows = [];
  const until = (f, arg) => page.waitForFunction(f, arg, { timeout: 600000, polling: "raf" });
  const idle = () => until(() => !/Loading|Searching|Connecting/.test(document.querySelector("#msg").textContent));
  const step = async (name, run) => {
    const lt0 = await page.evaluate(() => window.__lt && window.__lt.length);
    const r0 = player.state.requests.length,
      b0 = player.state.bytes.length;
    const t = performance.now();
    await run();
    const ms = performance.now() - t;
    const lt = await page.evaluate((i) => window.__lt && window.__lt.slice(i), lt0);
    const reqs = player.state.requests.slice(r0).filter((x) => !/^\/Status/.test(x));
    const m = cdp
      ? Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]))
      : {};
    const row = {
      step: name,
      ms: Math.round(ms),
      requests: reqs.filter((x) => !/^\/Artwork/.test(x)).length,
      covers: reqs.filter((x) => /^\/Artwork/.test(x)).length,
      // XML answers only (the step waits for them; cover answers may still arrive after it)
      dataMB: +MB(
        player.state.bytes
          .slice(b0)
          .filter((x) => !/^\/(Artwork|Status)/.test(x.path))
          .reduce((s, x) => s + x.size, 0),
      ),
      coverMB: +MB(
        player.state.bytes
          .slice(b0)
          .filter((x) => x.path === "/Artwork")
          .reduce((s, x) => s + x.size, 0),
      ),
      longTasks: lt ? lt.length : null,
      longestTask: lt && lt.length ? Math.round(Math.max(...lt)) : null,
      blocked: lt ? Math.round(lt.reduce((s, x) => s + x, 0)) : null,
      tiles: await page.evaluate(() => document.querySelectorAll("#grid .item").length),
      nodes: m.Nodes ?? (await page.evaluate(() => document.getElementsByTagName("*").length)),
      heapMB: m.JSHeapUsedSize ? +MB(m.JSHeapUsedSize) : null,
      processMB: cdp ? +MB(await processMemory(browser)) : null,
    };
    rows.push(row);
    console.log(
      `  ${name.padEnd(40)} ${String(row.ms).padStart(7)} ms  ${String(row.requests).padStart(4)} req ` +
        `${String(row.dataMB).padStart(5)} MB  ${String(row.covers).padStart(5)} covers ${String(row.coverMB).padStart(5)} MB` +
        (lt ? `  long tasks ${row.longTasks} (max ${row.longestTask ?? 0} ms, ${row.blocked} ms)` : "") +
        `  tiles ${row.tiles}` +
        (row.heapMB !== null ? `  heap ${row.heapMB} MB  process ${row.processMB} MB` : ""),
    );
  };
  const click = (sel) => page.click(sel);
  // Every cover of a tile on the screen is shown (a failed cover removes its img)
  const coversOnScreen = () =>
    until(() => {
      const imgs = [...document.querySelectorAll("#grid .cov img")].filter((i) => {
        const r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      });
      return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
    });
  const allShown = () =>
    until(() => activeKey === "__all" && cache.__all && viewList === cache.__all && shown.length === viewList.length);
  const sortBy = async (v) => {
    await page.selectOption("#sort", v);
    await until(() => !document.querySelector("#sort").hidden && document.querySelectorAll("#grid .item").length > 1);
  };
  // Search term: a word of the library found in about 0.5 % of the albums (title or track artist)
  const hits = (w) =>
    lib.albums.filter((a) => [a.t, ...a.ta].some((x) => new RegExp("(^|[^\\p{L}\\p{N}])" + w, "iu").test(x))).length;
  const term = lib.vocab
    .filter((w) => w.length >= 6)
    .sort((x, y) => Math.abs(hits(x) - n / 200) - Math.abs(hits(y) - n / 200))[0];
  const bigGenre = Object.entries(lib.albums.reduce((c, a) => ((c[a.g] = (c[a.g] || 0) + 1), c), {})).sort(
    (x, y) => y[1] - x[1],
  )[0][0];

  console.log(
    `\n${n.toLocaleString("en")} albums (${BROWSER}, latency ${BASE_MS} ms + ${PER_KB} ms/KB, cover ${Math.round(covers.get(600).length / 1000)} KB at 600 px, scale ${SCALE})`,
  );
  await step("Connect (Favourites)", async () => {
    await page.fill("#ip", IP);
    await click("#go");
    await page.waitForFunction(() => document.querySelectorAll("#az button").length > 5, null, { timeout: 600000 });
    await idle();
  });
  await step("All, first time", async () => {
    await click("#az button:text-is('All')");
    await allShown();
  });
  await step("All: covers on the screen", coversOnScreen);
  await click('#az button[aria-label="Favourites"]');
  await idle();
  await step("All, from the cache", async () => {
    await click("#az button:text-is('All')");
    await allShown();
  });
  await step("Sort: album title Z-A", () => sortBy("title-desc"));
  await step("Sort: album artist (loads years)", () => sortBy("artist"));
  await step("Sort: year, newest first", () => sortBy("year-desc"));
  await step("Sort: random", () => sortBy("random"));
  await step("sortAlbums(All, artist) in the page", () =>
    page.evaluate(() => sortAlbums(cache.__all, "artist").length),
  );
  await step(`Search "${term}" (title + artist)`, () =>
    page.evaluate(async (v) => {
      document.querySelector("#q").value = v;
      await search();
    }, term),
  );
  await step("Search cleared (All again)", () =>
    page.evaluate(async () => {
      document.querySelector("#q").value = "";
      await search();
    }),
  );
  await step(`Genre chip "${bigGenre}" (largest)`, async () => {
    await click(`#az button:text-is("${bigGenre}")`);
    await idle();
  });
  await step("Quality chip CD", async () => {
    await click("#az button:text-is('CD')");
    await idle();
  });
  await step("Decade chip 2010s", async () => {
    await click('#az button[title="Albums from the 2010s"]');
    await idle();
  });
  await step("New", async () => {
    await click("#az button:text-is('New')");
    await idle();
  });
  await step("All again (from the cache): covers on the screen", async () => {
    await click("#az button:text-is('All')");
    await allShown();
    await coversOnScreen();
  });
  // Covers of a later part of the list: 20 screens down at once (a fast scroll), until the covers on the screen show
  await step("Scroll 20 screens: covers on the screen", async () => {
    await page.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        window.scrollBy(0, innerHeight);
        await new Promise((z) => requestAnimationFrame(() => requestAnimationFrame(z)));
      }
    });
    await coversOnScreen();
  });
  if (SCROLL)
    await step("Scroll All to the end", async () => {
      await page.evaluate(async (max) => {
        const frame = () => new Promise((z) => requestAnimationFrame(() => requestAnimationFrame(z)));
        // every tile (and the random tile) in the grid; stops when nothing moves for 100 frames or after max s
        const end = performance.now() + max * 1000;
        for (
          let still = 0, last = -1;
          document.querySelectorAll("#grid .item").length < shown.length + 1 && still < 100 && performance.now() < end;
        ) {
          window.scrollBy(0, innerHeight);
          await frame();
          const now = document.querySelectorAll("#grid .item").length + scrollY;
          still = now === last ? still + 1 : 0;
          last = now;
        }
        window.scrollTo(0, document.body.scrollHeight);
        await frame();
      }, SCROLL_MAX);
      // until the covers asked for are answered (no new /Artwork request for 1 s); with the cover queue only 1 s
      // (the player would need minutes for every cover asked for while scrolling)
      for (let last = -1; last !== player.state.requests.length;) {
        last = player.state.requests.length;
        await page.waitForTimeout(1000 + BASE_MS);
        if (Q_WORKERS) break;
      }
    });
  if (errors.length) console.log("  Page errors: " + errors.join(" | "));
  await ctx.close();
  return { albums: n, term, genre: bigGenre, rows, errors };
}

(async () => {
  if (process.argv.includes("--calibrate")) return calibrate(arg("--calibrate"));
  if (process.argv.includes("--covers")) return coverLoad(arg("--covers"));
  const browser = await launch();
  try {
    const covers = await makeCovers(browser);
    const runs = [];
    for (const n of SIZES) runs.push(await measure(browser, n, covers));
    fs.mkdirSync(RESULTS, { recursive: true });
    const file = path.join(RESULTS, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${BROWSER}.json`);
    const options = {
      browser: BROWSER,
      latency: [BASE_MS, PER_KB],
      coverKB: Math.round(covers.get(600).length / 1000),
      scale: SCALE,
    };
    fs.writeFileSync(file, JSON.stringify({ app: APP, options, runs }, null, 2));
    console.log(`\nResults: ${path.relative(process.cwd(), file)}`);
  } finally {
    await browser.close();
  }
})().then(
  // exit at once: the cover queue of the mock may still hold thousands of covers asked for while scrolling
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
