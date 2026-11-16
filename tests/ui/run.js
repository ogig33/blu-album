// UI tests for BluAlbum.
// Runs the app in headless browsers against a mock player that answers with recorded fixtures.
// Usage: node run.js [path/to/blualbum.html] [--only <text>] [--browser chrome|safari|edge|firefox]
//                    [--viewport WIDTHxHEIGHT[@SCALE]] [--shots]
// Without --browser all four browsers run one after another. --viewport sets the window size and the
// device pixel ratio (default 1200x800, e.g. 1440x900@2 for a Retina laptop). --shots also saves
// screenshots of the main views to test-results/views/ (for a visual check per browser and size).
// Environment: UI_SLOW=<factor> stretches the fixed waits (settle) for slow machines such as CI runners.
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium, webkit, firefox } = require("playwright");
const { createPlayer, USB } = require("./mock-player");
const fs = require("fs");
// Expected now-playing values come from the recorded status
const STATUS = fs.readFileSync(
  path.join(
    __dirname,
    "fixtures",
    fs.readdirSync(path.join(__dirname, "fixtures")).find((f) => f.startsWith("19-")),
  ),
  "utf8",
);
const st = (tag) =>
  ((STATUS.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">")) || [])[1] || "").replace(/&amp;/g, "&");

// pathToFileURL: a correct file URL on Windows too (file:///C:/…)
const APP = pathToFileURL(
  path.resolve(
    process.argv[2] && !process.argv[2].startsWith("--")
      ? process.argv[2]
      : path.join(__dirname, "..", "..", "blualbum.html"),
  ),
).href;
const SLOW = Number(process.env.UI_SLOW) || 1;
const RESULTS = path.join(__dirname, "test-results"); // screenshots of failed tests (ignored by git)
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : "");
const ONLY = arg("--only");
const VP_ARG = arg("--viewport") || "1200x800";
const VP_MATCH = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(VP_ARG);
if (!VP_MATCH) {
  console.error(`Invalid viewport: ${VP_ARG} (use WIDTHxHEIGHT or WIDTHxHEIGHT@SCALE, e.g. 1440x900@2)`);
  process.exit(2);
}
const VIEWPORT = { width: +VP_MATCH[1], height: +VP_MATCH[2], scale: +(VP_MATCH[3] || 1) };
const SHOTS = process.argv.includes("--shots");
// Browsers: Chrome and Edge are the installed apps (Playwright channels), Safari is Playwright's
// WebKit build (the engine of Safari; real Safari cannot be automated by Playwright), Firefox is
// Playwright's Firefox build.
const BROWSERS = {
  chrome: { label: "Chrome", launch: () => chromium.launch({ channel: "chrome" }) },
  safari: { label: "Safari (WebKit)", launch: () => webkit.launch() },
  edge: { label: "Edge", launch: () => chromium.launch({ channel: "msedge" }) },
  firefox: { label: "Firefox", launch: () => firefox.launch() },
};
const PICK = arg("--browser") ? arg("--browser").split(",") : Object.keys(BROWSERS);
const unknown = PICK.filter((b) => !BROWSERS[b]);
if (unknown.length) {
  console.error(`Unknown browser: ${unknown.join(", ")} (use ${Object.keys(BROWSERS).join(", ")})`);
  process.exit(2);
}
const IP = "192.0.2.50"; // address of the mock player (documentation range, never a real device)

// ---------- tiny test harness ----------
const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, opts });
class AssertError extends Error {}
const ok = (cond, msg) => {
  if (!cond) throw new AssertError(msg);
};
const eq = (a, b, msg) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// Opens the app with a fresh browser profile, connects to the mock player and waits for the default view.
async function start(browser, opts = {}) {
  const player = createPlayer(opts);
  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.scale,
    colorScheme: opts.colorScheme || "light",
    locale: opts.locale,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept(opts.promptValue));
  await page.route(`http://${IP}:11000/**`, player.route);
  // GitHub API (update check): records every request; answers with gh.answer = {status, body} or fails.
  const gh = { urls: [], answer: null };
  await page.route("https://api.github.com/**", (r) => {
    gh.urls.push(r.request().url());
    if (!gh.answer) return r.abort();
    return r.fulfill({
      status: gh.answer.status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(gh.answer.body),
    });
  });
  if (opts.storage)
    await page.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), opts.storage);
  await page.goto(APP);
  if (opts.connect !== false) {
    await page.fill("#ip", IP);
    await page.click("#go");
    await page.waitForFunction(() => document.querySelectorAll("#az button").length > 5);
    await page.waitForFunction(() => !/Loading/.test(document.querySelector("#msg").textContent));
  }
  const $$text = (sel) => page.$$eval(sel, (x) => x.map((e) => (e.getAttribute("aria-label") || e.textContent).trim()));
  const tiles = () =>
    page.$$eval("#grid .item", (x) =>
      x.map((e) => e.querySelector("b").textContent).filter((t) => t !== "Random album"),
    );
  const msg = () => page.textContent("#msg");
  const settle = (ms = 400) => page.waitForTimeout(ms * SLOW);
  const chip = (name) => page.click(`#az button:text-is("${name}")`);
  return { page, player, gh, errors, $$text, tiles, msg, settle, chip, close: () => ctx.close() };
}

// ---------- scenarios ----------
test("connect: no playback command on page load (regression)", async (t) => {
  await t.settle(1200);
  eq(
    t.player.state.commands.filter((c) => /^\/(Add|Play|Load)/.test(c)),
    [],
    "playback commands after load",
  );
});

test("connect: only the requests the first view needs (no genre crawl, stats, versions, one-off status)", async (t) => {
  await t.settle(1200);
  const r = t.player.state.requests.map((x) => decodeURIComponent(x));
  eq(r.filter((x) => /MG\/Genres\?genre=/.test(x)).length, 0, "no genre crawl");
  eq(
    r.filter((x) => /^\/(GitVersion|Version)$/.test(x)),
    [],
    "no version requests",
  );
  eq(
    r.filter((x) => /bySection:(Album|Artist|Song|Composer)/.test(x)),
    [],
    "no statistics requests",
  );
  eq(
    r.filter((x) => /^\/Status$|^\/Volume$/.test(x)),
    [],
    "no one-off /Status or /Volume",
  );
  ok(
    r.some((x) => /^\/Status\?timeout=100/.test(x)),
    "status long polling runs",
  );
  ok(
    r.some((x) => /^\/Settings$/.test(x)),
    "settings (room name)",
  );
});

test("about: statistics and versions are loaded when the popup opens, once", async (t) => {
  const count = () =>
    t.player.state.requests
      .map((x) => decodeURIComponent(x))
      .filter((x) => /^\/(GitVersion|Version)$|bySection:(Album|Artist|Song|Composer)/.test(x)).length;
  eq(count(), 0, "nothing before the popup");
  await t.page.click("#gear");
  await t.page.click("#aboutb");
  await t.page.waitForFunction(
    () =>
      /BluOS version/.test(document.querySelector("#infodlg").textContent) &&
      /Composers\s*[\d,]/.test(document.querySelector("#infodlg").textContent),
  );
  const n = count();
  eq(n, 2 + 4 * 2, "versions + 4 statistics lists per source");
  await t.page.click("#infoclose");
  await t.page.click("#aboutb");
  await t.settle(300);
  eq(count(), n, "second opening: no new requests");
});

test("connect: compact connection line shows room and IP", async (t) => {
  await t.page.click("#gear");
  ok(await t.page.isVisible("#cline"), "connection line visible");
  ok(!(await t.page.isVisible("#cform")), "IP form hidden");
  ok((await t.page.textContent("#cip")).includes(IP), "IP shown");
});

test("connect: source switches for Library and USB", async (t) => {
  const rows = await t.page.$$eval("#srcl .srow", (x) =>
    x.map((e) => e.textContent.trim() + "=" + e.querySelector(".sw").getAttribute("aria-checked")),
  );
  eq(rows, ["Library=true", "USB=true"], "source rows");
});

test(
  "connect: without USB drive only Library is offered",
  async (t) => {
    const rows = await t.page.$$eval("#srcl .srow", (x) => x.map((e) => e.textContent.trim()));
    eq(rows, ["Library"], "source rows");
  },
  { usb: false },
);

test("chips: special chips, genres and playlists in one row", async (t) => {
  const c = await t.$$text("#az button");
  eq(c.slice(0, 6), ["All", "Favourites", "New", "HD", "CD", "MQA"], "special chips");
  ok(c.includes("Alternative Rock") && c.includes("Soundtrack"), "genres of both sources");
  ok(c.includes("IG test") && c.includes("TTT"), "playlist chips");
});

test("favourites: default view, from /library category=FAVOURITES", async (t) => {
  eq(
    await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"),
    "true",
    "favourites chip selected",
  );
  const tl = await t.tiles();
  eq(tl.length, 5, "5 favourite albums");
  ok(tl.includes("Brothers In Arms"), "contains a recorded favourite");
  ok(
    t.player.state.requests.some((r) => /library\/v1\/Albums.*category=FAVOURITES/.test(r)),
    "uses the library endpoint",
  );
});

test("new: library + USB, newest first per source", async (t) => {
  await t.chip("New");
  await t.settle();
  const tl = await t.tiles();
  ok(tl.length > 10, "albums shown");
  ok(tl.includes("Hellboy II: The Golden Army"), "USB album included");
  ok(/recently added/.test(await t.msg()), "status line");
});

test("quality CD: one request per section with albums, results from section A", async (t) => {
  await t.chip("CD");
  await t.page.waitForFunction(() => /CD quality|No CD/.test(document.querySelector("#msg").textContent));
  const reqs = t.player.state.requests.filter((r) => /quality=cd/.test(r));
  eq(reqs.length, 27 + 2, "library: 27 filled sections, USB: only its 2 filled sections");
  eq(
    reqs
      .filter((r) => /service=1A2B_3C4D/.test(r))
      .map((r) => new URL("http://x" + r).searchParams.get("section"))
      .sort(),
    ["A", "S"],
    "USB sections",
  );
  ok((await t.tiles()).length > 0, "albums shown");
  await t.chip("All");
  await t.settle();
  await t.chip("CD");
  await t.settle();
  eq(t.player.state.requests.filter((r) => /quality=cd/.test(r)).length, 29, "second click served from cache");
  eq(
    t.player.state.requests.filter((r) => /bySection%3AAlbum|bySection:Album/.test(decodeURIComponent(r))).length,
    2,
    "album sections asked once per source (shared by CD and All)",
  );
});

test("all: albums from the sections", async (t) => {
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  ok((await t.tiles()).length > 20, "albums shown");
});

test("genre: albums of a genre", async (t) => {
  await t.chip("Alternative Rock");
  await t.page.waitForFunction(() => /album|No albums/i.test(document.querySelector("#msg").textContent));
  ok((await t.tiles()).length > 0, "albums shown");
});

test("grid: random album tile first, play button picks from the view", async (t) => {
  const first = await t.page.textContent("#grid .item:first-child b");
  eq(first, "Random album", "first tile");
  await t.page.hover("#grid .item:first-child");
  await t.page.click("#grid .item:first-child .play:not(.addq)");
  await t.settle();
  ok(
    t.player.state.commands.some((c) => /^\/Add\?playnow=1/.test(c)),
    "play command sent",
  );
  await t.settle(1200);
  eq(
    t.player.state.requests.filter((x) => /^\/Status$|^\/Volume$/.test(x)),
    [],
    "no one-off /Status or /Volume after the command (long polling reports the change)",
  );
});

test("grid: lazy rendering in batches of 60", async (t) => {
  // The recorded lists are short (New: 70), so New is rendered five times over; a large window
  // fills itself with more than one batch, so only whole batches and not everything are expected
  await t.chip("New");
  await t.settle();
  const total = await t.page.evaluate(() => {
    const list = Array(5).fill(shown).flat();
    render(list);
    return list.length;
  });
  await t.settle();
  const rendered = await t.page.$$eval("#grid .item", (x) => x.length - 1);
  ok(rendered > 0 && rendered % 60 === 0 && rendered < total, `rendered ${rendered} of ${total}`);
});

test("popup: details and source line, no buttons", async (t) => {
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic"))));
  await t.page.waitForSelector("#dlg[open]");
  await t.page.waitForSelector("#tracks li button");
  ok(
    /^\d+ tracks? \u00B7 \d+:\d\d$/.test(await t.page.textContent("#dsum")),
    "track count and total time above the tracks",
  );
  ok(/library/i.test(await t.page.textContent("#ds")), "source line");
  await t.page.waitForSelector("#tracks li button");
  eq(
    await t.page
      .$$eval("#dlg .dl > .cov button, #dlg .info button", (b) => b.map((x) => x.getAttribute("aria-label") || x.title))
      .then((l) => l.filter((x) => !/^Albums by|^Show albums by/.test(x))),
    [],
    "no play / queue / heart buttons in the popup",
  );
  ok(!(await t.page.$("#dg")), "no genre line");
  const popupReqs = () =>
    t.player.state.requests.filter((x) =>
      /^\/library\/v1\/Songs|^\/Browse.*LocalMusic-Album/.test(decodeURIComponent(x)),
    ).length;
  const n = popupReqs();
  await t.page.click("#close");
  await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic"))));
  await t.page.waitForSelector("#tracks li button");
  eq(popupReqs(), n, "same album again: from the session cache");
  const tr = t.player.state.requests.filter(
    (x) => /^\/Browse/.test(x) && /MG\/LocalMusic-Album/.test(decodeURIComponent(x)),
  );
  ok(tr.length > 0 && tr.every((x) => /withContextMenuItems=0/.test(x)), "track list without context menus");
});

// Browsers send the system language as Accept-Language; with German the player answers the track list
// of an album with an empty menu (Bruno E25), so the app asks in English (E26).
test(
  "popup: track list also in a browser set to German",
  async (t) => {
    await t.chip("All");
    await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
    await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic"))));
    await t.page.waitForFunction(() => !/Loading/.test(document.querySelector("#tracks").textContent));
    const rows = await t.page.$$eval("#tracks li button", (b) => b.map((x) => x.getBoundingClientRect().height));
    ok(rows.length > 0 && rows.every((h) => h > 0), `visible track rows: ${JSON.stringify(rows)}`);
    ok(/^\d+ tracks? \u00B7 \d+:\d\d$/.test(await t.page.textContent("#dsum")), "track count above the tracks");
  },
  { locale: "de-DE" },
);

test("popup: year, quality tag and technical data from /library/v1/Songs", async (t) => {
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic") && a.t === "1")));
  await t.page.waitForSelector("#tracks li button");
  eq((await t.page.textContent("#dy")).trim(), "1977", "year");
  eq(
    await t.page.$$eval("#dtech > *", (e) => e.map((x) => x.className)),
    ["q", ""],
    "quality tag first, then the technical data",
  );
  eq(await t.page.textContent("#dtech .q"), "CD", "quality tag");
  eq(
    await t.page.textContent("#dtech span:not(.q)"),
    "FLAC \u00B7 16 bit / 44.1 kHz \u00B7 Stereo \u00B7 \u00D8 858 kbit/s",
    "technical data",
  );
  ok(
    t.player.state.requests.some((r) =>
      r.startsWith("/library/v1/Songs?service=LocalMusic&album=1&artist=Peter+Gabriel"),
    ),
    "songs requested for the album",
  );
  ok(
    !t.player.state.requests.some((r) => /CM%2FLocalMusic-Album/.test(r)),
    "no context menu request (favourite state is on the cover)",
  );
});

test("popup: USB album (MP3) shows MP3 tag and no bit depth", async (t) => {
  await t.chip("New");
  await t.settle();
  await t.page.evaluate((usb) => openAlbum(shown.find((a) => a.key.startsWith(usb))), USB);
  await t.page.waitForFunction(() => document.querySelector("#dtech").textContent);
  eq(await t.page.textContent("#dtech .q"), "MP3", "MP3 tag");
  ok(
    /^MP3 \u00B7 44\.1 kHz \u00B7 Stereo \u00B7 \u00D8 \d+ kbit\/s$/.test(
      await t.page.textContent("#dtech span:not(.q)"),
    ),
    "technical data without bit depth",
  );
});

test("popup: artist per track only where it differs from the album artist", async (t) => {
  t.player.state.songArtists = { "Solsbury Hill": "Kate Bush" };
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic") && a.t === "1")));
  await t.page.waitForSelector("#tracks li button");
  eq(await t.page.$$eval("#tracks .ta", (e) => e.map((x) => x.textContent)), ["Kate Bush"], "one track artist");
  ok((await t.page.textContent("#tracks li:nth-child(2)")).includes("Kate Bush"), "on track 2");
});

// Firefox upgrades <img src="http://…"> on a file:// page to https (mixed content); the player has no https,
// so covers set as plain http image URLs stay empty there.
test("covers: grid, popup and now playing show the player's images", async (t) => {
  const loaded = (sel) =>
    t.page.waitForFunction((s) => {
      const i = document.querySelector(s);
      return i && i.complete && i.naturalWidth > 0;
    }, sel);
  await loaded("#grid .item .cov img");
  await loaded("#cov");
  await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic"))));
  await loaded("#dimg");
  ok(
    t.player.state.requests.some((r) => /^\/Artwork\?.*followRedirects=1/.test(r)),
    "covers come from /Artwork with followRedirects=1",
  );
});

test("covers: the now playing cover is loaded once for footer and full-screen view", async (t) => {
  await t.page.waitForFunction(() =>
    ["#cov", "#fimg"].every((s) => /^blob:/.test(document.querySelector(s).getAttribute("src") || "")),
  );
  await t.settle(500);
  eq(t.player.state.requests.filter((r) => /^\/Artwork\?.*fn=/.test(r)).length, 1, "one /Artwork request");
});

test("cover heart: favourite album filled, toggles via the player (no local storage)", async (t) => {
  // Default view is Favourites: the first album tile is a favourite
  const tile = "#grid .item:nth-child(2)";
  await t.page.hover(tile);
  eq(await t.page.getAttribute(tile + " .favc", "aria-pressed"), "true", "filled heart");
  await t.page.click(tile + " .favc");
  await t.settle();
  ok(
    t.player.state.commands.some((c) => /^\/DeleteFavourite/.test(c)),
    "DeleteFavourite sent",
  );
  eq(
    await t.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fav:"))),
    [],
    "no local favourites",
  );
});

test("cover heart: USB album has no heart", async (t) => {
  await t.chip("New");
  await t.settle();
  const i = await t.page.evaluate((usb) => shown.findIndex((a) => a.key.startsWith(usb)), USB);
  ok(i >= 0, "USB album in New");
  const tile = "#grid .item:nth-child(" + (i + 2) + ")";
  await t.page.hover(tile);
  ok(!(await t.page.isVisible(tile + " .favc")), "heart hidden");
});

test("cover: hover buttons play / add last / heart", async (t) => {
  const tile = "#grid .item:nth-child(2)";
  await t.page.hover(tile);
  ok(await t.page.isVisible(tile + " .play:not(.addq):not(.favc)"), "play");
  ok(await t.page.isVisible(tile + " .addq"), "add last");
  ok(await t.page.isVisible(tile + " .favc"), "heart");
  await t.page.click(tile + " .addq");
  await t.settle();
  ok(
    t.player.state.commands.some((c) => /where=last/.test(c)),
    "add last sent",
  );
});

test("artist: click shows the albums of the artist via the artist's browse menu, not the All list", async (t) => {
  // Favourites (default view) show "1" by Peter Gabriel; All is not loaded
  const tile = await t.page.$$eval("#grid .item", (x) =>
    x.findIndex((e) => e.querySelector(".card.ar span")?.textContent === "Peter Gabriel"),
  );
  ok(tile > 0, "Peter Gabriel tile in the favourites");
  const before = t.player.state.requests.length;
  await t.page.click(`#grid .item:nth-child(${tile + 1}) .card.ar`);
  await t.page.waitForFunction(() => /^\d+ albums? by /.test(document.querySelector("#msg").textContent));
  const all = await t.page.evaluate(() => shown.map((a) => a.a));
  eq(all.length, 4, "the 4 recorded albums of Peter Gabriel");
  ok(
    all.every((a) => a === "Peter Gabriel"),
    "only albums of the artist",
  );
  const r = t.player.state.requests.slice(before).map((x) => decodeURIComponent(x));
  eq(
    r.filter((x) => /bySection:Album|S:Album\//.test(x)),
    [],
    "All list not loaded",
  );
  eq(
    r.filter((x) => /^\/Browse/.test(x) && !/CM\/LocalMusic-Album/.test(x)).length,
    4,
    "artist menu + albums link per source (2 sources)",
  );
  ok(
    await t.page.evaluate(() => shown.every((a) => a.play && a.menu["addAll-last"])),
    "play and queue URLs from the player",
  );
  // The artist list does not mark favourites (Bruno E17): the app compares with the player's favourites
  // (library only) and reads the context menu of each favourite with &isFavourite=1.
  eq(
    r.filter((x) => /^\/library\/v1\/Albums\?/.test(x)),
    ["/library/v1/Albums?service=LocalMusic&category=FAVOURITES"],
    "favourites of the library asked once",
  );
  eq(
    r.filter((x) => /CM\/LocalMusic-Album/.test(x)),
    ["/Browse?withContextMenuItems=1&key=LocalMusic:CM/LocalMusic-Album?album=1&artist=Peter+Gabriel&isFavourite=1"],
    "context menu read only for the favourite",
  );
  eq(
    await t.page.evaluate(() => shown.map((a) => a.t + ":" + favOf(a).on)),
    ["1:true", "2:false", "3:false", "4:false"],
    "favourite marked, the others not",
  );
  const heart = await t.page.$$eval("#grid .item", (x) =>
    x.findIndex((e) => e.querySelector(".card:not(.ar) b")?.textContent === "1"),
  );
  ok(heart > 0, "tile of the favourite");
  await t.page.hover(`#grid .item:nth-child(${heart + 1})`);
  eq(await t.page.getAttribute(`#grid .item:nth-child(${heart + 1}) .favc`, "aria-pressed"), "true", "filled heart");
  ok(
    await t.page.evaluate(() =>
      /^\/DeleteFavourite/.test(shown.find((a) => a.t === "1").menu["favourite-delete"] || ""),
    ),
    "remove URL from the player's context menu",
  );
  await t.chip("New");
  await t.settle();
  const n = t.player.state.requests.length;
  await t.page.evaluate(() => showArtist("Peter Gabriel"));
  await t.page.waitForFunction(() => /^\d+ albums? by /.test(document.querySelector("#msg").textContent));
  eq(
    t.player.state.requests.slice(n).filter((x) => /^\/Browse/.test(x)).length,
    0,
    "second time from the session cache",
  );
});

test("search: uses the player search, no random tile", async (t) => {
  await t.page.fill("#q", "a");
  await t.page.press("#q", "Enter");
  await t.page.waitForFunction(() => /for/.test(document.querySelector("#msg").textContent));
  ok((await t.page.textContent("#grid .item:first-child b")) !== "Random album", "no random tile");
  ok(
    t.player.state.requests.some((r) => /Search/.test(decodeURIComponent(r))),
    "search request",
  );
});

test("search: the albums list of the result is read once per source (no second request)", async (t) => {
  await t.page.fill("#q", "a");
  await t.page.press("#q", "Enter");
  await t.page.waitForFunction(() => /for/.test(document.querySelector("#msg").textContent));
  const r = t.player.state.requests.map((x) => decodeURIComponent(x));
  const searches = r.filter((x) => /[?&]q=/.test(x)).length;
  ok(searches >= 1, "search request");
  eq(r.filter((x) => /Albums%3Fexpr=|Albums\?expr=/.test(x)).length, searches, "one albums request per search request");
});

test("search: while typing only from 3 characters and after a pause, Enter always", async (t) => {
  const searches = () => t.player.state.requests.filter((r) => /[?&]q=/.test(r)).length;
  const n0 = searches();
  await t.page.type("#q", "lo", { delay: 60 });
  await t.settle(1200);
  eq(searches() - n0, 0, "no search for 2 characters");
  await t.page.type("#q", "ve", { delay: 60 });
  await t.page.waitForTimeout(300); // not stretched by UI_SLOW: must stay below SEARCH_DELAY (800 ms)
  eq(searches() - n0, 0, "no search before the pause");
  await t.page.waitForFunction(() => /for/.test(document.querySelector("#msg").textContent));
  const n1 = searches();
  ok(n1 - n0 >= 1, "one search after the pause");
  await t.page.fill("#q", "");
  await t.page.type("#q", "u2", { delay: 60 });
  await t.page.press("#q", "Enter");
  await t.page.waitForFunction(() => /“u2”/.test(document.querySelector("#msg").textContent));
  ok(searches() > n1, "Enter searches with 2 characters");
});

test("footer: now playing and quality tag, no source icon", async (t) => {
  await t.page.waitForFunction((x) => document.querySelector("#nt1").textContent === x, st("title1"));
  const q = { cd: "CD", hd: "HD" }[st("quality")] || (/^MP3/.test(st("streamFormat")) ? "MP3" : "");
  if (q) eq((await t.page.textContent("#nq")).trim(), q, "quality tag");
  eq(
    await t.page.$$eval(
      "#ctl svg",
      (x) =>
        x.filter((e) =>
          /^(Source|USB|Bibliothek|Library)/i.test(
            e.parentElement.getAttribute("aria-label") || e.parentElement.title || "",
          ),
        ).length,
    ),
    0,
    "no source icon in the player bar",
  );
});

// Listening mode of the player (/audioPreset, fixture 27): current mode as a display-only tag before the
// volume controls; name and tooltip are the displayName values of the answer.
const LM = fs.readFileSync(
  path.join(
    __dirname,
    "fixtures",
    fs.readdirSync(path.join(__dirname, "fixtures")).find((f) => f.startsWith("27-")),
  ),
  "utf8",
);
const lmName = (mode) => (LM.match(new RegExp('displayName="([^"]*)" name="' + mode + '"')) || [])[1];
const lmTitle = (LM.match(/<setting [^>]*displayName="([^"]*)"/) || [])[1];

test("footer: listening mode tag before the volume controls, name and tooltip from /audioPreset", async (t) => {
  await t.page.waitForFunction(() => !document.querySelector("#lm").hidden);
  eq((await t.page.textContent("#lm")).trim(), lmName("MUSIC"), "current mode");
  eq(await t.page.getAttribute("#lm", "title"), lmTitle, "tooltip");
  ok(
    await t.page.$eval("#lm", (e) => e.parentElement.matches("#ctl .vl") && e.nextElementSibling?.id === "vd"),
    "tag sits right before the volume-down button",
  );
  ok(
    await t.page.$eval("#lm", (e) => e.tagName !== "BUTTON" && !e.onclick && e.getAttribute("tabindex") === null),
    "display only (no button)",
  );
});

test("footer: listening mode follows syncStat of /Status, /audioPreset read only on a change", async (t) => {
  await t.page.waitForFunction(() => !document.querySelector("#lm").hidden);
  const count = () => t.player.state.requests.filter((x) => x === "/audioPreset").length;
  eq(count(), 1, "read once on connect");
  await t.settle(3500); // two more long polls with the same syncStat
  eq(count(), 1, "no further reads while syncStat stays");
  t.player.state.listeningMode = "MOVIE";
  t.player.state.syncStat++;
  await t.page.waitForFunction((x) => document.querySelector("#lm").textContent === x, lmName("MOVIE"));
  eq(count(), 2, "read again after the syncStat change");
  eq(
    t.player.state.commands.filter((c) => /alsa_setting/.test(c)),
    [],
    "no listening mode command",
  );
});

test(
  "footer: no listening mode tag on a player without listening modes",
  async (t) => {
    await t.settle(1500);
    ok(t.player.state.requests.includes("/audioPreset"), "asked once");
    ok(await t.page.$eval("#lm", (e) => e.hidden && !e.textContent), "tag hidden");
    eq(t.errors, [], "no JavaScript errors");
  },
  { listeningModes: false },
);

test("footer: play / pause button shows an SVG icon and sends /Pause", async (t) => {
  await t.page.evaluate(() => setState("pause"));
  ok(
    await t.page.$eval("#pp", (b) => !!b.querySelector("svg") && !b.textContent.trim()),
    "play icon is an SVG, no text glyph",
  );
  const play = await t.page.innerHTML("#pp");
  await t.page.evaluate(() => setState("play"));
  ok((await t.page.innerHTML("#pp")) !== play, "pause icon differs from play icon");
  await t.page.click("#pp");
  await t.settle();
  ok(
    t.player.state.commands.some((c) => /^\/Pause/.test(c)),
    "/Pause sent",
  );
});

test("queue: remove button (x) replaces the duration on hover, removes the track via /Delete?id=", async (t) => {
  await t.page.click("#qbtn");
  await t.page.waitForSelector("#qlist li");
  await t.page.mouse.move(0, 0);
  const op = () => t.page.$eval("#qlist li:nth-child(2) .rm", (e) => getComputedStyle(e).opacity);
  eq(await op(), "0", "hidden without hover");
  await t.page.hover("#qlist li:nth-child(2)");
  eq(await op(), "1", "shown on hover");
  eq(
    await t.page.$eval("#qlist li:nth-child(2) .qd", (e) => getComputedStyle(e).visibility),
    "hidden",
    "duration hidden on hover",
  );
  eq(
    await t.page.$eval("#qlist li:nth-child(3) .qd", (e) => getComputedStyle(e).visibility),
    "visible",
    "other durations visible",
  );
  const r = await t.page.$eval(
    "#qlist li:nth-child(3)",
    (li) => li.getBoundingClientRect().right - li.querySelector(".qd").getBoundingClientRect().right,
  );
  ok(r <= 16, "duration at the right edge (" + r + " px)");
  await t.page.click("#qlist li:nth-child(2) .rm");
  await t.settle();
  ok(t.player.state.commands.includes("/Delete?id=1"), "/Delete?id=1 sent");
});

test("queue: after remove, shuffle and clear the queue is loaded once (through the new playlist id)", async (t) => {
  await t.page.click("#qbtn");
  await t.page.waitForSelector("#qlist li");
  await t.settle(2500);
  const loads = () => t.player.state.requests.filter((x) => /^\/Playlist\?/.test(x)).length;
  for (const [name, act] of [
    [
      "remove",
      async () => {
        await t.page.hover("#qlist li:nth-child(2)");
        await t.page.click("#qlist li:nth-child(2) .rm");
      },
    ],
    ["shuffle", () => t.page.click("#qshuf")],
    ["clear", () => t.page.click("#qclear")],
  ]) {
    const n = loads();
    await act();
    await t.settle(3500);
    eq(loads() - n, 1, "queue loads after " + name);
  }
});

test("queue: shuffle on / off via the player, button follows /Status", async (t) => {
  await t.page.click("#qbtn");
  await t.page.waitForSelector("#qlist li");
  eq(await t.page.getAttribute("#qshuf", "aria-pressed"), "false", "shuffle off at start");
  await t.page.click("#qshuf");
  await t.page.waitForSelector("#qshuf[aria-pressed=true]", { timeout: 6000 });
  ok(t.player.state.commands.includes("/Shuffle?state=1"), "/Shuffle?state=1 sent");
  await t.page.click("#qshuf");
  await t.page.waitForSelector("#qshuf[aria-pressed=false]", { timeout: 6000 });
  ok(t.player.state.commands.includes("/Shuffle?state=0"), "/Shuffle?state=0 sent");
});

test("queue: repeat off -> queue -> track -> off via the player, button follows /Status", async (t) => {
  await t.page.click("#qbtn");
  await t.page.waitForSelector("#qlist li");
  eq(await t.page.getAttribute("#qrep", "aria-label"), "Repeat: off", "repeat off at start");
  for (const [state, label] of [
    ["0", "queue"],
    ["1", "track"],
    ["2", "off"],
  ]) {
    await t.page.click("#qrep");
    await t.page.waitForSelector(`#qrep[aria-label="Repeat: ${label}"]`, { timeout: 6000 });
    ok(t.player.state.commands.includes("/Repeat?state=" + state), "/Repeat?state=" + state + " sent");
    eq(await t.page.getAttribute("#qrep", "aria-pressed"), String(state !== "2"), "highlighted unless off");
  }
});

test("full screen: opens from the footer cover, footer hidden until bottom edge", async (t) => {
  await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, st("title1"));
  await t.page.click("#cvb");
  ok(await t.page.isVisible("#full"), "full screen visible");
  const x = VIEWPORT.width / 2,
    h = VIEWPORT.height;
  await t.page.mouse.move(x, h * 0.4);
  await t.settle(300);
  const top = () => t.page.$eval("#ctl", (e) => Math.round(e.getBoundingClientRect().top));
  ok((await top()) >= h, "footer hidden");
  await t.page.mouse.move(x, h - 1);
  await t.settle(300);
  ok((await top()) < h, "footer shown at bottom edge");
  await t.page.keyboard.press("Escape");
  ok(!(await t.page.isVisible("#full")), "closed with Esc");
});

test(
  "queue: pinned panel, durations, save as playlist",
  async (t) => {
    await t.page.click("#qbtn");
    await t.page.waitForFunction(() => document.querySelectorAll("#qlist li").length > 0);
    eq(await t.page.$$eval("#qlist li", (x) => x.length), 12, "12 queue entries");
    ok(/^\d+:\d\d$/.test((await t.page.textContent("#qlist li .qd")).trim()), "duration m:ss");
    await t.page.click("#msg");
    ok(await t.page.isVisible("#qside"), "stays open when clicking outside (pinned)");
    await t.page.click("#qsave");
    await t.settle();
    ok(
      t.player.state.commands.some((c) => c.startsWith("/Save?name=Unit test list")),
      "save sent",
    );
    ok(/Saved playlist/.test(await t.page.textContent("#toast")), "toast");
  },
  { promptValue: "Unit test list" },
);

test("queue: delete button for a loaded (broken, empty) playlist", async (t) => {
  await t.page.click("#qbtn");
  await t.settle();
  await t.page.click('#az .plc:has-text("TTT")');
  await t.page.waitForFunction(() => !document.querySelector("#qdel").hidden, null, { timeout: 4000 });
  await t.page.click("#qdel");
  await t.settle();
  ok(
    t.player.state.commands.some((c) => c === "/Delete?service=BluOS&name=TTT"),
    "delete sent with the name",
  );
});

test("settings: chip switches hide genres / quality / playlists", async (t) => {
  await t.page.click("#gear");
  const visible = () =>
    t.page.$$eval("#az > button", (x) =>
      x.filter((e) => e.offsetParent).map((e) => e.getAttribute("aria-label") || e.textContent),
    );
  await t.page.click("#gsw");
  await t.page.click("#qsw");
  await t.page.click("#psw");
  eq(await visible(), ["All", "Favourites", "New"], "only special chips left");
  await t.page.reload();
  await t.settle(200);
  eq(await t.page.getAttribute("#gsw", "aria-checked"), "false", "remembered after reload");
});

test("settings: source switch off -> only the other source", async (t) => {
  await t.page.click("#gear");
  await t.page.click("#srcl .srow:nth-child(2) .sw"); // USB off
  await t.settle(800);
  await t.page.keyboard.press("Escape"); // close the panel
  await t.page.waitForFunction(() => /favourites/.test(document.querySelector("#msg").textContent));
  const c = await t.$$text("#az button");
  ok(!c.includes("Soundtrack") || c.includes("Alternative Rock"), "chips rebuilt");
  await t.chip("New");
  await t.settle();
  ok(!(await t.tiles()).includes("Hellboy II: The Golden Army"), "no USB album");
});

// Layout of the album wall for one cover size and design: tile width, no horizontal scrolling,
// background brightness of the design and contrast of the album titles (WCAG AA: 4.5).
const wallLayout = (page) =>
  page.evaluate(() => {
    const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = (c) => {
      const [r, g, b] = rgb(c).map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bg = getComputedStyle(document.body).backgroundColor;
    const titles = [...document.querySelectorAll("#grid .item b")].slice(0, 12);
    const contrast = Math.min(
      ...titles.map((e) => {
        const [a, b] = [lum(getComputedStyle(e).color), lum(bg)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      }),
    );
    return {
      tile: document.querySelector("#grid .item:not(:first-child)").getBoundingClientRect().width,
      overflow: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      dark: lum(bg) < 0.2,
      contrast: Math.round(contrast * 10) / 10,
    };
  });

// Designs: Day and Night set data-theme, System follows the colour scheme of the system
const DESIGNS = [
  { theme: "light", scheme: "dark", dark: false },
  { theme: "dark", scheme: "light", dark: true },
  { theme: "system", scheme: "light", dark: false },
  { theme: "system", scheme: "dark", dark: true },
];

test("settings: every cover size in every design, no horizontal scrolling, readable titles", async (t) => {
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  for (const d of DESIGNS) {
    await t.page.emulateMedia({ colorScheme: d.scheme });
    const widths = [];
    for (const size of ["s", "m", "l"]) {
      await t.page.click("#gear");
      await t.page.click(`#themes [data-theme="${d.theme}"]`);
      await t.page.click(`#sizes [data-size="${size}"]`);
      await t.page.keyboard.press("Escape");
      await t.settle(300);
      const l = await wallLayout(t.page);
      const at = `${d.theme} (system ${d.scheme}), ${size.toUpperCase()}`;
      ok(l.overflow <= 0, `${at}: no horizontal scrolling (${l.overflow} px too wide)`);
      eq(l.dark, d.dark, `${at}: dark background`);
      ok(l.contrast >= 4.5, `${at}: title contrast ${l.contrast} (at least 4.5)`);
      widths.push(l.tile);
    }
    ok(widths[0] < widths[1] && widths[1] < widths[2], `${d.theme}: S < M < L (${widths.join(" / ")} px)`);
  }
  eq(
    await t.page.evaluate(() => [localStorage.getItem("theme"), localStorage.getItem("tile")]),
    ["system", "l"],
    "stored",
  );
});

test("about: popup with name, version, copyright, GitHub link, player info and stats", async (t) => {
  await t.page.click("#gear");
  await t.page.click("#aboutb");
  await t.page.waitForSelector("#infodlg[open]");
  // versions and statistics arrive after the popup opens
  await t.page.waitForFunction(
    () =>
      /BluOS version\s*\d/.test(document.querySelector("#infodlg").textContent) &&
      /Playlists/.test(document.querySelector("#infodlg").textContent),
  );
  const txt = await t.page.textContent("#infodlg");
  ok(
    /BluAlbum/.test(txt) && /Version v\d+\.\d+\.\d+/.test(txt) && /Copyright © 2026 Ingmar Gebert/.test(txt),
    "header lines",
  );
  ok(/Albums/.test(txt) && /Playlists/.test(txt), "stats");
  ok(/BluOS version\s*4\.18\.18/.test(txt) && /API version\s*v0\.5\.43/.test(txt), "player versions");
  ok(txt.includes("Room") && txt.includes(await t.page.evaluate(() => playerName)), "room name");
  const link = await t.page.$eval("#infodlg a#repo", (a) => ({ href: a.href, text: a.textContent, target: a.target }));
  eq(
    link,
    { href: "https://github.com/ogig33/blu-album", text: "github.com/ogig33/blu-album", target: "_blank" },
    "GitHub link",
  );
});

test("about: update check only on click, newer / same version / failure", async (t) => {
  const version = await t.page.evaluate(() => APP.version);
  await t.page.click("#gear");
  await t.page.click("#aboutb");
  await t.page.waitForSelector("#infodlg[open]");
  await t.settle(300);
  eq(t.gh.urls, [], "no GitHub request before the click");
  const check = async () => {
    await t.page.click("#updb");
    await t.page.waitForFunction(
      () =>
        !/Checking/.test(document.querySelector("#updmsg").textContent) &&
        document.querySelector("#updmsg").textContent,
    );
    return t.page.textContent("#updmsg");
  };
  const url = "https://github.com/ogig33/blu-album/releases/tag/v99.0.0";
  t.gh.answer = { status: 200, body: { tag_name: "v99.0.0", html_url: url } };
  eq(await check(), "Update available: v99.0.0", "newer release");
  eq(await t.page.$eval("#updmsg a", (a) => [a.href, a.target]), [url, "_blank"], "release link");
  eq(t.gh.urls, ["https://api.github.com/repos/ogig33/blu-album/releases/latest"], "one request to the latest release");
  t.gh.answer = { status: 200, body: { tag_name: "v" + version, html_url: url } };
  eq(await check(), "You have the latest version.", "same version");
  t.gh.answer = { status: 403, body: { message: "rate limit" } };
  eq(await check(), "Update check failed (HTTP 403).", "failed request");
});

test("covers: image URLs only on the player or http(s), /Artwork with followRedirects", async (t) => {
  const r = await t.page.evaluate(() => [
    imgUrl("/Artwork?service=LocalMusic&album=A%20B&artist=C"),
    imgUrl("/images/LibraryIcon.png"),
    imgUrl("https://cdn.example.com/cover.jpg"),
    imgUrl("//evil.example.com/x.png"),
    imgUrl("javascript:alert(1)"),
    imgUrl("data:image/svg+xml,<svg/>"),
    imgUrl(""),
  ]);
  const b = `http://${IP}:11000`;
  eq(
    r,
    [
      b + "/Artwork?service=LocalMusic&album=A%20B&artist=C&followRedirects=1",
      b + "/images/LibraryIcon.png",
      "https://cdn.example.com/cover.jpg",
      "",
      "",
      "",
      "",
    ],
    "image URLs",
  );
  // The image itself is shown as a blob URL (read with fetch, see showImg); data-src is the player URL
  // data-src is set once the lazy loader reaches the cover (slower on CI runners)
  await t.page.waitForFunction(() => document.querySelector("#grid .item:not(:first-child) .cov img")?.dataset.src);
  const src = await t.page.$eval("#grid .item:not(:first-child) .cov img", (i) => i.dataset.src);
  ok(src.startsWith(b + "/Artwork?") && src.endsWith("&followRedirects=1"), "grid cover from /Artwork: " + src);
});

test("no JavaScript errors in a full session", async (t) => {
  for (const c of ["All", "New", "CD", "Alternative Rock"]) {
    await t.chip(c);
    await t.settle(500);
  }
  eq(t.errors, [], "page errors");
});

// Screenshots of the main views (only with --shots); file names: <browser>-<viewport>-<view>.png
async function views(t) {
  const dir = path.join(RESULTS, "views");
  fs.mkdirSync(dir, { recursive: true });
  const shot = (name) => t.page.screenshot({ path: path.join(dir, `${t.key}-${VP_ARG}-${name}.png`) });
  const setting = async (...sels) => {
    await t.page.click("#gear");
    for (const sel of sels) await t.page.click(sel);
    await t.page.keyboard.press("Escape");
    await t.settle(500);
  };
  await t.chip("All");
  await t.page.waitForFunction(() => /^\d[\d,]* albums?\b/.test(document.querySelector("#msg").textContent));
  for (const theme of ["light", "dark"]) {
    // album wall in every cover size
    for (const size of ["s", "m", "l"]) {
      await setting(`#themes [data-theme="${theme}"]`, `#sizes [data-size="${size}"]`);
      await t.settle(300); // covers
      await shot(`${theme}-1-albums-${size}`);
    }
    await setting('#sizes [data-size="m"]');
    await t.page.evaluate(() => openAlbum(shown.find((a) => a.key.startsWith("LocalMusic") && a.t === "1")));
    await t.page.waitForSelector("#tracks li button");
    await t.settle(500);
    await shot(`${theme}-2-album-popup`);
    await t.page.click("#close");
    await t.page.click("#qbtn");
    await t.page.waitForSelector("#qlist li");
    await t.settle(500);
    await shot(`${theme}-3-queue`);
    await t.page.click("#qbtn");
    await t.page.click("#gear");
    await t.settle(500);
    await shot(`${theme}-4-settings`);
    await t.page.keyboard.press("Escape");
    await t.page.click("#cvb");
    await t.page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height * 0.4);
    await t.settle(800);
    await shot(`${theme}-5-full-screen`);
    await t.page.keyboard.press("Escape");
  }
}
if (SHOTS) test("views: screenshots of the main views", views);

// ---------- runner ----------
async function runIn(key) {
  const { label } = BROWSERS[key];
  console.log(`\n${label} · ${VP_ARG}`);
  let browser;
  try {
    browser = await BROWSERS[key].launch();
  } catch (e) {
    console.log(`  ✗ could not start ${label}: ${e.message.split("\n")[0]}`);
    return { label, pass: 0, fail: 1 };
  }
  let pass = 0,
    fail = 0;
  for (const tc of tests.filter((x) => !ONLY || x.name.includes(ONLY))) {
    const t0 = Date.now();
    let t;
    try {
      t = await start(browser, tc.opts);
      t.key = key;
      await tc.fn(t);
      if (t.errors.length) throw new AssertError("page errors: " + t.errors.join(" | "));
      pass++;
      console.log(`  ✓ ${tc.name} (${Date.now() - t0} ms)`);
    } catch (e) {
      fail++;
      console.log(
        `  ✗ ${tc.name}\n      ${e instanceof AssertError ? e.message : e.stack.split("\n").slice(0, 3).join("\n      ")}`,
      );
      if (t) {
        fs.mkdirSync(RESULTS, { recursive: true });
        const file = path.join(RESULTS, `${key}-${VP_ARG}-${tc.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}.png`);
        await t.page.screenshot({ path: file }).catch(() => {});
      }
    } finally {
      if (t) await t.close();
    }
  }
  await browser.close();
  return { label, pass, fail };
}

(async () => {
  const results = [];
  for (const key of PICK) results.push(await runIn(key));
  console.log("");
  for (const r of results) console.log(`${r.label} · ${VP_ARG}: ${r.pass} passed, ${r.fail} failed`);
  process.exit(results.some((r) => r.fail) ? 1 : 0);
})();
