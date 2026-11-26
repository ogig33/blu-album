// UI tests for BluAlbum.
// Runs the app in headless browsers against a mock player that answers with recorded fixtures, or
// against a real player (--player).
// Usage: node run.js [path/to/blualbum.html] [--only <text>] [--browser chrome|safari|edge|firefox]
//                    [--all] [--viewport WIDTHxHEIGHT[@SCALE]] [--shots] [--jobs <n>] [--player <ip> [--write]]
//                    [--list]
// Scope: by default the local core tests (column "Core" = local in docs/blu-album-test-plan.md, at most 50).
// --all runs every test (GitHub Actions); --only and --player choose from every test.
// Without --browser Chrome and Safari run one after another (the local default; GitHub Actions
// runs every browser with --browser). --viewport sets the window size and the
// device pixel ratio (default 1200x800, e.g. 1440x900@2 for a Retina laptop). --shots also saves
// screenshots of the main views to test-results/views/ (for a visual check per browser and size).
// --player <ip> runs the tests marked real: "read" against that player (nothing is changed on it);
// --write adds the tests marked real: "write" (they play, change the queue and favourites; the queue,
// playback position, shuffle, repeat and volume are saved first and restored after every such test).
// --jobs <n>: tests at the same time per browser (default: 4, at most the CPU count; 1 on CI runners).
// With --player always 1: the tests share that player.
// --list prints every test with its marks (read / write / mock, local).
// Environment: UI_SLOW=<factor> stretches the fixed waits (settle) for slow machines such as CI runners.
// Every test name starts with the IDs of the test plan (docs/blu-album-test-plan.md) it covers, e.g. --only QUE-
// runs the queue block.
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium, webkit, firefox } = require("playwright");
const { createPlayer, createRecorder, fx, USB } = require("./mock-player");
const fs = require("fs");

// ---------- options ----------
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
const ALL = process.argv.includes("--all");
// Test plan: its column "Core" selects the local tests
const PLAN = path.join(__dirname, "..", "..", "docs", "blu-album-test-plan.md");
const CORE_MAX = 150,
  LOCAL_MAX = 50;
const VP_ARG = arg("--viewport") || "1200x800";
const VP_MATCH = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(VP_ARG);
if (!VP_MATCH) {
  console.error(`Invalid viewport: ${VP_ARG} (use WIDTHxHEIGHT or WIDTHxHEIGHT@SCALE, e.g. 1440x900@2)`);
  process.exit(2);
}
const VIEWPORT = { width: +VP_MATCH[1], height: +VP_MATCH[2], scale: +(VP_MATCH[3] || 1) };
const SHOTS = process.argv.includes("--shots");
// Real player: its IP address (empty = mock player); WRITE = also the tests that change the player
const REAL = arg("--player");
const WRITE = !!REAL && process.argv.includes("--write");
if (process.argv.includes("--player") && !/^[\w.-]+$/.test(REAL)) {
  console.error("--player needs the IP address of the player, e.g. --player 192.168.1.50");
  process.exit(2);
}
// Tests at the same time: each has its own browser context and mock player. The real player is shared.
const JOBS_ARG = arg("--jobs") || (process.env.CI ? "1" : String(Math.min(4, os.cpus().length || 1)));
if (!/^[1-9]\d?$/.test(JOBS_ARG)) {
  console.error(`Invalid --jobs: ${JOBS_ARG} (use a number from 1 to 99)`);
  process.exit(2);
}
const JOBS = REAL ? 1 : +JOBS_ARG;
// Browsers: Chrome and Edge are the installed apps (Playwright channels), Safari is Playwright's
// WebKit build (the engine of Safari; real Safari cannot be automated by Playwright), Firefox is
// Playwright's Firefox build.
const BROWSERS = {
  chrome: { label: "Chrome", launch: () => chromium.launch({ channel: "chrome" }) },
  safari: { label: "Safari (WebKit)", launch: () => webkit.launch() },
  edge: { label: "Edge", launch: () => chromium.launch({ channel: "msedge" }) },
  firefox: { label: "Firefox", launch: () => firefox.launch() },
};
const PICK = arg("--browser") ? arg("--browser").split(",") : ["chrome", "safari"];
const unknown = PICK.filter((b) => !BROWSERS[b]);
if (unknown.length) {
  console.error(`Unknown browser: ${unknown.join(", ")} (use ${Object.keys(BROWSERS).join(", ")})`);
  process.exit(2);
}
// Address of the player: the real one, or the mock (documentation range, never a real device)
const IP = REAL || "192.0.2.50";
const IP2 = "192.0.2.51"; // second mock player (changing the player)
const BASE = `http://${IP}:11000`;
// Top menu request (no key)
const TOP = /^\/Browse\?withContextMenuItems=1$/;
// Names of the playlists the tests create (deleted again)
const TEST_LIST = "__blualbum_test_list__";
const SAVE_NAME = "__blualbum_ui_test__";
const WORK_NAME = "__blualbum_ui_test_start__"; // queue set up by prepare() (--write)
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));

// ---------- test data ----------
// Built before the tests run by asking the player the tests run against (mock: answers derived from the
// fixtures; real player with --player) the same questions as the app, so no artist, album or number is
// written into the tests. IDs as in "Test data dictionary" of docs/blu-album-test-plan.md.
const ent = (s) =>
  (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
// Attributes of every <item> of a Browse answer that passes `keep`
const itemsOf = (xml, keep = () => true) =>
  [...(xml || "").matchAll(/<item ([^>]*)>/g)]
    .map((m) => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], ent(x[2])])))
    .filter(keep);
const ofType = (t) => (i) => i.type === t;
// <album> entries of a /library/v1/Albums answer: {t, a}
const libList = (xml) =>
  [...(xml || "").matchAll(/<album[^>]*>\s*<(?:alb|title)>([^<]*)<\/(?:alb|title)>\s*<art>([^<]*)<\/art>/g)].map(
    (m) => ({ t: ent(m[1]), a: ent(m[2]) }),
  );
const sum = (secs) => secs.reduce((n, x) => n + (+x.text2 || 0), 0);
// Text of the first <tag> of an answer (e.g. a /Status value)
const stOf = (xml) => (tag) =>
  ent(((xml || "").match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">")) || [])[1] || "");
// Now-playing texts of a /Status (st = stOf(...)): footer line 2 and the full-screen lines 2 and 3; "by" / "from"
// only when title2 / title3 are the artist and album, else "title2 – title3"
const nowLines = (st) => {
  const t2 = st("title2"),
    t3 = st("title3"),
    named = t2 === st("artist") && t3 === st("album");
  if (!named) return { bar: [t2, t3].filter(Boolean).join(" – "), full: [t2, t3] };
  return {
    bar: [t2 && "by " + t2, t3 && "from " + t3].filter(Boolean).join(" "),
    full: [t2 && "by " + t2, t3 && "from " + t3],
  };
};
// Highlighted now-playing words below sel: [text, bold]; the connecting words "by" / "from" are not highlighted
const nowStyles = (page, sel) =>
  page.$$eval(sel + " .nv", (l) => l.map((x) => [x.textContent, +getComputedStyle(x).fontWeight >= 600]));
// Form encoding as the player writes it in keys and URLs (same as formEnc() of the app)
const formEnc = (v) =>
  encodeURIComponent(v)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
let TD = {};
async function buildTD(get) {
  const D = {};
  const browse = async (key, menus = true) =>
    (await get("/Browse?withContextMenuItems=" + (menus ? 1 : 0) + (key ? "&key=" + encodeURIComponent(key) : ""))) ||
    "";
  // Albums of a browse list, following nextKey (like fetchAlbums of the app)
  const albumsOf = async (key) => {
    const out = [],
      seen = new Set();
    let k = key;
    while (k && !seen.has(k)) {
      seen.add(k);
      const x = await browse(k);
      out.push(...itemsOf(x, ofType("album")));
      k = ent((x.match(/nextKey="([^"]*)"/) || [])[1] || "");
    }
    return out;
  };
  // /library/v1/Albums of a service, following <nextlink> (like libAlbums of the app)
  const libAlbums = async (svc, filter, max) => {
    const out = [],
      seen = new Set();
    let p = "/library/v1/Albums?service=" + encodeURIComponent(svc) + "&" + filter;
    while (p && !seen.has(p) && out.length < max) {
      seen.add(p);
      const x = (await get(p)) || "";
      out.push(...libList(x));
      p = ent(((x.match(/<nextlink>([^<]*)<\/nextlink>/) || [])[1] || "").trim());
    }
    return out.slice(0, max);
  };
  const svcOf = (key) => key.split(":")[0];
  const top = await browse("");
  // TD-SRC: music sources (library / USB) of the top menu
  D.SRC = itemsOf(top, (i) => i.type === "link" && /USBIcon|LibraryIcon/.test(i.image || ""));
  D.SVC = D.SRC.map((s) => svcOf(s.browseKey));
  D.LIB = svcOf((D.SRC.find((s) => /LibraryIcon/.test(s.image)) || { browseKey: "LocalMusic:" }).browseKey);
  D.USB = svcOf((D.SRC.find((s) => /USBIcon/.test(s.image)) || { browseKey: "" }).browseKey);
  D.MENU = {};
  D.GENRES = {};
  D.GENRE_KEYS = {};
  D.SECS = {};
  for (const s of D.SRC) {
    const svc = svcOf(s.browseKey),
      menu = await browse(s.browseKey),
      its = itemsOf(menu);
    D.MENU[svc] = menu;
    const gi = its.find((i) => /GG\/Genres/.test(i.browseKey || "") || i.text === "Genres");
    const genres = gi ? itemsOf(await browse(gi.browseKey), ofType("genre")) : [];
    D.GENRES[svc] = genres.map((g) => g.text);
    D.GENRE_KEYS[svc] = genres.map((g) => g.browseKey);
    const ai = its.find((i) => /bySection:Album/.test(i.browseKey || ""));
    D.SECS[svc] = ai ? itemsOf(await browse(ai.browseKey), ofType("section")) : [];
  }
  // TD-GEN: genre names of all sources (chip row = sorted union); TD-GEN-ONE: a genre of the library only
  D.GEN_LIB = D.GENRES[D.LIB] || [];
  D.GEN_USB = D.USB ? D.GENRES[D.USB] : [];
  D.GEN = [...new Set(Object.values(D.GENRES).flat())].sort((x, y) => x.localeCompare(y));
  D.GEN_ONE = D.GEN_LIB.find((g) => D.SVC.every((s) => s === D.LIB || !D.GENRES[s].includes(g)));
  // TD-SEC: A-Z sections, "filled" = album count not 0
  D.SEC_LIB = D.SECS[D.LIB] || [];
  D.SEC_USB = D.USB ? D.SECS[D.USB] : [];
  D.FILLED_LIB = D.SEC_LIB.filter((x) => x.text2 !== "0");
  D.FILLED_USB = D.SEC_USB.filter((x) => x.text2 !== "0");
  // TD-ALL: albums of the first filled library section; ALL_COUNT: albums of every filled section of every source
  D.ALL = null;
  D.ALL_COUNT = 0;
  for (const svc of D.SVC)
    for (const sec of D.SECS[svc].filter((x) => x.text2 !== "0")) {
      const a = await albumsOf(sec.browseKey);
      D.ALL_COUNT += a.length;
      if (svc === D.LIB && !D.ALL && a.length) D.ALL = a;
    }
  D.ALL = D.ALL || [];
  // TD-GEN-ALB: albums of TD-GEN-ONE through /Browse (genre menu, sections, albums): what the genre chip must show
  D.GEN_ALB = [];
  const genKey = (D.GENRE_KEYS[D.LIB] || [])[D.GEN_LIB.indexOf(D.GEN_ONE)];
  if (genKey) {
    const link = itemsOf(await browse(genKey)).find((i) => /bySection:Album/.test(i.browseKey || ""));
    const secs = link ? itemsOf(await browse(link.browseKey), ofType("section")) : [];
    for (const sec of secs.filter((x) => x.text2 !== "0")) D.GEN_ALB.push(...(await albumsOf(sec.browseKey)));
  }
  // TD-QCD: number of albums in CD quality, counted through the lists per section
  D.QCD_COUNT = 0;
  for (const svc of D.SVC)
    for (const sec of D.SECS[svc].filter((x) => x.text2 !== "0")) {
      const name = encodeURIComponent(sec.text);
      const x = (await get(`/library/v1/Albums?service=${encodeURIComponent(svc)}&quality=cd&section=${name}`)) || "";
      D.QCD_COUNT += (x.match(/<album[ >]/g) || []).length;
    }
  // TD-DEC: decades of the decade index (/library/v1/Albums section=all&length=1&sort=decade per source with album
  // sections, union sorted like the app); TD-YEARS: albums with a year of every filled section of every source
  // (/library/v1/Albums without a filter) as {t, y}
  D.DEC = [];
  D.YEARS = [];
  for (const svc of D.SVC) {
    if (!D.SECS[svc].length) continue;
    const ix =
      (await get(`/library/v1/Albums?service=${encodeURIComponent(svc)}&section=all&length=1&sort=decade`)) || "";
    D.DEC.push(...[...ix.matchAll(/<section name="(\d{4})" length=/g)].map((m) => m[1]));
    for (const sec of D.SECS[svc].filter((x) => x.text2 !== "0")) {
      const x =
        (await get(
          `/library/v1/Albums?service=${encodeURIComponent(svc)}&limit=500&section=${encodeURIComponent(sec.text)}`,
        )) || "";
      D.YEARS.push(
        ...[...x.matchAll(/<album [^>]*?date="(\d{4})"[^>]*>\s*<title>([^<]*)<\/title>/g)].map((m) => ({
          y: m[1],
          t: ent(m[2]),
        })),
      );
    }
  }
  D.DEC = [...new Set(D.DEC)].sort();
  // TD-ALB-LIB: first album of TD-ALL with its tracks (TD-TRK) and songs (TD-SONGS)
  const first = D.ALL[0] || { text: "", text2: "", browseKey: "" };
  D.ALB_LIB = { t: first.text, a: first.text2, key: first.browseKey };
  D.SONGS = (await get("/library/v1/Songs?service=" + D.LIB + "&" + (first.browseKey.split("?")[1] || ""))) || "";
  D.SONG_TITLES = [...D.SONGS.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => ent(m[1]));
  D.TRK = itemsOf(await browse(first.browseKey, false), ofType("track"));
  // TD-NEW (newest first, at most 200 per source like the app) and TD-FAV (library only)
  D.NEW_LIB = (await libAlbums(D.LIB, "recent=1", 200)).map((x) => x.t);
  const newUsb = D.USB ? await libAlbums(D.USB, "recent=1", 200) : [];
  D.NEW_USB = newUsb.map((x) => x.t);
  // TD-ALB-USB: first USB album of New and its songs
  D.SONGS_USB = newUsb.length
    ? (await get(`/library/v1/Songs?service=${D.USB}&album=${formEnc(newUsb[0].t)}&artist=${formEnc(newUsb[0].a)}`)) ||
      ""
    : "";
  D.FAV = await libAlbums(D.LIB, "category=FAVOURITES", 5000);
  // TD-PL: BluOS playlists (following nextKey like the app)
  const plItem = itemsOf(top).find(
    (i) => /myplaylists/i.test(i.image || "") || /^(playlists|wiedergabelisten)$/i.test(i.text || ""),
  );
  D.PL = [];
  for (let k = plItem ? plItem.browseKey : "", i = 0; k && i < 20; i++) {
    const x = await browse(k);
    D.PL.push(...itemsOf(x, ofType("playlist")));
    k = ent((x.match(/<browse [^>]*nextKey="([^"]*)"/) || [])[1] || "");
  }
  // TD-PL-TRK: tracks of the first BluOS playlist, every page (like fetchItems of the app)
  const fetchTracks = async (key) => {
    const out = [];
    for (let k = key, seen = new Set(); k && !seen.has(k);) {
      seen.add(k);
      const x = await browse(k);
      out.push(...itemsOf(x, ofType("track")));
      k = ent((x.match(/<browse [^>]*nextKey="([^"]*)"/) || [])[1] || "");
    }
    return out;
  };
  D.PL_TRK = D.PL.length ? await fetchTracks(D.PL[0].browseKey) : [];
  // TD-LPL: library playlists of every source (link "Playlists" of its menu, following nextKey like the app)
  D.LPL = [];
  for (const svc of D.SVC) {
    const li = itemsOf(D.MENU[svc]).find((i) => /:Playlist\//.test(i.browseKey || ""));
    for (let k = li ? li.browseKey : "", i = 0; k && i < 20; i++) {
      const x = await browse(k);
      D.LPL.push(...itemsOf(x, ofType("playlist")));
      k = ent((x.match(/<browse [^>]*nextKey="([^"]*)"/) || [])[1] || "");
    }
  }
  // TD-LPL-TRK: tracks of the first library playlist
  D.LPL_TRK = D.LPL.length ? await fetchTracks(D.LPL[0].browseKey) : [];
  // TD-STATUS, TD-QUEUE (pages of 200, at most 2000 like the app), TD-SET, TD-LM, TD-VER
  D.STATUS = (await get("/Status")) || "";
  // TD-NOW-LIB: a title of a library source is playing or paused
  D.NOW_LIB = /^(play|pause)$/.test(stOf(D.STATUS)("state")) && D.SVC.includes(stOf(D.STATUS)("service"));
  D.QUEUE = [];
  for (let s = 0, total = 1; s < total && s < 2000; s += 200) {
    const x = (await get(`/Playlist?start=${s}&end=${s + 199}`)) || "";
    total = +((x.match(/<playlist [^>]*length="(\d+)"/) || [])[1] || 0);
    D.QUEUE.push(
      ...[...x.matchAll(/<song [^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/song>/g)].map((m) => ({
        id: m[1],
        time: +((m[2].match(/<time>(\d+)<\/time>/) || [])[1] || 0),
      })),
    );
    if (D.QUEUE.length >= total) break;
  }
  const settings = (await get("/Settings")) || "";
  const setAttr = (id, a) =>
    ent((settings.match(new RegExp('<setting id="' + id + '"[^>]*\\s' + a + '="([^"]*)"')) || [])[1] || "");
  D.SET = {
    room: setAttr("zonename", "value"),
    share: setAttr("sharecfg", "description"),
    resizeall: setAttr("resizeall", "value"),
    server: setAttr("server", "value"),
  };
  D.LM = await get("/audioPreset"); // null: player without listening modes
  D.VER = { bluos: stOf(await get("/GitVersion"))("version"), api: stOf(await get("/Version"))("version") };
  // TD-ART: artist of a favourite with albums (artist menu -> albums link on every source, like the app)
  D.ART = "";
  D.ART_ALBUMS = [];
  for (const f of D.FAV) {
    const albums = [];
    for (const svc of D.SVC) {
      const link = itemsOf(await browse(svc + ":MG/LocalMusic-Artist?artist=" + formEnc(f.a))).find(
        (i) => i.type === "link" && /:Album\//.test(i.browseKey || ""),
      );
      if (link) albums.push(...(await albumsOf(link.browseKey)));
    }
    if (albums.length) {
      D.ART = f.a;
      D.ART_ALBUMS = albums;
      break;
    }
  }
  D.FAV_ART = D.ART_ALBUMS.filter((x) => D.FAV.some((f) => f.t === x.text && f.a === x.text2));
  // Statistics of the about popup (summed over the sources like the app)
  D.STAT_LISTS = Object.values(D.MENU).reduce(
    (n, m) => n + itemsOf(m, (i) => /bySection:(Album|Artist|Song|Composer)/.test(i.browseKey || "")).length,
    0,
  );
  D.STATS = {};
  for (const [label, k] of [
    ["Albums", "Album"],
    ["Artists", "Artist"],
    ["Songs", "Song"],
    ["Composers", "Composer"],
  ]) {
    let n = 0,
      any = false;
    for (const svc of D.SVC) {
      const it = itemsOf(D.MENU[svc]).find((i) => new RegExp("bySection:" + k).test(i.browseKey || ""));
      if (!it) continue;
      if (k === "Album") n += sum(D.SECS[svc]);
      else {
        const x = await browse(it.browseKey),
          secs = itemsOf(x, ofType("section"));
        n += secs.length ? sum(secs) : itemsOf(x, (i) => i.type !== "link").length;
      }
      any = true;
    }
    D.STATS[label] = any ? n.toLocaleString("en") : "\u2013";
  }
  D.STATS.Genres = String(D.GEN.length);
  D.STATS.Playlists = String(D.PL.length + D.LPL.length);
  // TD-TERM: a search term from the library (the first word of 3+ letters in an album title)
  D.TERM = (
    [...D.ALL, ...D.FAV.map((f) => ({ text: f.t }))]
      .map((a) => (a.text.match(/[A-Za-z]{3,}/) || [])[0])
      .find(Boolean) || "love"
  ).toLowerCase();
  D.OTHER_ARTIST = "Test Artist"; // test value: track artist that differs from the album artist
  return D;
}
const lmName = (mode) => (TD.LM.match(new RegExp('displayName="([^"]*)" name="' + mode + '"')) || [])[1];

// Year, quality tags and technical data of an album from its songs (/library/v1/Songs), with the
// rules of the album popup: ranges for differing values, "/" for differing formats, no bit depth
// for lossy formats, average bitrate. FORMATS / LOSSY are the app's own constants.
function songDetails(xml, FORMATS, LOSSY) {
  const songs = [...xml.matchAll(/<song ([^>]*)>([\s\S]*?)<\/song>/g)].map((m) => ({
    at: Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]])),
    tag: (t) => ((m[2].match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "").trim(),
  }));
  const uniq = (f) => [...new Set(songs.map(f).filter((v) => v !== ""))];
  const range = (vals, f) => {
    const n = vals
      .map(Number)
      .filter((v) => v > 0)
      .sort((p, q) => p - q);
    return !n.length ? "" : n[0] === n[n.length - 1] ? f(n[0]) : f(n[0]) + "\u2013" + f(n[n.length - 1]);
  };
  const qLabel = (q) =>
    q === "cd" ? "CD" : q === "hd" || q === "hr" ? "HD" : /^mqa/i.test(q) ? "MQA" : /^dolby/i.test(q) ? "Dolby" : "";
  const at = (n) => (s) => s.at[n] || "";
  const fmts = uniq(at("atype")).map((f) => FORMATS[f] || f.toUpperCase());
  const lossy = fmts.every((f) => LOSSY.includes(f));
  const bits = lossy ? "" : range(uniq(at("samplebits")), String);
  const rate = range(uniq(at("samplerate")), (v) => +(v / 1000).toFixed(1) + "");
  const ch = uniq(at("channels"))
    .map((c) => ({ 1: "Mono", 2: "Stereo" })[c] || c + " ch")
    .join(" / ");
  const br = songs.map((s) => +at("bitrate")(s)).filter((v) => v > 0);
  const avg = br.length ? "\u00D8 " + Math.round(br.reduce((p, q) => p + q, 0) / br.length / 1000) + " kbit/s" : "";
  const res = [bits && bits + " bit", rate && rate + " kHz"].filter(Boolean).join(" / ");
  return {
    year: range(
      uniq((s) => s.tag("date")),
      String,
    ),
    tags: uniq((s) => (at("atype")(s) === "mp3" ? "MP3" : qLabel(s.tag("quality")))),
    tech: [fmts.join(" / "), res, ch, avg].filter(Boolean).join(" \u00B7 "),
  };
}
// Seconds -> "m:ss" or "h:mm:ss"
const fmtTime = (n) => {
  const h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60),
    s = n % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
};
const nAlb = (n) => n + (n === 1 ? " album" : " albums");
const nPl = (n, kind) => n + (kind ? " " + kind : "") + (n === 1 ? " playlist" : " playlists");
// Playlists view: names of all tiles (BluOS playlists, then library playlists), status line (the first group) and the
// grid lines of the further groups (like the app's showPlaylists())
const plNames = () => [...TD.PL, ...TD.LPL].map((p) => p.text);
const plGroups = () =>
  [
    [TD.PL, "BluOS"],
    [TD.LPL, "library"],
  ]
    .filter((g) => g[0].length)
    .map(([l, kind]) => nPl(l.length, kind));
const nTr = (n) => n + (n === 1 ? " track" : " tracks");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = (s) => new RegExp(reEsc(s));

// ---------- tiny test harness ----------
// opts.real: "read" = also runs against the real player (changes nothing), "write" = also runs against the
// real player with --write (changes the player; the state is restored afterwards), missing = mock only
// (needs mock answers: errors, delays, patched status, a second player ...).
const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, opts });
class AssertError extends Error {}
const ok = (cond, msg) => {
  if (!cond) throw new AssertError(msg);
};
const eq = (a, b, msg) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
// Request counts: exact with the mock; at least with the real player (longer lists come in several pages)
const eqCount = (a, b, msg) => (REAL ? ok(a >= b, `${msg}: expected at least ${b}, got ${a}`) : eq(a, b, msg));

// Runs in the page (init script of start()): answers every opening of the question popup through answerAsk()
function watchAsk() {
  document.addEventListener("DOMContentLoaded", () => {
    const d = document.querySelector("#askdlg"),
      v = document.querySelector("#askv");
    const text = (sel) => d.querySelector(sel).textContent;
    const answer = async () => {
      if (!d.open) return;
      const q = { type: v.hidden ? "confirm" : "prompt", message: text("#askt"), ok: text("#askok") };
      const a = await window.answerAsk({ ...q, value: v.hidden ? "" : v.value });
      if (a.accept && !v.hidden && a.value != null) v.value = a.value;
      d.querySelector(a.accept ? "#askok" : "#askno").click();
    };
    new MutationObserver(answer).observe(d, { attributes: true, attributeFilter: ["open"] });
  });
}

// Opens the app with a fresh browser profile, connects to the player and waits for the default view.
// opts: connect (false = stay on the start page), storage (localStorage before start; genre and quality chips
// and the search areas Artist and Composer are switched on unless appDefaults or stored), appDefaults (true =
// the app's own defaults: genre, quality and decade chips off, only the search area Album on), locale,
// colorScheme, promptValue / dialog ("accept" | "dismiss") for the question popup, unreachable (every player
// request fails), blockStorage (localStorage throws), and the mock options (usb, playing, listeningModes,
// statusPatch, overrides, mock).
async function start(browser, opts = {}) {
  const player = REAL ? createRecorder(BASE) : createPlayer(opts);
  // Now playing at the start of the test (the real player moves on during a run)
  const st = stOf(REAL ? await player.get("/Status") : TD.STATUS);
  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.scale,
    colorScheme: opts.colorScheme || "light",
    locale: opts.locale,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Question popup of the app (#askdlg, ask(): "confirm" without, "prompt" with a name field): answered as
  // dialogs.mode says (with promptValue in the field, if given), every question is logged
  const dialogs = { mode: opts.dialog || "accept", value: opts.promptValue, log: [] };
  await page.exposeFunction("answerAsk", (q) => {
    dialogs.log.push(q);
    return { accept: dialogs.mode !== "dismiss", value: dialogs.value };
  });
  await page.addInitScript(watchAsk);
  await page.route(`http://${IP}:11000/**`, opts.unreachable ? (r) => r.abort() : player.route);
  // GitHub API (update check): records every request; answers with gh.answer = {status, body} or fails.
  const gh = { urls: [], answer: null, delay: 0 };
  await page.route("https://api.github.com/**", async (r) => {
    gh.urls.push(r.request().url());
    if (gh.delay) await sleep(gh.delay);
    if (!gh.answer) return r.abort();
    return r.fulfill({
      status: gh.answer.status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(gh.answer.body),
    });
  });
  if (opts.blockStorage)
    await page.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      }),
    );
  if (opts.storage)
    await page.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), opts.storage);
  // Most tests use the genre and quality chips and search every area, which are off by default, and expect the album
  // views sorted by title (default: random): set in the fresh profile (only when not stored yet, so a setting changed
  // by the test stays changed after a reload)
  if (!opts.appDefaults && !opts.blockStorage)
    await page.addInitScript(() =>
      Object.entries({
        genrechips: "1",
        qchips: "1",
        "searchin:artist": "1",
        "searchin:composer": "1",
        sort: "title",
      }).forEach(([k, v]) => localStorage.getItem(k) === null && localStorage.setItem(k, v)),
    );
  await page.goto(APP);
  const ready = async () => {
    await page.waitForFunction(() => document.querySelectorAll("#az button").length > 5);
    await page.waitForFunction(() => !/Loading/.test(document.querySelector("#msg").textContent));
  };
  // Connects to `ip` with the settings panel (opens it if needed), wait = wait for the default view
  const connect = async (ip = IP, wait = true) => {
    if (!(await page.isVisible("#cform"))) {
      if (!(await page.$eval("#side", (e) => e.classList.contains("open")))) await page.click("#gear");
      await page.click("#cchg");
    }
    await page.fill("#ip", ip);
    await page.click("#go");
    if (wait) await ready();
  };
  if (opts.connect !== false) {
    await page.fill("#ip", IP);
    await page.click("#go");
    await ready();
  }
  const $$text = (sel) => page.$$eval(sel, (x) => x.map((e) => (e.getAttribute("aria-label") || e.textContent).trim()));
  const tiles = () =>
    page.$$eval("#grid .item", (x) =>
      x.map((e) => e.querySelector("b").textContent).filter((t) => t !== "Random album"),
    );
  const msg = () => page.textContent("#msg");
  const settle = (ms = 400) => page.waitForTimeout(ms * SLOW);
  const chip = (name) =>
    page.click(name === "Favourites" ? '#az button[aria-label="Favourites"]' : `#az button:text-is("${name}")`);
  const waitText = (sel, r) =>
    page.waitForFunction(
      ([s, src]) => new RegExp(src).test(document.querySelector(s)?.textContent || ""),
      [sel, (r instanceof RegExp ? r : re(r)).source],
    );
  const waitMsg = (r) => waitText("#msg", r);
  const waitToast = (r) => waitText("#toast", r);
  const dec = (x) => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x;
    }
  };
  // Decoded requests / commands that match a RegExp
  const reqs = (r) => player.state.requests.map(dec).filter((x) => r.test(x));
  const cmds = (r) => player.state.commands.filter((x) => r.test(x));
  // nth-child index of the grid tile with this title (0 = not found)
  const tileOf = (title) =>
    page.$$eval(
      "#grid .item",
      (x, t) => x.findIndex((e) => e.querySelector(".card:not(.ar) b")?.textContent === t) + 1,
      title,
    );
  const all = async () => {
    await chip("All");
    // All shown: its albums in the grid (a sorted copy of the cached list)
    const done = () =>
      activeKey === "__all" && cache.__all && viewList === cache.__all && shown.length === viewList.length;
    await page.waitForFunction(done, null, {
      timeout: REAL ? 120000 : 30000,
    });
  };
  const openPanel = async () => {
    if (!(await page.$eval("#side", (e) => e.classList.contains("open")))) await page.click("#gear");
  };
  // Shows the search field (hidden at the start) with the search button
  const openSearch = async () => {
    if (!(await page.isVisible("#q"))) await page.click("#sbtn");
  };
  const openQueue = async () => {
    await page.click("#qbtn");
    await page.waitForSelector("#qlist li");
  };
  // Reloads the page. Chrome on the GitHub runners now and then loses the whole localStorage of the test's
  // browser context across a reload (the stored IP is gone too, not only the last write). Then the values
  // stored before the reload are written back and the page is loaded once more, so the test checks the app,
  // not this browser quirk. Every restore is logged.
  const reload = async () => {
    const saved = await page.evaluate(() => ({ ...localStorage }));
    await page.reload();
    if (saved.ip && (await page.evaluate(() => localStorage.getItem("ip"))) === null) {
      console.log("      note: localStorage lost on reload (browser), restored and reloaded");
      await page.evaluate((s) => {
        localStorage.clear();
        Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v));
      }, saved);
      await page.reload();
    }
  };
  // API response popup of a failed player request: checks the title, returns request (without host),
  // status and answer, and closes the popup.
  const apiPopup = async (title) => {
    await page.waitForSelector("#apidlg[open]");
    const [t, u, s, b] = await Promise.all(["#apit", "#apiu", "#apis", "#apib"].map((x) => page.textContent(x)));
    eq(t, title, "popup title");
    await page.click("#apiclose");
    await page.waitForSelector("#apidlg:not([open])", { state: "attached" });
    return { u, s, b };
  };
  return {
    page,
    player,
    st,
    gh,
    errors,
    dialogs,
    $$text,
    tiles,
    msg,
    settle,
    chip,
    waitText,
    waitMsg,
    waitToast,
    reqs,
    cmds,
    tileOf,
    all,
    connect,
    openPanel,
    openQueue,
    openSearch,
    reload,
    apiPopup,
    close: () => ctx.close(),
  };
}

// Opens the popup of an album of the current view picked in the page by `find` (a function source).
const openAlbumBy = (t, find, argv) =>
  t.page.evaluate(([f, a]) => openAlbum(shown.find((x) => new Function("x", "a", "return " + f)(x, a))), [find, argv]);
const openLibAlbum = async (t) => {
  await openAlbumBy(t, "x.key === a.key", TD.ALB_LIB);
  await t.page.waitForSelector("#tracks li button");
};
// Playlists view (Playlists chip); the tile of a BluOS playlist in it (selector, waits until it is drawn)
const openPlaylists = async (t) => {
  await t.page.click("#az .plc");
  await t.waitMsg(/^\d+ (BluOS|library) playlists?$/);
};
const openTile = async (t, name) => {
  await openPlaylists(t);
  const has = (n) => [...document.querySelectorAll("#grid .item b")].some((e) => e.textContent === n);
  await t.page.waitForFunction(has, name);
  const i = await t.page.evaluate(
    // index among all children of the grid (the group lines count for :nth-child too)
    (n) => [...document.querySelector("#grid").children].findIndex((e) => e.querySelector("b")?.textContent === n),
    name,
  );
  return `#grid .item:nth-child(${i + 1})`;
};
// Plays a BluOS playlist with the play button of its tile
const playPlaylist = async (t, name) => {
  const tile = await openTile(t, name);
  await t.page.hover(tile);
  await t.page.click(tile + " .play:not(.addq):not(.favc)");
};
// Opens the popup of a BluOS playlist (cover of its tile) and waits for the tracks
const openPlaylistPopup = async (t, name) => {
  await t.page.click((await openTile(t, name)) + " > .cw > .card");
  await t.page.waitForSelector("#tracks li button");
};
// A track of TD-TRK as the popup shows it: number without dot, title, duration
const trackRow = (x) => [
  (x.text.match(/^(\d+)\./) || [])[1] || "",
  x.text.replace(/^\d+\.\s*/, ""),
  x.duration ? fmtTime(+x.duration) : "",
];
// Track rows of the open popup: [number, title, duration]
const trackRows = (t) =>
  t.page.$$eval("#tracks li.tr", (b) =>
    b.map((x) =>
      [...x.querySelectorAll(":scope > span")]
        .map((s) => s.firstChild?.textContent || "")
        .concat(x.querySelector("i").textContent),
    ),
  );
const R = { real: "read" };
const W = { real: "write" };
// opts.needs: what a test needs on the real player; skipped without it (read-only) or set up first (--write, see prepare())
// usb: a USB drive (a second source), library: a library title playing or paused, queue: at least 3 tracks,
// playlist: a BluOS playlist
const U = { real: "read", needs: ["usb"] };

// ---------- 4.1 Connection & start (CON) ----------
test(
  "CON-01 start page without stored IP: panel open, no request",
  async (t) => {
    await t.settle(800);
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "settings panel open");
    eq(await t.page.inputValue("#ip"), "", "IP field empty");
    ok(await t.page.getAttribute("#ip", "placeholder"), "placeholder");
    ok(await t.page.isVisible("#iphelp"), "help text visible");
    ok(/Connect/.test(await t.msg()), "status line asks to connect");
    eq(t.player.state.requests, [], "no request to the player");
  },
  { ...R, connect: false },
);

test(
  "CON-02 stored IP is restored, no automatic connect",
  async (t) => {
    await t.settle(800);
    eq(await t.page.inputValue("#ip"), IP, "IP restored");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
    eq(t.player.state.requests, [], "no request to the player");
  },
  { ...R, connect: false, storage: { ip: IP } },
);

test(
  "CON-03 CON-04 connect with Enter: views loaded, IP stored, panel closed",
  async (t) => {
    await t.page.fill("#ip", IP);
    await t.page.press("#ip", "Enter");
    await t.page.waitForFunction(() => document.querySelectorAll("#az button").length > 5);
    await t.waitMsg(/in favourites/);
    eq(await t.page.evaluate(() => localStorage.getItem("ip")), IP, "IP stored");
    ok(!(await t.page.$eval("#side", (e) => e.classList.contains("open"))), "panel closed");
    eq(t.reqs(TOP).length, 1, "top menu read");
  },
  { ...R, connect: false },
);

test(
  "CON-05 IP input is normalised (scheme, port and path removed)",
  async (t) => {
    await t.page.fill("#ip", `http://${IP}:11000/x`);
    await t.page.click("#go");
    await t.page.waitForFunction(() => document.querySelectorAll("#az button").length > 5);
    eq(await t.page.inputValue("#ip"), IP, "IP field");
    ok(t.player.state.requests.length > 0, "requests reach the player");
  },
  { ...R, connect: false },
);

test(
  "CON-06 empty IP: error, panel open, IP field focused, no request",
  async (t) => {
    await t.page.click("#go");
    await t.waitMsg("Please enter the IP address of your player.");
    ok(await t.page.$eval("#msg", (e) => e.className === "err"), "shown as error");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
    await t.page.waitForFunction(() => document.activeElement.id === "ip");
    eq(t.player.state.requests, [], "no request");
  },
  { ...R, connect: false },
);

test(
  "CON-07 ERR-07 player not reachable: LAN permission message, popup with the request, IP form stays",
  async (t) => {
    await t.page.fill("#ip", IP);
    await t.page.click("#go");
    const lan = await t.page.evaluate(() => LAN_MSG);
    await t.page.waitForFunction(() => document.querySelector("#msg").className === "err");
    eq(await t.msg(), lan, "LAN message");
    const p = await t.apiPopup("Connecting to the player did not succeed");
    ok(/^\/Browse\?/.test(p.u), "request without host: " + p.u);
    ok(/^No answer/.test(p.s), "no answer: " + p.s);
    eq(p.b, lan, "LAN message as answer");
    ok(await t.page.isVisible("#cform"), "IP form visible");
    ok(await t.page.isVisible("#iphelp"), "help text visible");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
  },
  { ...R, connect: false, unreachable: true },
);

test(
  "CON-08 player without music source: error, panel open",
  async (t) => {
    await t.connect(IP, false);
    await t.waitMsg("No USB or library source found");
    ok(await t.page.$eval("#msg", (e) => e.className === "err"), "shown as error");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
  },
  {
    connect: false,
    overrides: [{ match: TOP, edit: (x) => x.replace(/\s*<item [^>]*(USBIcon|LibraryIcon)[^>]*><\/item>/g, "") }],
  },
);

test(
  "CON-09 compact connection line shows room and IP",
  async (t) => {
    await t.page.click("#gear");
    ok(await t.page.isVisible("#cline"), "connection line visible");
    ok(!(await t.page.isVisible("#cform")), "IP form hidden");
    ok((await t.page.textContent("#cip")).includes(IP), "IP shown");
    eq(await t.page.textContent("#cname"), TD.SET.room, "room name");
  },
  R,
);

test(
  "CON-10 Change shows the IP form with the IP selected",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#cchg");
    ok(await t.page.isVisible("#cform"), "IP form visible");
    ok(!(await t.page.isVisible("#cline")), "connection line hidden");
    ok(
      await t.page.evaluate(() => {
        const i = document.activeElement;
        return i.id === "ip" && i.selectionStart === 0 && i.selectionEnd === i.value.length && i.value.length > 0;
      }),
      "IP field focused and selected",
    );
  },
  R,
);

test(
  "CON-11 room name as tab title",
  async (t) => {
    await t.page.waitForFunction((n) => document.title === n, TD.SET.room);
  },
  R,
);

test("CON-12 changing the player forgets the previous one", async (t) => {
  const second = createPlayer();
  await t.page.route(`http://${IP2}:11000/**`, second.route);
  // a slow "All" of the first player must not show up after the change
  t.player.state.overrides.push({ match: /:S:Album\//, delay: 2500 });
  await t.chip("All");
  await t.openQueue();
  await t.connect(IP2);
  await t.waitMsg(/in favourites/);
  const n1 = t.player.state.requests.length;
  await t.settle(3500);
  eq(t.player.state.requests.length, n1, "no more requests to the first player");
  ok(/in favourites/.test(await t.msg()), "late result of the first player dropped");
  eq(await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"), "true", "default view");
  eq(await t.page.inputValue("#q"), "", "search field empty");
  ok(
    second.state.requests.some((r) => /^\/Playlist\?/.test(r)),
    "queue read from the second player",
  );
  ok((await t.page.textContent("#cip")).includes(IP2), "new IP shown");
});

test(
  "CON-13 ERR-07 player does not answer: timeout, message, popup with the request, IP form stays",
  async (t) => {
    const [limit, noReply] = await t.page.evaluate(() => [CONNECT_TIMEOUT, NO_REPLY_MSG]);
    const t0 = Date.now();
    await t.connect(IP, false);
    await t.page.waitForFunction(() => document.querySelector("#msg").className === "err");
    const took = Date.now() - t0;
    ok(took >= limit - 200 && took < limit + 2000, `message after the timeout (${took} ms)`);
    eq(await t.msg(), noReply, "message");
    const p = await t.apiPopup("Connecting to the player did not succeed");
    ok(/^\/Browse\?/.test(p.u), "request without host: " + p.u);
    ok(/^No answer/.test(p.s), "no answer: " + p.s);
    eq(p.b, noReply, "message as answer");
    ok(await t.page.isVisible("#cform"), "IP form visible");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
  },
  { connect: false, overrides: [{ match: TOP, delay: 10000 }] },
);

test(
  "CON-14 timeout of the previous IP does not disturb the new player",
  async (t) => {
    const second = createPlayer();
    await t.page.route(`http://${IP2}:11000/**`, second.route);
    const limit = await t.page.evaluate(() => CONNECT_TIMEOUT);
    await t.connect(IP, false);
    await t.settle(300);
    // still connecting: the panel is closed, the IP form is shown again when it opens
    await t.page.click("#gear");
    await t.page.fill("#ip", IP2);
    await t.page.click("#go");
    await t.waitMsg(/in favourites/);
    await t.page.waitForTimeout(limit + 1000);
    ok(/in favourites/.test(await t.msg()), "view of the second player stays");
    ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup");
    ok((await t.page.textContent("#cip")).includes(IP2), "second IP shown");
  },
  { connect: false, overrides: [{ match: TOP, delay: 10000 }] },
);

// ---------- 4.2 Music sources (SRC) ----------
test(
  "SRC-01 one switch per source, named by the player, all on",
  async (t) => {
    const rows = await t.page.$$eval("#srcl .srow", (x) =>
      x.map((e) => e.textContent.trim() + "=" + e.querySelector(".sw").getAttribute("aria-checked")),
    );
    eq(
      rows,
      TD.SRC.map((s) => s.text + "=true"),
      "source rows",
    );
  },
  R,
);

test(
  "SRC-02 without USB drive only the library is offered",
  async (t) => {
    const rows = await t.page.$$eval("#srcl .srow", (x) => x.map((e) => e.textContent.trim()));
    eq(
      rows,
      TD.SRC.filter((s) => !/USBIcon/.test(s.image)).map((s) => s.text),
      "source rows",
    );
  },
  { usb: false },
);

test(
  "SRC-03 source switch off -> only the other source",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#srcl .srow:nth-child(2) .sw"); // USB off
    await t.settle(800);
    await t.page.keyboard.press("Escape"); // close the panel
    await t.waitMsg(/favourites/);
    const c = await t.$$text("#az button");
    ok(
      TD.GEN_LIB.every((g) => c.includes(g)) &&
        TD.GEN_USB.filter((g) => !TD.GEN_LIB.includes(g)).every((g) => !c.includes(g)),
      "chips rebuilt from the library",
    );
    await t.chip("New");
    await t.settle();
    ok(!(await t.tiles()).some((x) => TD.NEW_USB.includes(x) && !TD.NEW_LIB.includes(x)), "no USB album");
  },
  U,
);

test("SRC-04 switch state is stored per player", async (t) => {
  await t.page.click("#gear");
  await t.page.click("#srcl .srow:nth-child(2) .sw"); // USB off
  await t.settle(800);
  eq(
    await t.page.evaluate((b) => JSON.parse(localStorage.getItem("srcoff:" + b)), BASE),
    [USB + ":"],
    "stored for this player",
  );
  await t.reload();
  await t.page.click("#go");
  await t.page.waitForFunction(() => document.querySelectorAll("#az button").length > 5);
  const checked = () => t.page.$$eval("#srcl .sw", (x) => x.map((e) => e.getAttribute("aria-checked")));
  eq(await checked(), ["true", "false"], "USB still off after reload");
  const second = createPlayer();
  await t.page.route(`http://${IP2}:11000/**`, second.route);
  await t.connect(IP2);
  eq(await checked(), ["true", "true"], "another player starts with all sources on");
});

test(
  "SRC-05 all sources off: message, no genre chips, Playlists chip stays",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#srcl .srow:nth-child(1) .sw");
    await t.settle(800);
    await t.page.click("#srcl .srow:nth-child(2) .sw");
    await t.waitMsg("No music source enabled. Switch one on in the settings panel.");
    eq(await t.page.$$eval("#az button:not(.plc)", (x) => x.length), 0, "no genre chips");
    eq(await t.$$text("#az .plc"), ["Playlists"], "Playlists chip");
  },
  { ...U, needs: ["usb", "playlist"] },
);

test(
  "SRC-06 two sources with the same name are told apart by their key",
  async (t) => {
    const rows = await t.page.$$eval("#srcl .srow", (x) => x.map((e) => e.textContent.trim()));
    const usb = TD.SRC.find((s) => /USBIcon/.test(s.image));
    ok(rows.includes(`${usb.text} (${USB})`) && rows.includes(`${usb.text} (5E6F_7A8B)`), "rows: " + rows.join(", "));
  },
  {
    overrides: [
      {
        match: TOP,
        edit: (x) =>
          x.replace(
            "</browse>",
            '<item browseKey="5E6F_7A8B:" text="USB" image="/images/USBIcon.png" type="link"></item></browse>',
          ),
      },
    ],
  },
);

// ---------- 4.3 Chips & views (CHP) ----------
test(
  "CHP-01 PLS-01 chip row: special chips, genres of both sources, Playlists chip",
  async (t) => {
    const c = await t.$$text("#az button");
    const lead = await t.page.evaluate(() => QUALITIES.map((q) => q[1]));
    eq(
      c.slice(0, 4 + lead.length),
      ["All", "Favourites", "New", "Playlists", ...lead],
      "special chips, Playlists after New",
    );
    eq(c.slice(4 + lead.length), TD.GEN, "genres of both sources, A-Z");
    const groups = await t.page.$$eval("#az > *", (x) =>
      x.map((e) => (e.matches(".gap") ? "|" : e.matches(".qc") ? "Q" : e.matches(".sp") ? "S" : "G")).join(""),
    );
    eq(groups.replace(/(.)\1+/g, "$1"), "S|Q|G", "separators: special chips | quality | genres");
    eq(await t.page.getAttribute("#az .plc", "title"), "BluOS and library playlists", "tooltip");
    ok(!(await t.page.$("#az .plc svg")), "no icon");
  },
  { ...R, needs: ["playlist"] },
);

test(
  "CHP-02 GRD-01 favourites: default view, tiles with cover, title and artist",
  async (t) => {
    eq(await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"), "true", "favourites chip");
    eq(
      (await t.page.evaluate(() => shown.map((a) => a.t + "|" + a.a))).sort(),
      TD.FAV.map((f) => f.t + "|" + f.a).sort(),
      "favourite albums",
    );
    const tl = await t.page.$$eval("#grid .item:not(:first-child)", (x) =>
      x.map((e) => ({
        t: e.querySelector(".card:not(.ar) b").textContent,
        a: e.querySelector(".card.ar span").textContent,
        label: e.querySelector(".card.ar").getAttribute("aria-label"),
        img: !!e.querySelector(".cov img"),
      })),
    );
    ok(tl.length && tl.every((x) => x.img && x.label === "Albums by " + x.a), "cover and artist button");
    eqCount(
      t.reqs(/^\/library\/v1\/Albums.*category=FAVOURITES/).length,
      TD.SRC.length,
      "library endpoint asked per source",
    );
    ok(/in favourites/.test(await t.msg()), "status line");
    await t.page.click("#grid .item:nth-child(2) .cw .card");
    await t.page.waitForSelector("#dlg[open]");
    eq(await t.page.textContent("#dt"), tl[0].t, "cover opens the popup");
    await t.page.click("#close");
    await t.page.click("#grid .item:nth-child(3) > .card:not(.ar)");
    await t.page.waitForSelector("#dlg[open]");
    eq(await t.page.textContent("#dt"), tl[1].t, "title opens the popup");
  },
  R,
);

const LONG_T = "An Album Title That Is Far Too Long For One Line Of Any Tile";
const LONG_A = "An Artist Name That Is Also Far Too Long For One Line";
// Title and artist of one tile: line height, cut (fades out), running animations, tooltip
const tileLines = (page, i) =>
  page.$$eval(`#grid .item:nth-child(${i}) > .card > *`, (x) =>
    x.map((e) => ({
      lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
      cut: e.classList.contains("cut"),
      running: e.getAnimations({ subtree: true }).length,
      title: e.title,
    })),
  );

test("GRD-11 status line underlined with a fine line as wide as the grid, also with the pinned queue", async (t) => {
  await t.waitMsg(nAlb(TD.FAV.length));
  // left / right of the status line's fine line and of the grid's content box (inside its side padding)
  const edges = () =>
    t.page.evaluate(() => {
      const m = document.querySelector("#stl"),
        g = document.querySelector("#grid");
      const ms = getComputedStyle(m),
        gs = getComputedStyle(g),
        mr = m.getBoundingClientRect(),
        gr = g.getBoundingClientRect();
      return {
        line: ms.borderBottomStyle === "solid" && parseFloat(ms.borderBottomWidth) > 0,
        msg: [Math.round(mr.left), Math.round(mr.right)],
        grid: [Math.round(gr.left + parseFloat(gs.paddingLeft)), Math.round(gr.right - parseFloat(gs.paddingRight))],
      };
    });
  let e = await edges();
  ok(e.line, "fine line under the status line");
  eq(e.msg.join(), e.grid.join(), "line as wide as the grid");
  if (VIEWPORT.width < 800) return; // the queue covers the page instead of being pinned
  await t.openQueue();
  e = await edges();
  eq(e.msg.join(), e.grid.join(), "line as wide as the grid with the pinned queue");
});

test(
  "GRD-10 long title and artist: one line each, fade out, scroll while hovering",
  async (t) => {
    const i =
      (await t.page.$$eval(
        "#grid .item",
        (x, s) => x.findIndex((e) => e.querySelector("b")?.textContent === s),
        LONG_T,
      )) + 1;
    ok(i > 0, "tile with the long title");
    // The ResizeObserver marks cut lines after the next layout: wait for it (slow runners)
    await t.page
      .waitForFunction((n) => document.querySelectorAll(`#grid .item:nth-child(${n}) .cut`).length === 2, i, {
        timeout: 3000,
      })
      .catch(() => {});
    let l = await tileLines(t.page, i);
    eq(
      l.map((x) => x.lines),
      [1, 1],
      "title and artist one line each",
    );
    eq(
      l.map((x) => x.cut),
      [true, true],
      "both cut (fade out)",
    );
    eq(
      l.map((x) => x.running),
      [0, 0],
      "no scrolling without hover",
    );
    // the tile whose longer line (title or artist) is the shortest of the grid
    const s =
      (await t.page.$$eval("#grid .item", (x) => {
        const len = (e) =>
          Math.max(...[...e.querySelectorAll(":scope > .card > *")].map((y) => y.textContent.length), 0);
        return x.reduce((m, e, k) => (len(e) < len(x[m]) ? k : m), 0);
      })) + 1;
    const short = await tileLines(t.page, s);
    eq(
      short.map((x) => x.cut),
      [false, false],
      "short texts not cut",
    );
    await t.page.hover(`#grid .item:nth-child(${i}) .cov`);
    await t.settle(600);
    l = await tileLines(t.page, i);
    eq(
      l.map((x) => x.running),
      [1, 1],
      "hover scrolls title and artist",
    );
    await t.page.mouse.move(1, 1);
    await t.settle(100);
    l = await tileLines(t.page, i);
    eq(
      l.map((x) => x.running),
      [0, 0],
      "scrolling stops after hover",
    );
    await t.page.emulateMedia({ reducedMotion: "reduce" });
    await t.page.hover(`#grid .item:nth-child(${i}) .cov`);
    await t.settle(600);
    l = await tileLines(t.page, i);
    eq(
      l.map((x) => x.running),
      [0, 0],
      "reduced motion: no scrolling",
    );
    eq(
      l.map((x) => x.title),
      [LONG_T, LONG_A],
      "reduced motion: full text as tooltip",
    );
    await t.page.emulateMedia({ reducedMotion: "no-preference" });
  },
  {
    overrides: [
      {
        match: /category=FAVOURITES/,
        edit: (x) => x.replace(/<alb>[^<]*<\/alb>\s*<art>[^<]*<\/art>/, `<alb>${LONG_T}</alb><art>${LONG_A}</art>`),
      },
    ],
  },
);

test(
  "CHP-03 GRD-05 no favourites: message, no tiles",
  async (t) => {
    eq(await t.msg(), "No favourite albums yet.", "status line");
    eq(await t.page.$$eval("#grid .item", (x) => x.length), 0, "no tiles, no random tile");
  },
  { overrides: [{ match: /category=FAVOURITES/, body: '<albums category="FAVOURITES"></albums>' }] },
);

test(
  "CHP-04 new: library + USB, newest first per source",
  async (t) => {
    await t.chip("New");
    await t.waitMsg(/recently added, newest first/);
    eq(await t.page.evaluate(() => shown.map((a) => a.t)), [...TD.NEW_LIB, ...TD.NEW_USB], "order");
    if (TD.NEW_USB.length) ok((await t.tiles()).includes(TD.NEW_USB[0]) || TD.NEW_LIB.length >= 59, "USB album shown");
  },
  R,
);

// Sources with album lists (one request each for a quality, genre or decade list)
const albumSvcs = () => TD.SVC.filter((s) => TD.SECS[s].length);

test(
  "CHP-05 CHP-07 quality CD: one request per source, cached",
  async (t) => {
    await t.chip("CD");
    await t.waitMsg(/CD quality|No CD/);
    const reqs = t.player.state.requests.filter((r) => /quality=cd/.test(r));
    eq(
      reqs.map((r) => new URL("http://x" + r).searchParams.get("service")).sort(),
      albumSvcs().sort(),
      "one request per source",
    );
    ok(
      reqs.every((r) => /[?&]section=all$/.test(r)),
      "every section in one answer",
    );
    eq(t.reqs(/bySection:Album/), [], "album sections not needed");
    eq(await t.page.evaluate(() => shown.length), TD.QCD_COUNT, "as many albums as the lists per section");
    ok((await t.tiles()).length > 0, "albums shown");
    ok(/in CD quality/.test(await t.msg()), "status line");
    await t.all();
    await t.chip("CD");
    await t.settle();
    eq(
      t.player.state.requests.filter((r) => /quality=cd/.test(r)).length,
      reqs.length,
      "second click served from cache",
    );
    eq(t.reqs(/bySection:Album/).length, TD.SRC.length, "album sections asked once per source (by All)");
  },
  R,
);

test(
  "CHP-06 quality HD and MQA: filter values, empty result",
  async (t) => {
    await t.chip("HD");
    await t.waitMsg(/in HD quality|No HD albums/);
    ok(t.reqs(/quality=hr/).length > 0, "HD asks quality=hr");
    await t.chip("MQA");
    await t.waitMsg("No MQA albums.");
    ok(t.reqs(/quality=mqa/).length > 0, "MQA asks quality=mqa");
  },
  { overrides: [{ match: /quality=mqa/, body: "<albums><sections></sections></albums>" }] },
);

test(
  "CHP-08 all: every filled section, progress, A-Z across sources",
  async (t) => {
    await t.page.evaluate(() => {
      window.__msgs = [];
      const m = document.querySelector("#msg");
      new MutationObserver(() => window.__msgs.push(m.textContent)).observe(m, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await t.all();
    const n = TD.FILLED_LIB.length + TD.FILLED_USB.length;
    eqCount(t.reqs(/:S:Album\//).length, n, "one request per filled section (more when a section has several pages)");
    ok(
      (await t.page.evaluate(() => window.__msgs)).some((m) =>
        new RegExp(`^Loading all albums \u2026 \\d+/${n}$`).test(m),
      ),
      "progress n/N",
    );
    // several sources are joined A-Z; one source keeps the order of the player's sections
    if (TD.SRC.length > 1)
      ok(
        await t.page.evaluate(() => shown.every((a, i) => !i || shown[i - 1].t.localeCompare(a.t) <= 0)),
        "sorted A-Z",
      );
    eq(await t.msg(), nAlb(TD.ALL_COUNT), "status line");
    ok((await t.tiles()).length > 0, "albums shown");
  },
  R,
);

test(
  "CHP-09 CHP-10 CHP-11 genre: one request, the albums and URLs of /Browse, only its sources, cached",
  async (t) => {
    await t.chip(TD.GEN_ONE);
    await t.waitMsg(" in the genre " + TD.GEN_ONE);
    ok((await t.tiles()).length > 0, "albums shown");
    const n = await t.page.evaluate(() => shown.length);
    eq(await t.msg(), nAlb(n) + " in the genre " + TD.GEN_ONE, "status line with the genre");
    const reqs = t.player.state.requests.filter((r) => /[?&]genre=/.test(r));
    const par = TD.GENRE_KEYS[TD.LIB][TD.GEN_LIB.indexOf(TD.GEN_ONE)].match(/[?&](genre=[^&]*)/)[1];
    eq(reqs, [`/library/v1/Albums?service=${TD.LIB}&${par}&section=all`], "one request, to the library only");
    const byKey = (x, y) => (x[0] < y[0] ? -1 : 1);
    eq(
      (await t.page.evaluate(() => shown.map((a) => [a.key, a.t, a.a, a.cm, a.play, a.img]))).sort(byKey),
      TD.GEN_ALB.map((i) => [i.browseKey, i.text, i.text2, i.contextMenuKey, i.playURL, i.image]).sort(byKey),
      "albums, favourite state and URLs as in /Browse",
    );
    // covers (/Artwork) are read again for the new tiles, the album lists are not
    const lists = () => t.reqs(/^\/(Browse|library)/).length;
    await t.all();
    const m = lists();
    await t.chip(TD.GEN_ONE);
    await t.waitMsg(" in the genre " + TD.GEN_ONE);
    eq(lists(), m, "second click from the session cache");
  },
  R,
);

test("CHP-12 outdated result is dropped, All stops loading", async (t) => {
  t.player.state.overrides.push({ match: /:S:Album\//, delay: 1500 });
  await t.chip("All");
  await t.settle(100);
  await t.chip("New");
  await t.waitMsg(/recently added/);
  await t.settle(3000);
  ok(/recently added/.test(await t.msg()), "New still shown");
  eq(await t.page.getAttribute('#az button:text-is("New")', "aria-pressed"), "true", "New selected");
  eq(await t.page.evaluate(() => shown.length), TD.NEW_LIB.length + TD.NEW_USB.length, "albums of New");
  ok(t.reqs(/:S:Album\//).length <= 3, "All stopped after the running requests");
});

test(
  "CHP-13 selecting a chip clears the search",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    await t.chip("New");
    await t.waitMsg(/recently added/);
    eq(await t.page.inputValue("#q"), "", "search field empty");
    eq(await t.page.getAttribute('#az button:text-is("New")', "aria-pressed"), "true", "chip pressed");
  },
  R,
);

test("CHP-14 ERR-07 loading error: status line and popup with request, status and answer", async (t) => {
  t.player.state.overrides.push({ match: /recent=1/, status: 500, body: "Test failure" });
  await t.chip("New");
  await t.waitMsg("Loading failed: Player responded with 500");
  ok(await t.page.$eval("#msg", (e) => e.className === "err"), "shown as error");
  const p = await t.apiPopup("Loading the albums did not succeed");
  ok(/^\/library\/v1\/Albums\?.*recent=1/.test(p.u), "request without host: " + p.u);
  ok(/^500/.test(p.s), "HTTP 500");
  eq(p.b, "Test failure", "answer");
});

test("CHP-18 outdated genre failure is dropped: another chip, another source selection", async (t) => {
  let late = t.player.state.hold(/[?&]genre=/, 500);
  await t.chip(TD.GEN_ONE);
  await late.asked();
  await t.chip("New");
  await t.waitMsg(/recently added/);
  await late.release();
  await t.settle(300);
  ok(/recently added/.test(await t.msg()), "status line of New");
  eq(await t.page.$("#apidlg[open]"), null, "no error popup over New");
  // the same genre again after the sources were opened again: the first request is outdated
  late = t.player.state.hold(/[?&]genre=/, 500);
  await t.chip(TD.GEN_ONE);
  await late.asked();
  await t.page.evaluate(() => openSources());
  await t.chip(TD.GEN_ONE);
  await t.waitMsg(/ in the genre /);
  await late.release();
  await t.settle(300);
  ok(/ in the genre /.test(await t.msg()), "status line of the genre");
  eq(await t.page.$("#apidlg[open]"), null, "no error popup over the new selection");
});

test("CHP-19 outdated failure is dropped: All, favourite state of an artist; a current failure stays", async (t) => {
  const artist = await t.page.evaluate(() => shown[0].a);
  const leave = async (match, start) => {
    const late = t.player.state.hold(match, 500);
    await start();
    await late.asked();
    await t.chip("New");
    await t.waitMsg(/recently added/);
    await late.release();
    await t.settle(300);
    ok(/recently added/.test(await t.msg()), "status line of New: " + match);
    eq(await t.page.$("#apidlg[open]"), null, "no error popup over New: " + match);
  };
  await leave(/bySection:Album/, () => t.chip("All"));
  await leave(/:S:Album\//, () => t.chip("All"));
  await leave(/CM\/LocalMusic-Album/, () => t.page.evaluate((a) => void showArtist(a), artist));
  // All still selected: the requests that still run must not write their progress over the error
  t.player.state.overrides.push({ match: /:S:Album\//, status: 500, delay: 100, times: 1 });
  t.player.state.overrides.push({ match: /:S:Album\//, delay: 300 });
  await t.chip("All");
  await t.page.waitForSelector("#apidlg[open]");
  await t.settle(1500);
  eq(await t.msg(), "Loading failed: Player responded with 500", "error of All stays");
});

test("CHP-20 another source selection: late answer and failure of the previous one are dropped", async (t) => {
  let late = t.player.state.hold(/category=FAVOURITES/, 500);
  await t.chip("Favourites");
  await late.asked();
  await t.page.evaluate(() => openSources());
  await t.waitMsg(/in favourites/);
  await late.release();
  await t.settle(300);
  ok(/in favourites/.test(await t.msg()), "status line of the new selection");
  eq(await t.page.$("#apidlg[open]"), null, "no error popup over the new selection");
  late = t.player.state.hold(/quality=cd/);
  await t.chip("CD");
  await late.asked();
  await t.page.evaluate(() => openSources());
  await late.release();
  await t.settle(300);
  ok(!(await t.page.evaluate(() => "__q:cd" in cache)), "old list not cached for the new selection");
});

// Chip label of a decade like the app: "1980" -> "80s", the full decade when two decades share the short form
const decLabel = (k) => (TD.DEC.filter((x) => x.slice(2) === k.slice(2)).length > 1 ? k : k.slice(2)) + "s";
const decadeReqs = (t) => t.reqs(/^\/library\/v1\/Albums\?.*section=all&length=1&sort=decade$/);
// Section requests without a filter (the years of the decade chips)
const yearReqs = (t) =>
  t.reqs(/^\/library\/v1\/Albums\?/).filter((r) => /[?&]section=/.test(r) && !/[?&](quality|sort|genre)=/.test(r));

test(
  "CHP-15 SET-02 quality, decade and genre chips are off by default: special chips and Playlists, no decade request",
  async (t) => {
    await t.openPanel();
    for (const [s, v] of [
      ["#qsw", "false"],
      ["#dsw", "false"],
      ["#gsw", "false"],
    ])
      eq(await t.page.getAttribute(s, "aria-checked"), v, s);
    await t.settle();
    eq(
      await t.page.$$eval("#az > button", (x) =>
        x.filter((e) => e.offsetParent).map((e) => e.getAttribute("aria-label") || e.textContent),
      ),
      ["All", "Favourites", "New", "Playlists"],
      "visible chips",
    );
    eq(await t.page.$$("#az .dc"), [], "no decade chips");
    eq(decadeReqs(t).length, 0, "no decade request");
  },
  { ...R, appDefaults: true },
);

test(
  "CHP-16 SET-02 SET-03 decade chips switched on: decades of every source after the quality chips, stored",
  async (t) => {
    await t.openPanel();
    await t.page.click("#dsw");
    await t.page.waitForSelector("#az .dc");
    eq(decadeReqs(t).length, TD.SVC.filter((s) => TD.SECS[s].length).length, "one decade index request per source");
    eq(t.reqs(/^\/ui\//), [], "no /ui request (endpoints of the BluOS Controller app)");
    const c = await t.$$text("#az button");
    const lead = await t.page.evaluate(() => QUALITIES.map((q) => q[1]));
    const at = c.indexOf(lead[lead.length - 1]) + 1;
    eq(c.slice(at, at + TD.DEC.length), TD.DEC.map(decLabel), "decade chips after the quality chips");
    eq(
      await t.page.$$eval("#az .dc", (x) => x.map((e) => e.title)),
      TD.DEC.map((k) => `Albums from the ${k}s`),
      "tooltips",
    );
    ok(await t.page.$("#az .dcg + .dc"), "separator before the decade chips");
    eq(yearReqs(t).length, 0, "no album request before a decade is clicked");
    await t.page.click("#dsw");
    eq(await t.page.$$eval("#az .dc", (x) => x.filter((e) => e.offsetParent).length), 0, "switched off: hidden");
    await t.page.click("#dsw");
    await t.reload();
    await t.settle(200);
    eq(await t.page.getAttribute("#dsw", "aria-checked"), "true", "remembered");
    await t.connect();
    await t.page.waitForSelector("#az .dc");
    eq(
      await t.page.$$eval("#az .dc", (x) => x.map((e) => e.textContent)),
      TD.DEC.map(decLabel),
      "chips after reconnecting",
    );
  },
  R,
);

test(
  "CHP-17 decade: albums of the decade from one request per source, cached",
  async (t) => {
    await t.page.waitForSelector("#az .dc");
    const of = (k) => TD.YEARS.filter((a) => a.y.slice(0, 3) + "0" === k);
    const first = TD.DEC[0],
      last = TD.DEC[TD.DEC.length - 1];
    await t.chip(decLabel(first));
    await t.waitMsg(/^\d+ albums? from the \d{4}s$/);
    eq(yearReqs(t).length, albumSvcs().length, "one request per source");
    ok(
      yearReqs(t).every((r) => /[?&]section=all$/.test(r)),
      "every section in one answer",
    );
    eq(await t.msg(), nAlb(of(first).length) + ` from the ${first}s`, "status line");
    eq(
      (await t.page.evaluate(() => shown.map((a) => a.t))).sort(),
      of(first)
        .map((a) => a.t)
        .sort(),
      "albums of the decade",
    );
    eq(await t.page.getAttribute(`#az .dc:text-is("${decLabel(first)}")`, "aria-pressed"), "true", "chip pressed");
    const n = yearReqs(t).length;
    await t.chip(decLabel(last));
    await t.waitMsg(new RegExp(`^\\d+ albums? from the ${last}s$`));
    eq(yearReqs(t).length, n, "second decade served from cache");
    eq(await t.page.evaluate(() => shown.length), of(last).length, "albums of the other decade");
  },
  { ...R, storage: { decadechips: "1" } },
);

// Every album of the library (section=all without a filter) for the year sort of All (CHP-21): the mock's albums of
// All (fixture 07) with a year, the last one without; the real player answers its own list (TD-YEARS).
const ALL_YEARS = [...fx("07").matchAll(/<item [^>]*type="album">/g)].map(([it], i, l) => {
  const val = (n) => (it.match(new RegExp(` ${n}="([^"]*)"`)) || [])[1] || "";
  return { t: val("text"), a: val("text2"), y: i === l.length - 1 ? "" : String(1960 + ((i * 7) % 60)) };
});
const allYears = () => {
  const albums = ALL_YEARS.map(
    (x) => `<album tracks="9"${x.y ? ` date="${x.y}"` : ""}><title>${x.t}</title><art>${x.a}</art></album>`,
  );
  return `<albums section="all" service="LocalMusic"><sections><section name="#">${albums.join("")}</section></sections></albums>`;
};

test(
  "CHP-21 sort order: default random, every order, years for All, New keeps its order, stored, hidden in search",
  async (t) => {
    const albums = () => t.page.evaluate(() => shown.map((a) => ({ t: a.t, a: a.a, y: a.y })));
    const sorted = (l, cmp) => l.every((x, i) => !i || cmp(l[i - 1], x) <= 0);
    const by = (k, dir) => (x, y) => dir * x[k].localeCompare(y[k]);
    const yr = (a) => +a.y || 0;
    const year = (dir) => (x, y) => !yr(x) - !yr(y) || dir * (yr(x) - yr(y));
    const pick = async (v) => {
      await t.page.selectOption("#sort", v);
      await t.page.waitForFunction(() => shown.length === viewList.length);
    };
    // Artist line of the rendered tiles: "<year> · <artist>" (years: album artist and year orders), else the artist
    const artistLines = async (years) => {
      const got = await t.page.$$eval("#grid .item:not(:first-child) > :last-child", (x) =>
        x.map((e) => e.textContent),
      );
      const want = (await albums()).slice(0, got.length).map((a) => (years && a.y ? a.y + " \u00b7 " : "") + a.a);
      return [got, want];
    };
    // Default view Favourites: random, every order of SORTS, status line unchanged
    await t.waitMsg(/in favourites/);
    ok(await t.page.isVisible("#sort"), "sort order shown");
    eq(await t.page.inputValue("#sort"), "random", "default random");
    eq(
      await t.page.$$eval("#sort option", (x) => x.map((o) => o.textContent)),
      await t.page.evaluate(() => SORTS.map((s) => s[1])),
      "options",
    );
    eq((await albums()).map((a) => a.t).sort(), TD.FAV.map((f) => f.t).sort(), "random: every favourite");
    const text = await t.msg();
    await pick("title");
    ok(sorted(await albums(), by("t", 1)), "album title A-Z");
    let [got, want] = await artistLines(false);
    eq(got, want, "title order: no year on the tiles");
    await pick("title-desc");
    ok(sorted(await albums(), by("t", -1)), "album title Z-A");
    // Favourites have no years: looked up once from every album of the enabled sources (1 request per source)
    await pick("artist");
    eq(yearReqs(t).length, albumSvcs().length, "years: one request per source");
    const artistYear = (dir) => (x, y) => by("a", dir)(x, y) || year(1)(x, y);
    ok(sorted(await albums(), artistYear(1)), "album artist A-Z, an artist's albums by year");
    [got, want] = await artistLines(true);
    eq(got, want, "artist order: year in front of the artist");
    await pick("artist-desc");
    ok(sorted(await albums(), artistYear(-1)), "album artist Z-A");
    eq(await t.msg(), text, "status line unchanged");
    eq(await t.page.evaluate(() => localStorage.getItem("sort")), "artist-desc", "stored");
    // All has no years either: taken from the cached list
    await t.all();
    await pick("year-desc");
    let l = await albums();
    ok(sorted(l, year(-1)), "year, newest first; without a year last");
    // the year of every album of All that has one (by title; titles with two years are left out)
    const ys = new Map(),
      twice = new Set();
    const years = REAL ? TD.YEARS : ALL_YEARS.filter((a) => a.y).map((a) => ({ t: ent(a.t), y: a.y }));
    years.forEach((a) => (ys.has(a.t) && ys.get(a.t) !== a.y ? twice.add(a.t) : ys.set(a.t, a.y)));
    const known = l.filter((a) => ys.has(a.t) && !twice.has(a.t));
    ok(known.length > 0, "albums of All with a year");
    eq(
      known.map((a) => a.y),
      known.map((a) => ys.get(a.t)),
      "years of All",
    );
    [got, want] = await artistLines(true);
    eq(got, want, "year order: year in front of the artist");
    ok(got[0].includes("\u00b7"), "newest album with its year");
    await pick("year");
    ok(sorted(await albums(), year(1)), "year, oldest first");
    eq(yearReqs(t).length, albumSvcs().length, "years asked once");
    // New: the player's order, the sort order disabled
    await t.chip("New");
    await t.waitMsg(/recently added, newest first/);
    eq(await t.page.evaluate(() => shown.map((a) => a.t)), [...TD.NEW_LIB, ...TD.NEW_USB], "New: newest first");
    ok(await t.page.isDisabled("#sort"), "disabled in New");
    eq(await t.page.$eval("#sort", (s) => s.selectedOptions[0].textContent), "Newest added", "New: newest added");
    // Search results and Playlists: no sort order; clearing the search shows it again
    await t.chip("Favourites");
    await t.waitMsg(/in favourites/);
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with “/);
    ok(!(await t.page.isVisible("#sort")), "hidden in the search results");
    await t.page.fill("#q", "");
    await t.page.press("#q", "Enter");
    await t.page.waitForSelector("#sort:not([hidden])");
    eq(await t.page.inputValue("#sort"), "year", "shown again after the search");
    await t.chip("Playlists");
    await t.settle(200);
    ok(!(await t.page.isVisible("#sort")), "hidden in Playlists");
    // Stored: restored after reload + connect
    await t.reload();
    await t.connect();
    await t.waitMsg(/in favourites/);
    eq(await t.page.inputValue("#sort"), "year", "remembered");
    l = await albums();
    ok(sorted(l, year(1)), "favourites by year after reconnecting");
  },
  {
    ...R,
    appDefaults: true,
    overrides: [{ match: /^\/library\/v1\/Albums\?service=LocalMusic&section=all$/, body: allYears() }],
  },
);

test(
  "CHP-22 library changed: session caches dropped, chips and playlists read again, the view stays; own heart, rescan",
  async (t) => {
    const check = /^\/library\/v1\/Albums\?service=LocalMusic&section=all&length=1$/;
    const cdCached = () => t.page.evaluate(() => "__q:cd" in cache);
    const cdAgain = async () => {
      await t.chip("CD");
      await t.waitMsg(/CD quality/);
      await t.chip("Favourites");
      await t.waitMsg(/in favourites/);
    };
    // Waits for k more /Status requests (the long poll asks again once an answer is shown)
    const polls = async (k) => {
      const n = t.reqs(/^\/Status/).length;
      while (t.reqs(/^\/Status/).length < n + k) await t.settle(100);
    };
    await cdAgain();
    const tiles = await t.tiles();
    // A favourite changed in another client, then the window gets the focus again
    t.player.state.libId += 65536;
    const genres = t.reqs(/GG\/Genres/).length,
      lists = t.reqs(/key=BluOS:$/).length;
    await t.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await t.page.waitForFunction(() => !("__q:cd" in cache));
    eq(t.reqs(check).length, 1, "one request for the library id");
    await t.settle();
    ok(t.reqs(/GG\/Genres/).length > genres, "genre chips read again");
    ok(t.reqs(/key=BluOS:$/).length > lists, "playlists read again");
    eq(await t.tiles(), tiles, "the view stays");
    eq(await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"), "true", "chip stays pressed");
    await t.page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await t.settle();
    eq(t.reqs(check).length, 1, "no second check within a minute");
    // Own heart: the next id is taken without dropping anything
    await cdAgain();
    const tile = "#grid .item:nth-child(2)";
    await t.page.hover(tile);
    await t.page.click(tile + " .favc");
    await t.waitToast(/favourites/);
    await t.chip("New");
    await t.waitMsg(/recently added/);
    ok(await cdCached(), "own favourite change keeps the caches");
    // Rescan: <indexing> counts, then 0 again with a new library id
    t.player.state.statusPatch.indexing = "500";
    await polls(2);
    ok(await cdCached(), "no check while indexing");
    t.player.state.libId = 41;
    t.player.state.statusPatch.indexing = "0";
    await t.page.waitForFunction(() => !("__q:cd" in cache));
    eq(t.reqs(check).length, 2, "library id read again when the rescan ended");
  },
);

// ---------- 4.4 Album grid (GRD) ----------
test(
  "GRD-02 random album tile first, number of albums, no popup",
  async (t) => {
    eq(await t.page.textContent("#grid .item:first-child b"), "Random album", "first tile");
    eq(await t.page.textContent("#grid .item:first-child span"), "from " + nAlb(TD.FAV.length), "number of albums");
    await t.page.click("#grid .item:first-child .card");
    await t.settle(300);
    ok(!(await t.page.$("#dlg[open]")), "no popup");
  },
  R,
);

test(
  "GRD-03 random album: play button picks from the view",
  async (t) => {
    await t.page.hover("#grid .item:first-child");
    await t.page.click("#grid .item:first-child .play:not(.addq)");
    await t.waitToast(/^Playing: .+ \u2013 .+$/);
    const plays = await t.page.evaluate(() => shown.map((a) => decodeURIComponent(a.play)));
    ok(
      t.cmds(/^\/Add\?playnow=1/).some((c) => plays.includes(c)),
      "play command of an album of the view",
    );
    await t.settle(1200);
    eq(
      t.player.state.requests.filter((x) => /^\/Status$|^\/Volume$/.test(x)),
      [],
      "no one-off /Status or /Volume after the command (long polling reports the change)",
    );
  },
  W,
);

test(
  "GRD-04 random album: add last, album without queue URL",
  async (t) => {
    await t.page.hover("#grid .item:first-child");
    await t.page.click("#grid .item:first-child .addq");
    await t.waitToast(/^Added to queue: .+ \u2013 .+$/);
    eq(t.cmds(/where=last/).length, 1, "add last sent");
    await t.page.evaluate(() =>
      render([
        {
          t: "Test album",
          a: "Test artist",
          n: "",
          img: "",
          key: "LocalMusic:x",
          cm: "",
          play: "/Add?test=1",
          menu: {},
        },
      ]),
    );
    await t.page.hover("#grid .item:first-child");
    await t.page.click("#grid .item:first-child .addq");
    await t.waitToast("Could not add Test album");
    eq(t.cmds(/where=last/).length, 1, "nothing sent");
  },
  W,
);

test(
  "GRD-06 lazy rendering in batches of 60",
  async (t) => {
    // The view is rendered five times over, so it has more than one batch; a large window fills itself
    // with more than one batch, so only whole batches and not everything are expected
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
  },
  R,
);

test(
  "GRD-07 cover hover buttons: play, add last, heart",
  async (t) => {
    const tile = "#grid .item:nth-child(2)";
    await t.page.hover(tile);
    ok(await t.page.isVisible(tile + " .play:not(.addq):not(.favc)"), "play");
    ok(await t.page.isVisible(tile + " .addq"), "add last");
    ok(await t.page.isVisible(tile + " .favc"), "heart");
  },
  R,
);

test(
  "GRD-08 GRD-09 cover buttons: play the album, add it last",
  async (t) => {
    const tile = "#grid .item:nth-child(2)";
    const a = await t.page.evaluate(() => ({ t: shown[0].t, play: decodeURIComponent(shown[0].play) }));
    await t.page.hover(tile);
    await t.page.click(tile + " .play:not(.addq):not(.favc)");
    await t.waitToast("Playing: " + a.t);
    ok(t.player.state.commands.includes(a.play), "play URL of the album");
    await t.page.click(tile + " .addq");
    await t.waitToast("Added to queue: " + a.t);
    eq(t.cmds(/where=last/).length, 1, "add last sent");
  },
  W,
);

// ---------- 4.5 Favourites (FAV) ----------
test(
  "FAV-01 favourite shows a filled heart",
  async (t) => {
    const tile = "#grid .item:nth-child(2)";
    const title = await t.page.textContent(tile + " .card:not(.ar) b");
    await t.page.hover(tile);
    eq(await t.page.getAttribute(tile + " .favc", "aria-pressed"), "true", "filled heart");
    eq(await t.page.getAttribute(tile + " .favc", "aria-label"), "Remove from favourites: " + title, "label");
  },
  R,
);

test(
  "FAV-02 FAV-06 remove a favourite via the player, no local storage",
  async (t) => {
    const tile = "#grid .item:nth-child(2)";
    await t.page.hover(tile);
    await t.page.click(tile + " .favc");
    await t.waitToast("Removed from favourites");
    eq(t.cmds(/^\/DeleteFavourite/).length, 1, "DeleteFavourite sent");
    await t.page.waitForFunction(
      (s) => document.querySelector(s).getAttribute("aria-pressed") === "false",
      tile + " .favc",
    );
    const cm = t.reqs(/CM\/LocalMusic-Album/);
    ok(cm.length === 1 && !/isFavourite=1/.test(cm[0]), "context menu read again without isFavourite=1");
    eq(
      await t.page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fav:"))),
      [],
      "no local favourites",
    );
    if (REAL) {
      // add the favourite again
      await t.page.click(tile + " .favc");
      await t.waitToast("Added to favourites");
    }
  },
  W,
);

test(
  "FAV-03 add a favourite via the player",
  async (t) => {
    await t.all();
    // a library album among the rendered tiles that is no favourite
    const i = await t.page.evaluate(
      (lib) => shown.findIndex((a, k) => k < 60 && a.key.startsWith(lib) && a.menu["favourite-add"]) + 2,
      TD.LIB,
    );
    ok(i > 1, "library album that is no favourite");
    const heart = `#grid .item:nth-child(${i}) .favc`;
    await t.page.hover(`#grid .item:nth-child(${i})`);
    eq(await t.page.getAttribute(heart, "aria-pressed"), "false", "empty heart");
    await t.page.click(heart);
    await t.waitToast("Added to favourites");
    eq(t.cmds(/^\/AddFavourite/).length, 1, "AddFavourite sent");
    await t.page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-pressed") === "true", heart);
    eq(t.reqs(/CM\/LocalMusic-Album.*isFavourite=1/).length, 1, "context menu read again with isFavourite=1");
    if (REAL) {
      // remove the favourite again
      await t.page.click(heart);
      await t.waitToast("Removed from favourites");
    }
  },
  W,
);

test(
  "FAV-04 USB album has no heart",
  async (t) => {
    await t.chip("New");
    await t.settle();
    const i = await t.page.evaluate((usb) => shown.findIndex((a) => usb && a.key.startsWith(usb)), TD.USB);
    ok(i >= 0, "USB album in New");
    const tile = "#grid .item:nth-child(" + (i + 2) + ")";
    // the grid renders tiles while scrolling: scroll to the last tile until the USB album is there
    for (let n = 0; n < 50 && !(await t.page.$(tile)); n++) {
      await t.page.evaluate(() => [...document.querySelectorAll("#grid .item")].pop()?.scrollIntoView());
      await sleep(200);
    }
    await t.page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), tile);
    await t.page.hover(tile);
    ok(!(await t.page.isVisible(tile + " .favc")), "heart hidden");
  },
  U,
);

test("FAV-05 failed toggle: popup, heart unchanged", async (t) => {
  t.player.state.overrides.push({ match: /^\/DeleteFavourite/, status: 500 });
  const tile = "#grid .item:nth-child(2)";
  await t.page.hover(tile);
  await t.page.click(tile + " .favc");
  const p = await t.apiPopup("The player command did not succeed");
  ok(/^\/DeleteFavourite\?/.test(p.u), "request: " + p.u);
  eq(await t.page.getAttribute(tile + " .favc", "aria-pressed"), "true", "heart unchanged");
});

// ---------- 4.6 Artist view (ART) ----------
test(
  "ART-01 ART-02 ART-04 artist: albums via the artist's browse menu, favourites marked, cached",
  async (t) => {
    ok(TD.ART, "a favourite whose artist has albums");
    const tile = await t.page.$$eval(
      "#grid .item",
      (x, a) => x.findIndex((e) => e.querySelector(".card.ar span")?.textContent === a),
      TD.ART,
    );
    ok(tile > 0, "artist tile in the favourites");
    const before = t.player.state.requests.length;
    await t.page.click(`#grid .item:nth-child(${tile + 1}) .card.ar`);
    await t.waitMsg(/^\d+ albums? by /);
    eq(await t.msg(), nAlb(TD.ART_ALBUMS.length) + " by " + TD.ART, "status line");
    const albums = await t.page.evaluate(() =>
      shown.map((a) => ({ t: a.t, a: a.a, fav: favOf(a).on, ok: !!(a.play && a.menu["addAll-last"]) })),
    );
    eq(albums.map((a) => a.t).sort(), TD.ART_ALBUMS.map((a) => a.text).sort(), "albums of the artist");
    ok(
      albums.every((a) => a.a === TD.ART && a.ok),
      "only albums of the artist, play and queue URLs from the player",
    );
    const r = t.player.state.requests.slice(before).map((x) => decodeURIComponent(x));
    eq(
      r.filter((x) => /bySection:Album|S:Album\//.test(x)),
      [],
      "All list not loaded",
    );
    eqCount(
      r.filter((x) => /^\/Browse/.test(x) && !/CM\/LocalMusic-Album/.test(x)).length,
      2 * TD.SRC.length,
      "artist menu + albums link per source",
    );
    // The artist list does not mark favourites (Bruno E17): the app compares with the player's favourites
    // (library only) and reads the context menu of each favourite with &isFavourite=1.
    eq(
      r.filter((x) => /^\/library\/v1\/Albums\?/.test(x) && !/start=/.test(x)),
      [`/library/v1/Albums?service=${TD.LIB}&category=FAVOURITES`],
      "favourites of the library asked once",
    );
    eq(
      r.filter((x) => /CM\/LocalMusic-Album/.test(x)).sort(),
      TD.FAV_ART.map(
        (a) =>
          "/Browse?withContextMenuItems=1&key=" + a.contextMenuKey.replace(/&isFavourite=1/, "") + "&isFavourite=1",
      ).sort(),
      "context menu read only for the favourites",
    );
    eq(
      albums
        .filter((a) => a.fav)
        .map((a) => a.t)
        .sort(),
      TD.FAV_ART.map((a) => a.text).sort(),
      "favourites marked, the others not",
    );
    const fav = TD.FAV_ART[0];
    const i = await t.tileOf(fav.text);
    await t.page.hover(`#grid .item:nth-child(${i})`);
    eq(await t.page.getAttribute(`#grid .item:nth-child(${i}) .favc`, "aria-pressed"), "true", "filled heart");
    ok(
      await t.page.evaluate(
        (x) => /^\/DeleteFavourite/.test(shown.find((a) => a.t === x).menu["favourite-delete"] || ""),
        fav.text,
      ),
      "remove URL from the player's context menu",
    );
    await t.chip("New");
    await t.settle();
    const n = t.player.state.requests.length;
    await t.page.evaluate((a) => showArtist(a), TD.ART);
    await t.waitMsg(/^\d+ albums? by /);
    eq(
      t.player.state.requests.slice(n).filter((x) => /^\/Browse/.test(x)).length,
      0,
      "second time from the session cache",
    );
  },
  R,
);

test(
  "ART-03 artist link in the popup closes it and shows the artist",
  async (t) => {
    await t.page.evaluate(() => scrollTo(0, 200));
    await t.all();
    await openLibAlbum(t);
    await t.page.click("#da button");
    await t.waitMsg(" by " + TD.ALB_LIB.a);
    ok(!(await t.page.$("#dlg[open]")), "popup closed");
    eq(await t.page.evaluate(() => scrollY), 0, "scrolled to the top");
  },
  R,
);

// ART-05: an album artist with commas is several artists: one link each, which searches the artists
test(
  "ART-05 several artists (comma): one link each in the tile and the popup, each searches the artist",
  async (t) => {
    const multi = "Harold Budd ,Brian Eno, Earth";
    const title = await t.page.evaluate((m) => {
      shown[0].a = m;
      render(shown);
      return shown[0].t;
    }, multi);
    const tile = `#grid .item:nth-child(${await t.tileOf(title)})`;
    eq(
      await t.page.textContent(tile + " .card.ar"),
      "Harold Budd, Brian Eno, Earth",
      "artist line: names, comma and space",
    );
    eq(
      await t.page.$$eval(tile + " .card.ar button", (b) => b.map((x) => x.textContent)),
      ["Harold Budd", "Brian Eno", "Earth"],
      "one link per artist in the tile",
    );
    ok(!(await t.page.$(tile + " button.card.ar")), "no link for the whole name");
    const chips = () =>
      t.page.$$eval("#sin button", (x) => x.map((e) => e.textContent + ":" + e.getAttribute("aria-pressed")));
    eq((await chips()).join(), "Album:true,Artist:false,Composer:false", "Artist area off before");
    await t.page.click(tile + ' .card.ar button:text-is("Brian Eno")');
    await t.waitMsg("“Brian Eno”");
    ok(await t.page.isVisible("#qbox"), "search field shown");
    eq(await t.page.inputValue("#q"), "Brian Eno", "the artist in the search field");
    eq((await chips()).join(), "Album:false,Artist:true,Composer:false", "only the Artist area on");
    eq(
      await t.page.evaluate(() => ["title", "artist", "composer"].map((k) => localStorage.getItem("searchin:" + k))),
      ["0", "1", "0"],
      "areas stored",
    );
    eq(t.reqs(/[?&]q=Brian Eno(&|$)/).length, TD.SRC.length, "one search per source");
    // Album popup: the same links; a link closes the popup and searches only the Artist area again
    await t.page.press("#q", "Escape");
    await t.waitMsg(/^\d+ albums?/);
    await t.openSearch();
    await t.page.click('#sin button:text-is("Album")');
    await t.page.click('#sin button:text-is("Composer")');
    await t.page.press("#q", "Escape");
    await t.page.evaluate(() => openAlbum(shown[0]));
    await t.page.waitForSelector("#dlg[open]");
    eq(await t.page.textContent("#da"), "Harold Budd, Brian Eno, Earth", "artist line in the popup");
    eq(
      await t.page.$$eval("#da button", (b) => b.map((x) => x.className + ":" + x.textContent)),
      ["lnk:Harold Budd", "lnk:Brian Eno", "lnk:Earth"],
      "one link per artist in the popup",
    );
    await t.page.click('#da button:text-is("Harold Budd")');
    await t.waitMsg("“Harold Budd”");
    ok(!(await t.page.$("#dlg[open]")), "popup closed");
    eq(await t.page.inputValue("#q"), "Harold Budd", "the artist in the search field");
    eq((await chips()).join(), "Album:false,Artist:true,Composer:false", "Album and Composer switched off");
    eq(t.reqs(/[?&]q=Harold Budd(&|$)/).length, TD.SRC.length, "one search per source");
    eq(t.reqs(/Composers(%3F|\?)expr=/).length, 0, "no composer request");
  },
  { appDefaults: true },
);

// ART-05: a track artist (album and playlist track list, queue, player bar) is a link per artist that searches
test(
  "ART-05 track artists: links in the track lists, the queue and the player bar, each searches the artist",
  async (t) => {
    t.player.state.songArtists = { [TD.SONG_TITLES[1]]: "Harold Budd, Brian Eno" };
    const links = (sel) => t.page.$$eval(sel, (b) => b.map((x) => x.textContent));
    // A click on the link `sel`: search for its name with only the Artist area on, nothing played
    const searches = async (sel, what) => {
      const name = await t.page.textContent(sel);
      const plays = t.cmds(/^\/(Play|Add)\b/).length;
      await t.page.click(sel);
      await t.waitMsg(`“${name}”`);
      eq(await t.page.inputValue("#q"), name, what + ": the artist in the search field");
      eq(
        await t.page.$$eval("#sin button", (x) => x.map((e) => e.getAttribute("aria-pressed")).join()),
        "false,true,false",
        what + ": only the Artist area on",
      );
      eq(t.cmds(/^\/(Play|Add)\b/).length, plays, what + ": nothing played");
      await t.page.press("#q", "Escape");
    };
    // Album popup: the track artist with a comma, one link each
    await t.all();
    await openLibAlbum(t);
    eq(await links("#tracks .ta .al"), ["Harold Budd", "Brian Eno"], "album popup: one link per track artist");
    eq(await t.page.textContent("#tracks .ta"), "Harold Budd, Brian Eno", "album popup: artist line");
    await searches('#tracks .ta .al:text-is("Brian Eno")', "album popup");
    ok(!(await t.page.$("#dlg[open]")), "album popup closed");
    // Playlist popup: "track artist • album", the artist as link
    if (TD.PL.length) {
      await openPlaylistPopup(t, TD.PL[0].text);
      const x = TD.PL_TRK[0];
      eq(await t.page.textContent("#tracks li.tr .ta"), x.text2, "playlist popup: line as the player sends it");
      eq(
        (await links("#tracks li.tr:first-child .ta .al")).join(", "),
        x.text2
          .split(" • ")[0]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", "),
        "playlist popup: the artist before “ • ” as link",
      );
      await searches("#tracks li.tr:first-child .ta .al", "playlist popup");
    }
    // Queue: "artist – album", the artist as link; no play, no drag
    await t.openQueue();
    const qa = (await links("#qlist li:first-child .qt .al")).join(", ");
    ok(qa, "queue: artist link");
    ok((await t.page.textContent("#qlist li:first-child .qt span")).startsWith(qa + " – "), "queue: artist – album");
    await searches("#qlist li:first-child .qt .al", "queue");
    eq(t.cmds(/^\/Move/), [], "queue: no move");
    // Player bar: line 2 "by artist from album", the artist (title2 = artist) as link
    eq(await t.page.textContent("#nt2"), nowLines(t.st).bar, "player bar: line 2");
    eq((await links("#nt2 .al")).join(", "), t.st("title2"), "player bar: artist link");
    await searches("#nt2 .al", "player bar");
  },
  { appDefaults: true, needs: ["queue"] },
);

// ---------- 4.7 Album popup (POP) ----------
test("POP-01 popup opens from cover and title: details, source line, loading text", async (t) => {
  t.player.state.overrides.push({ match: /MG\/LocalMusic-Album/, delay: 800 });
  await t.all();
  const i = await t.tileOf(TD.ALB_LIB.t);
  await t.page.click(`#grid .item:nth-child(${i}) .cw .card`);
  await t.page.waitForSelector("#dlg[open]");
  ok(/Loading tracks/.test(await t.page.textContent("#tracks")), "loading text");
  eq(await t.page.textContent("#dt"), TD.ALB_LIB.t, "title");
  eq(await t.page.textContent("#da button"), TD.ALB_LIB.a, "artist link");
  const lib = TD.SRC.find((s) => /LibraryIcon/.test(s.image)).text;
  eq((await t.page.textContent("#ds")).trim(), lib, "source line");
  const libIcon = TD.SRC.find((s) => /LibraryIcon/.test(s.image)).image;
  await t.page.waitForFunction(() => /^blob:/.test(document.querySelector("#ds img")?.src || ""));
  ok((await t.page.$eval("#ds img", (i) => i.dataset.src)).endsWith(libIcon), "source icon of the player");
  ok(t.reqs(new RegExp("^" + reEsc(libIcon))).length > 0, "icon read from the player");
  const iconFilter = (theme) =>
    t.page.evaluate((th) => {
      document.documentElement.setAttribute("data-theme", th);
      return getComputedStyle(document.querySelector("#ds img")).filter;
    }, theme);
  eq(await iconFilter("light"), "invert(1)", "white icon inverted in the light design");
  eq(await iconFilter("dark"), "none", "white icon as it is in the dark design");
  await t.page.waitForSelector("#tracks li button");
  await t.page.click("#close");
  await t.page.click(`#grid .item:nth-child(${i}) > .card:not(.ar)`);
  await t.page.waitForSelector("#dlg[open]");
  eq(await t.page.textContent("#dt"), TD.ALB_LIB.t, "title opens it too");
});

test(
  "POP-02 POP-03 POP-10 track list, no buttons, no genre line, session cache",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    eq(await trackRows(t), TD.TRK.map(trackRow), "track number (without dot), title and duration per track");
    ok(!(await t.page.$("#dsum")), "no summary line above the tracks");
    eq(await t.page.$$eval("#tracks li.disc", (e) => e.length), 0, "no disc headers on a single-disc album");
    eq(
      await t.page.textContent("#dlen"),
      fmtTime(TD.TRK.reduce((n, x) => n + (+x.duration || 0), 0)),
      "total time in the album details",
    );
    ok(
      await t.page.$eval("#dy", (y) => y.parentElement === document.querySelector("#da").parentElement),
      "year on the artist line",
    );
    const gap = await t.page.$eval("#tracks li.tr", (b) => {
      const [n, s] = b.querySelectorAll("span");
      return s.getBoundingClientRect().left - n.getBoundingClientRect().right;
    });
    ok(gap >= 8, `space between number and title: ${gap}px`);
    eq(
      await t.page
        .$$eval("#dlg .dl > .cov button, #dlg .info button", (b) =>
          b.map((x) => x.getAttribute("aria-label") || x.title),
        )
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
    await openLibAlbum(t);
    eq(popupReqs(), n, "same album again: from the session cache");
    const tr = t.reqs(/^\/Browse.*MG\/LocalMusic-Album/);
    ok(tr.length > 0 && tr.every((x) => /withContextMenuItems=0/.test(x)), "track list without context menus");
  },
  R,
);

// Browsers send the system language as Accept-Language; with German the player answers the track list
// of an album with an empty menu (Bruno E25), so the app asks in English (E26).
test(
  "POP-11 track list also in a browser set to German",
  async (t) => {
    await t.all();
    await openAlbumBy(t, "x.key === a.key", TD.ALB_LIB);
    await t.page.waitForFunction(() => !/Loading/.test(document.querySelector("#tracks").textContent));
    const rows = await t.page.$$eval("#tracks li.tr", (b) => b.map((x) => x.getBoundingClientRect().height));
    ok(rows.length > 0 && rows.every((h) => h > 0), `visible track rows: ${JSON.stringify(rows)}`);
    ok(/^(\d+:)?\d+:\d\d$/.test(await t.page.textContent("#dlen")), "total time in the album details");
  },
  { ...R, locale: "de-DE" },
);

test(
  "POP-04 POP-05 year, quality tag and technical data from /library/v1/Songs",
  async (t) => {
    const c = await t.page.evaluate(() => ({ FORMATS, LOSSY }));
    const x = songDetails(TD.SONGS, c.FORMATS, c.LOSSY);
    await t.all();
    await openLibAlbum(t);
    eq((await t.page.textContent("#dy")).trim(), x.year, "year");
    eq(
      await t.page.$$eval("#dtech > *", (e) => e.map((y) => (y.className.startsWith("q") ? "q" : ""))),
      [...x.tags.map(() => "q"), ""],
      "quality tags first, then the technical data",
    );
    eq(await t.page.$$eval("#dtech .q", (e) => e.map((y) => y.textContent)), x.tags, "quality tags");
    eq(await t.page.textContent("#dtech span:not(.q)"), x.tech, "technical data");
    ok(
      t.player.state.requests.includes(`/library/v1/Songs?service=${TD.LIB}&` + TD.ALB_LIB.key.split("?")[1]),
      "songs requested for the album",
    );
    ok(!t.player.state.requests.some((r) => /CM%2FLocalMusic-Album/.test(r)), "no context menu request");
  },
  R,
);

test(
  "POP-04 POP-07 mixed album: year range, several formats, tags and ranges",
  async (t) => {
    const c = await t.page.evaluate(() => ({ FORMATS, LOSSY }));
    const x = songDetails(t.player.state.overrides[0].edit(TD.SONGS), c.FORMATS, c.LOSSY);
    ok(/\u2013/.test(x.year) && / \/ /.test(x.tech) && x.tags.length > 1, "test data is mixed");
    await t.all();
    await openLibAlbum(t);
    eq((await t.page.textContent("#dy")).trim(), x.year, "year range");
    eq(await t.page.$$eval("#dtech .q", (e) => e.map((y) => y.textContent)), x.tags, "one tag per quality");
    eq(await t.page.textContent("#dtech span:not(.q)"), x.tech, "formats and ranges");
  },
  {
    // first song: other year, format, quality, bit depth and sample rate
    overrides: [
      {
        match: /^\/library\/v1\/Songs\?service=LocalMusic/,
        edit: (x) =>
          x
            .replace(/samplerate="\d+" samplebits="\d+"/, 'samplerate="96000" samplebits="24"')
            .replace(/atype="\w+"/, 'atype="alac"')
            .replace(/<date>[^<]*<\/date>/, "<date>1000</date>")
            .replace(/<quality>[^<]*<\/quality>/, "<quality>hd</quality>"),
      },
    ],
  },
);

test(
  "POP-06 USB album (MP3) shows MP3 tag and no bit depth",
  async (t) => {
    const c = await t.page.evaluate(() => ({ FORMATS, LOSSY }));
    const x = songDetails(TD.SONGS_USB, c.FORMATS, c.LOSSY);
    await t.chip("New");
    await t.settle();
    await t.page.evaluate((usb) => openAlbum(shown.find((a) => a.key.startsWith(usb))), TD.USB);
    await t.page.waitForFunction(() => document.querySelector("#dtech").textContent);
    eq(await t.page.$$eval("#dtech .q", (e) => e.map((y) => y.textContent)), x.tags, "quality tags");
    eq(await t.page.textContent("#dtech span:not(.q)"), x.tech, "technical data (no bit depth for lossy formats)");
  },
  U,
);

test("POP-08 artist per track only where it differs from the album artist", async (t) => {
  const title = TD.SONG_TITLES[1];
  t.player.state.songArtists = { [title]: TD.OTHER_ARTIST };
  await t.all();
  await openLibAlbum(t);
  eq(await t.page.$$eval("#tracks .ta", (e) => e.map((x) => x.textContent)), [TD.OTHER_ARTIST], "one track artist");
  ok((await t.page.textContent("#tracks li:nth-child(2)")).includes(TD.OTHER_ARTIST), "on track 2");
});

// Multi-disc albums (Bruno E32): the recorded album split into two discs by the mock (state.discs).
// Disc 1 = the first half of the tracks, disc 2 = the rest.
const twoDiscs = (s) => (s.discs = TD.TRK.map((_, i) => (i < Math.ceil(TD.TRK.length / 2) ? 1 : 2)));
// Rows of the track list as the user reads them: disc headers and [number, title, duration] per track
const listRows = (t) =>
  t.page.$$eval("#tracks li", (l) =>
    l.map((x) =>
      x.classList.contains("disc")
        ? x.textContent
        : [...x.querySelectorAll(":scope > span")]
            .map((s) => s.firstChild?.textContent || "")
            .concat(x.querySelector("i").textContent),
    ),
  );
test(
  "POP-16 multi-disc album: header per disc, numbers per disc, disc count with the total time",
  async (t) => {
    ok(TD.TRK.length >= 2, "test data has at least two tracks");
    await t.all();
    await openLibAlbum(t);
    const d = t.player.state.discs;
    const disc = (n) => TD.TRK.filter((_, i) => d[i] === n);
    const num = (x, i) => [String(i + 1), x.text.replace(/^\d+\.\s*/, ""), x.duration ? fmtTime(+x.duration) : ""];
    eq(
      await listRows(t),
      ["Disc 1", ...disc(1).map(num), "Disc 2", ...disc(2).map(num)],
      "header before each disc, numbers start again at 1",
    );
    eq(
      await t.page.$eval("#tracks li.disc", (e) => getComputedStyle(e).textTransform),
      "uppercase",
      "header in capitals",
    );
    eq(
      await t.page.textContent("#dlen"),
      "2 discs · " + fmtTime(TD.TRK.reduce((n, x) => n + (+x.duration || 0), 0)),
      "disc count and total time",
    );
    await t.page.click("#tracks li:not(.disc) >> nth=" + disc(1).length);
    await t.waitToast("Track started");
    const first2 = TD.TRK[disc(1).length];
    ok(
      t.player.state.commands.includes(decodeURIComponent(first2.autoplayURL || first2.playURL)),
      "first track of disc 2 plays",
    );
  },
  { mock: twoDiscs },
);

test(
  "POP-17 multi-disc album numbered across the discs: discs from discno, not from the numbers",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    const rows = await listRows(t);
    const n1 = Math.ceil(TD.TRK.length / 2);
    eq(rows.indexOf("Disc 2"), n1 + 1, "disc 2 starts after the tracks of disc 1");
    eq(rows[n1 + 2][0], String(n1 + 1), "number runs on");
  },
  {
    mock: (s) => {
      twoDiscs(s);
      s.discRunOn = true;
    },
  },
);

test(
  "POP-18 same title on two discs: artist of the song at the same position",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    const n1 = Math.ceil(TD.TRK.length / 2);
    eq(
      await t.page.$$eval("#tracks li:not(.disc)", (l) => l.map((x) => x.querySelector(".ta")?.textContent || "")),
      TD.TRK.map((_, i) => (i === n1 ? TD.OTHER_ARTIST : "")),
      "artist only on the first track of disc 2",
    );
  },
  {
    // first track of disc 2 gets the title of the first track and another artist (songs and track list)
    mock: twoDiscs,
    overrides: [
      {
        match: /^\/library\/v1\/Songs\?service=LocalMusic/,
        edit: (x) => {
          const n1 = Math.ceil(TD.TRK.length / 2);
          let i = 0;
          return x.replace(/<art>[^<]*<\/art>(\s*<alb>[^<]*<\/alb>\s*)<title>[^<]*<\/title>/g, (m, alb) =>
            i++ === n1
              ? `<art>${TD.OTHER_ARTIST}</art>${alb}<title>${TD.SONG_TITLES[0].replace(/&/g, "&amp;")}</title>`
              : m,
          );
        },
      },
      {
        match: /MG\/LocalMusic-Album/,
        edit: (x) => {
          const n1 = Math.ceil(TD.TRK.length / 2);
          let i = 0;
          return x.replace(/ text="(\d+)\. [^"]*"/g, (m, n) =>
            i++ === n1 ? ` text="${n}. ${TD.SONG_TITLES[0].replace(/&/g, "&amp;")}"` : m,
          );
        },
      },
    ],
  },
);

test(
  "POP-09 click on a track plays it",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    await t.page.click("#tracks li:first-child .tp", { position: { x: 10, y: 10 } });
    await t.waitToast("Track started");
    ok(t.player.state.commands.includes(decodeURIComponent(TD.TRK[0].autoplayURL || TD.TRK[0].playURL)), "track URL");
  },
  W,
);

test(
  "POP-12 close with button, backdrop and Esc (panel behind stays open)",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    await t.page.click("#close");
    ok(!(await t.page.$("#dlg[open]")), "closed with the button");
    await openLibAlbum(t);
    await t.page.mouse.click(3, 3);
    await t.page.waitForFunction(() => !document.querySelector("#dlg").open);
    await t.page.click("#gear");
    await openLibAlbum(t);
    await t.page.keyboard.press("Escape");
    await t.page.waitForFunction(() => !document.querySelector("#dlg").open);
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "settings panel still open");
  },
  R,
);

test("POP-13 track list or songs fail", async (t) => {
  await t.all();
  t.player.state.overrides.push({ match: /MG\/LocalMusic-Album/, status: 500, times: 1 });
  await openAlbumBy(t, "x.key === a.key", TD.ALB_LIB);
  const p = await t.apiPopup("Loading the tracks did not succeed");
  ok(/^\/Browse\?.*LocalMusic-Album/.test(p.u), "track list request: " + p.u);
  eq(await t.page.$$eval("#tracks li", (x) => x.length), 0, "empty list");
  await t.page.click("#close");
  t.player.state.overrides.push({ match: /^\/library\/v1\/Songs/, status: 500 });
  const other = TD.ALL.find((a) => a.browseKey !== TD.ALB_LIB.key);
  await openAlbumBy(t, "x.key === a", other.browseKey);
  const q = await t.apiPopup("Loading the album details did not succeed");
  ok(/^\/library\/v1\/Songs\?/.test(q.u), "songs request: " + q.u);
  await t.page.waitForSelector("#tracks li button");
  eq(await t.page.textContent("#dy"), "", "no year");
  eq(await t.page.textContent("#dtech"), "", "no technical data");
});

test("POP-22 empty track list: message, not kept in the session cache", async (t) => {
  await t.all();
  t.player.state.overrides.push({ match: /MG\/LocalMusic-Album/, body: '<browse type="tracks"></browse>', times: 1 });
  await openAlbumBy(t, "x.key === a.key", TD.ALB_LIB);
  await t.page.waitForFunction(() => /No tracks/.test(document.querySelector("#tracks").textContent));
  eq(await t.page.$$eval("#tracks li.tr", (x) => x.length), 0, "no track rows");
  ok(!(await t.page.$("#apidlg[open]")), "no error popup");
  const n = t.reqs(/^\/Browse.*MG\/LocalMusic-Album/).length;
  await t.page.click("#close");
  await openLibAlbum(t);
  eq(t.reqs(/^\/Browse.*MG\/LocalMusic-Album/).length, n + 1, "opened again: track list requested again");
  eq(await trackRows(t), TD.TRK.map(trackRow), "tracks shown");
});

test("POP-19 outdated failure of the album popup is dropped: track list, songs", async (t) => {
  await t.all();
  const [a, b] = TD.ALL.map((x) => x.browseKey);
  // not openAlbumBy(): it waits until the requests of the album are done
  const open = (key) => t.page.evaluate((k) => void openAlbum(shown.find((x) => x.key === k)), key);
  for (const match of [/MG\/LocalMusic-Album/, /^\/library\/v1\/Songs/]) {
    const late = t.player.state.hold(match, 500);
    await open(a);
    await late.asked();
    await t.page.click("#close");
    await open(b);
    await t.page.waitForSelector("#tracks li button");
    const n = await t.page.$$eval("#tracks li", (x) => x.length);
    await late.release();
    await t.settle(300);
    eq(await t.page.$("#apidlg[open]"), null, "no error popup over the other album");
    eq(await t.page.$$eval("#tracks li", (x) => x.length), n, "tracks of the other album stay");
    await t.page.click("#close");
  }
});

test("POP-20 closed popup: late failure is dropped, an album opened at once still loads", async (t) => {
  await t.all();
  const [a, b] = TD.ALL.map((x) => x.browseKey);
  const album = () => t.page.evaluate((k) => void openAlbum(shown.find((x) => x.key === k)), a);
  const playlist = () => t.page.evaluate(() => void openAlbum(playlists[0]));
  for (const [match, open] of [
    [/MG\/LocalMusic-Album/, album],
    [/^\/library\/v1\/Songs/, album],
    [/BluOS-Playlist/, playlist],
  ]) {
    const late = t.player.state.hold(match, 500);
    await open();
    await late.asked();
    await t.page.evaluate(() => {
      window.__closed = false;
      document.querySelector("#dlg").addEventListener("close", () => (window.__closed = true), { once: true });
    });
    await t.page.click("#close");
    await t.page.waitForFunction(() => window.__closed); // not a fixed wait: the event can come late
    await late.release();
    await t.settle(300);
    eq(await t.page.$("#apidlg[open]"), null, "no error popup after closing: " + match);
  }
  // the close event arrives after the next album was opened: it must not cancel that album
  await album();
  const next = t.player.state.hold(new RegExp("key=" + reEsc(b) + "$")); // its answer must come after the event
  await t.page.evaluate(
    (k) =>
      new Promise((closed) => {
        const dlg = document.querySelector("#dlg");
        dlg.addEventListener("close", closed, { once: true });
        dlg.close();
        openAlbum(shown.find((x) => x.key === k));
      }),
    b,
  );
  await next.release();
  await t.page.waitForSelector("#tracks li button");
});

test("POP-14 open popup keeps the page behind it still", async (t) => {
  await t.all();
  // the page must be able to scroll, whatever the window size
  await t.page.evaluate(() => (document.body.style.minHeight = "300vh"));
  await openLibAlbum(t);
  await t.page.waitForSelector("#tracks li button");
  eq(await t.page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden", "page scrolling off");
  const y = await t.page.evaluate(() => scrollY);
  await t.page.mouse.move(3, 3);
  await t.page.mouse.wheel(0, 600);
  const box = await t.page.$eval("#tracks", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await t.page.mouse.move(box.x, box.y);
  await t.page.mouse.wheel(0, 3000);
  await t.page.waitForTimeout(300);
  eq(await t.page.evaluate(() => scrollY), y, "page not scrolled by the wheel over backdrop and track list");
  // A short track list (whatever the window size) scrolls without a scroll bar over the durations
  const bar = await t.page.$eval("#tracks", (e) => {
    e.style.maxHeight = "80px";
    e.style.overflowY = "auto";
    const r = { scrolls: e.scrollHeight > e.clientHeight, bar: e.offsetWidth - e.clientWidth };
    e.style.maxHeight = e.style.overflowY = "";
    return r;
  });
  ok(bar.scrolls && bar.bar === 0, `track list scrolls without a scroll bar: ${JSON.stringify(bar)}`);
  await t.page.click("#close");
  ok(
    await t.page.evaluate(() => getComputedStyle(document.documentElement).overflow !== "hidden"),
    "page scrolls again",
  );
});

test(
  "POP-21 cover in full screen: click or Enter on the loaded cover, no new request, closes back to the popup",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    await t.page.waitForFunction(() => document.querySelector("#dcov").classList.contains("zoom"));
    eq(
      await t.page.$eval("#dcov", (e) => [e.getAttribute("role"), e.tabIndex, getComputedStyle(e).cursor]),
      ["button", 0, "zoom-in"],
      "loaded cover is a button",
    );
    const covers = () => t.reqs(/^\/Artwork\?/).length,
      n = covers();
    const view = () => t.page.$eval("#covdlg", (d) => d.open);
    const popup = () => t.page.$eval("#dlg", (d) => d.open);
    await t.page.click("#dcov");
    ok(await view(), "cover in full screen");
    const own = await t.page.evaluate(() => {
      const i = document.querySelector("#dimg"),
        c = document.querySelector("#covimg");
      return c.width === i.naturalWidth && c.height === i.naturalHeight;
    });
    ok(own, "drawn in its own size");
    eq(covers(), n, "no new cover request");
    await t.page.mouse.click(5, 5);
    ok(!(await view()) && (await popup()), "a click closes it, the popup stays open");
    await t.page.focus("#dcov");
    await t.page.keyboard.press("Enter");
    ok(await view(), "opened with Enter");
    eq(await t.page.evaluate(() => document.activeElement.id), "covclose", "focus on the close button");
    await t.page.keyboard.press("Escape");
    ok(!(await view()) && (await popup()), "Esc closes only the cover");
  },
  R,
);

// ---------- 4.8 Search (SRH) ----------
// Search result lines: the status line (first group) and the line before every further group in the grid
const searchLines = async (t) => [
  await t.msg(),
  ...(await t.page.$$eval("#grid .gl", (x) => x.map((e) => e.textContent))),
];
// Number of albums the search result lines count together
const searchTotal = (lines) => lines.reduce((n, l) => n + +((l.match(/^(\d+) albums? with/) || [])[1] || 0), 0);
test(
  "SRH-01 search uses the player search, no random tile, no chip",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(`with \u201C${TD.TERM}\u201D`);
    ok((await t.page.textContent("#grid .item:first-child b")) !== "Random album", "no random tile");
    eq(t.reqs(new RegExp("[?&]q=" + TD.TERM + "(&|$)")).length, TD.SRC.length, "search request per source");
    eq(await t.page.$$eval("#az button[aria-pressed=true]", (x) => x.length), 0, "no chip pressed");
    ok(/^\d+ albums? with/.test(await t.msg()), "status line");
  },
  R,
);

test("SRH-02 the albums list of the result is read once per source (no second request)", async (t) => {
  await t.openSearch();
  await t.page.fill("#q", TD.TERM);
  await t.page.press("#q", "Enter");
  await t.waitMsg(/ with \u201C/);
  const searches = t.reqs(/[?&]q=/).length;
  ok(searches >= 1, "search request");
  eq(t.reqs(/Albums(%3F|\?)expr=/).length, searches, "one albums request per search request");
});

test(
  "SRH-03 search only from SEARCH_MIN characters: while typing after a pause, Enter at once",
  async (t) => {
    const { min, delay } = await t.page.evaluate(() => ({ min: SEARCH_MIN, delay: SEARCH_DELAY }));
    const searches = () => t.reqs(/[?&]q=/).length;
    const n0 = searches();
    const word = "love".padEnd(min + 1, "s");
    await t.openSearch();
    await t.page.type("#q", word.slice(0, min - 1), { delay: 60 });
    await t.settle(1200);
    eq(searches() - n0, 0, `no search below ${min} characters`);
    await t.page.type("#q", word.slice(min - 1), { delay: 60 });
    await t.page.waitForTimeout(delay / 3); // not stretched by UI_SLOW: must stay below SEARCH_DELAY
    eq(searches() - n0, 0, "no search before the pause");
    await t.waitMsg(/ with \u201C/);
    const n1 = searches();
    ok(n1 - n0 >= 1, "one search after the pause");
    await t.page.fill("#q", "");
    await t.page.type("#q", word.slice(0, min - 1), { delay: 60 });
    await t.page.press("#q", "Enter");
    await t.waitMsg(`Type at least ${min} characters to search.`);
    eq(searches(), n1, "no search below the minimum, also with Enter");
    await t.page.type("#q", word.slice(min - 1, min));
    await t.page.press("#q", "Enter");
    await t.waitMsg(`\u201C${word.slice(0, min)}\u201D`);
    ok(searches() > n1, "Enter searches at once from the minimum");
  },
  R,
);

test(
  "SRH-04 empty field restores the selected view without a request",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    const lists = () => t.reqs(/^\/(Browse|library)/).length;
    const n = lists();
    await t.page.fill("#q", "");
    await t.waitMsg(nAlb(TD.FAV.length));
    eq(await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"), "true", "chip pressed again");
    eq(await t.page.evaluate(() => shown.length), TD.FAV.length, "albums of the view");
    eq(lists(), n, "no request");
  },
  R,
);

test(
  "SRH-05 sectioned search result: albums of every filled section",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    ok(t.reqs(/SRCHSEC1/).length > 0, "filled section read");
    eq(t.reqs(/SRCHSEC2/).length, 0, "empty section skipped");
    // the mock answers the albums of fixture 07 for the filled section of every source
    const albums = itemsOf(fx("07"), ofType("album"));
    eq(searchTotal(await searchLines(t)), albums.length * TD.SRC.length, "albums of the filled sections");
    const titles = albums.map((a) => a.text);
    ok(
      (await t.tiles()).every((x) => titles.includes(x)),
      "tiles from the section",
    );
  },
  {
    overrides: [
      {
        match: /Albums(%3F|\?)expr=/,
        body:
          '<browse type="sections"><item browseKey="LocalMusic:SRCHSEC1" text="A" text2="1" type="section"></item>' +
          '<item browseKey="LocalMusic:SRCHSEC2" text="B" text2="0" type="section"></item></browse>',
      },
      { match: /SRCHSEC1/, body: fx("07") },
    ],
  },
);

test(
  "SRH-06 album items in the search answer are shown directly",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    ok((await t.tiles()).includes("Direct Album"), "album of the answer");
    eq(t.reqs(/Albums(%3F|\?)expr=/).length, 0, "no albums link followed");
  },
  {
    overrides: [
      {
        match: /[?&]q=/,
        body: '<browse><item type="album" text="Direct Album" text2="Test Artist" browseKey="LocalMusic:MG/LocalMusic-Album?album=Direct+Album&amp;artist=Test+Artist" playURL="/Add?test=1"></item></browse>',
      },
    ],
  },
);

test("SRH-07 only the newest search updates the grid", async (t) => {
  t.player.state.overrides.push({ match: /q=slowterm/, delay: 1500 });
  await t.openSearch();
  await t.page.fill("#q", "slowterm");
  await t.page.press("#q", "Enter");
  await t.page.fill("#q", "fast");
  await t.page.press("#q", "Enter");
  await t.waitMsg("\u201Cfast\u201D");
  await t.settle(2500);
  ok(/\u201Cfast\u201D/.test(await t.msg()), "second search stays");
});

test("SRH-08 search error", async (t) => {
  t.player.state.overrides.push({ match: /[?&]q=/, status: 500 });
  await t.openSearch();
  await t.page.fill("#q", TD.TERM);
  await t.page.press("#q", "Enter");
  await t.waitMsg("Search failed: Player responded with 500");
  ok(await t.page.$eval("#msg", (e) => e.className === "err"), "shown as error");
  const p = await t.apiPopup("The search did not succeed");
  ok(/[?&]q=/.test(p.u), "search request: " + p.u);
});

test(
  "SRH-08 source without search",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg("Connect first \u2013 or the player offers no search.");
  },
  { overrides: [{ match: /key=(LocalMusic|1A2B_3C4D):$/, edit: (x) => x.replace(/ searchKey="[^"]*"/, "") }] },
);

// SRH-09: album items with the player's attributes; the first recorded album is found by the title search and
// by the first composer
const albumItem = (title) => {
  const q = encodeURIComponent(title).replace(/%20/g, "+");
  return (
    `<item browseKey="LocalMusic:MG/LocalMusic-Album?album=${q}&amp;artist=Test+Artist" contextMenuKey="LocalMusic:CM/LocalMusic-Album?album=${q}&amp;artist=Test+Artist" ` +
    `playURL="/Add?playnow=1&amp;service=LocalMusic&amp;album=${q}&amp;artist=Test+Artist" text="${title}" text2="Test Artist" type="album"></item>`
  );
};
const firstAlbum = fx("07").match(/<item [^>]*type="album">[\s\S]*?<\/contextMenu>\s*<\/item>/)[0];
test(
  "SRH-09 search also shows the albums of the composers found, without repeats",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    const first = itemsOf(firstAlbum, ofType("album"))[0].text;
    eq(t.reqs(/COMPPAGE2/).length, 1, "second page of the composers read");
    eq(t.reqs(/LocalMusic-Composer\?composer=Test/).length, 1, "menu of the first composer read");
    eq(t.reqs(/LocalMusic-Composer\?composer=Other/).length, 1, "menu of the second composer read");
    const lines = await searchLines(t);
    eq(
      searchTotal(lines),
      TD.SRC.length + 2,
      "album of the title search per source plus the new albums of the composers",
    );
    ok(lines.includes(`2 albums with \u201C${TD.TERM}\u201D as a composer`), "composer group: " + lines.join(" | "));
    const tiles = await t.tiles();
    eq(tiles.filter((x) => x === "Composer Album").length, 1, "album of both composers shown once");
    ok(tiles.includes("Second Composer Album"), "album of the second composer");
    eq(
      tiles.filter((x) => x === first).length,
      TD.SRC.length,
      "album of the title search and of a composer once per source",
    );
  },
  {
    overrides: [
      { match: /Albums%3Fexpr=/, body: `<browse type="albums">${firstAlbum}</browse>` },
      {
        match: /key=LocalMusic:Composer\/%2Flibrary%2Fv1%2FComposers%3Fexpr=/,
        body: '<browse type="composers" nextKey="LocalMusic:COMPPAGE2"><item browseKey="LocalMusic:MG/LocalMusic-Composer?composer=Test+Composer" text="Test Composer" type="composer"></item></browse>',
      },
      {
        match: /COMPPAGE2/,
        body: '<browse type="composers"><item browseKey="LocalMusic:MG/LocalMusic-Composer?composer=Other+Composer" text="Other Composer" type="composer"></item></browse>',
      },
      {
        match: /Albums%3Fcomposer=Test/,
        body: `<browse type="albums">${firstAlbum}${albumItem("Composer Album")}</browse>`,
      },
      {
        match: /Albums%3Fcomposer=Other/,
        body: `<browse type="albums">${albumItem("Composer Album")}${albumItem("Second Composer Album")}</browse>`,
      },
    ],
  },
);

// Grid of a search result in order: "| " + group line, album title of every tile
const searchGrid = (t) =>
  t.page.$$eval("#grid > *", (x) =>
    x
      .map((e) => (e.classList.contains("gl") ? "| " + e.textContent : e.querySelector("b")?.textContent))
      .filter(Boolean),
  );
// Every album of the library (section=all without a filter) for the album artist match of the search "fugue":
// one album only found by its album artist, one that the albums list has already (shown once), one with the
// term inside a word of the album artist (not found).
const LIB_ALL = /^\/library\/v1\/Albums\?service=LocalMusic&section=all$/;
const FUGUE_LIB = [
  ["Baroque Night", "Fugue Ensemble"],
  ["Night Moves", "Fugue Artist"],
  ["Quiet Hours", "Refugue Band"],
];
const fugueLib = () => {
  const albums = FUGUE_LIB.map(([t, a]) => `<album tracks="9"><title>${t}</title><art>${a}</art></album>`);
  return `<albums section="all" service="LocalMusic"><sections><section name="#">${albums.join("")}</section></sections></albums>`;
};
// Search "fugue" (SRH-10, SRH-11): library albums list with title and artist hits (word start, accents),
// empty on the USB drive; one composer with one new album and one album of the albums list; the library's
// albums with album artist hits (fugueLib).
const fugueSearch = () => [
  { match: LIB_ALL, body: fugueLib() },
  {
    match: /key=LocalMusic:Album\/%2Flibrary%2Fv1%2FAlbums%3Fexpr=/,
    body: `<browse type="albums">${albumItem("A Fugue for Two")}${albumItem("Night Moves").replace(/Test Artist|Test\+Artist/g, (m) => m.replace("Test", "Fugue"))}${albumItem("Refugue")}${albumItem("The Fügue Book")}</browse>`,
  },
  { match: /key=1A2B_3C4D:Album\/%2Flibrary%2Fv1%2FAlbums%3Fexpr=/, body: '<browse type="albums"></browse>' },
  {
    match: /key=LocalMusic:Composer\/%2Flibrary%2Fv1%2FComposers%3Fexpr=/,
    body: '<browse type="composers"><item browseKey="LocalMusic:MG/LocalMusic-Composer?composer=Fugue+Master" text="Fugue Master" type="composer"></item></browse>',
  },
  {
    match: /Albums%3Fcomposer=Fugue/,
    body: `<browse type="albums">${albumItem("Cello Suites")}${albumItem("A Fugue for Two")}</browse>`,
  },
];
test(
  "SRH-10 search results grouped by album title, artist and composer, one status line per group",
  async (t) => {
    await t.openSearch();
    await t.page.fill("#q", "fugue");
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    eq(await t.msg(), "2 albums with \u201Cfugue\u201D in the album title", "status line = first group");
    const ruled = (sel) =>
      t.page.$$eval(sel, (x) =>
        x.map(
          (e) =>
            getComputedStyle(e).borderBottomStyle === "solid" && parseFloat(getComputedStyle(e).borderBottomWidth) > 0,
        ),
      );
    eq((await ruled("#stl, #grid .gl")).join(), "true,true,true,true", "fine line under every group line");
    eq(
      (await searchGrid(t)).join(" / "),
      [
        "A Fugue for Two",
        "The F\u00FCgue Book",
        "| 2 albums with \u201Cfugue\u201D as an album artist",
        "Baroque Night",
        "Night Moves",
        "| 1 album with \u201Cfugue\u201D as a track artist",
        "Refugue",
        "| 1 album with \u201Cfugue\u201D as a composer",
        "Cello Suites",
      ].join(" / "),
      "groups: title (word start, accents ignored), album artist, track artist (the rest), composer",
    );
    eq(t.reqs(LIB_ALL).length, 1, "every album of the library read once for the album artist");
    eq(
      await t.page.$$eval("#grid .item b", (x) => x.filter((e) => e.textContent === "Random album").length),
      0,
      "no random tile",
    );
  },
  { overrides: fugueSearch() },
);

// SRH-11: the search areas (chips in the search field) choose the groups and skip the requests of an area
// that is off; the choice is stored.
test(
  "SRH-11 search areas: chips in the search field, only Album on by default, stored",
  async (t) => {
    const chips = () =>
      t.page.$$eval("#sin button", (x) => x.map((e) => e.textContent + ":" + e.getAttribute("aria-pressed")));
    const area = (name) => t.page.click(`#sin button:text-is("${name}")`);
    // Waits until the grid shows `want` (the chips search again at once)
    const gridIs = async (want, what) => {
      for (let i = 0; i < 50 && (await searchGrid(t)).join(" / ") !== want.join(" / "); i++) await t.settle(100);
      eq((await searchGrid(t)).join(" / "), want.join(" / "), what);
    };
    const searches = () => t.reqs(/[?&]q=/).length;
    const albumLists = () => t.reqs(/Albums(%3F|\?)expr=/).length;
    const composers = () => t.reqs(/Composers(%3F|\?)expr=|LocalMusic-Composer\?composer=/).length;
    eq((await chips()).join(), "Album:true,Artist:false,Composer:false", "only Album on by default");
    await t.openSearch();
    await t.page.fill("#q", "fugue");
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    await gridIs(["A Fugue for Two", "The F\u00FCgue Book"], "only Album: the title group");
    eq(await t.msg(), "2 albums with \u201Cfugue\u201D in the album title", "status line = title group");
    ok(albumLists() > 0, "albums list read");
    eq(composers(), 0, "no composer request");
    eq(t.reqs(LIB_ALL).length, 0, "Artist off: no album list of the library");

    await area("Artist");
    await gridIs(
      [
        "A Fugue for Two",
        "The F\u00FCgue Book",
        "| 2 albums with \u201Cfugue\u201D as an album artist",
        "Baroque Night",
        "Night Moves",
        "| 1 album with \u201Cfugue\u201D as a track artist",
        "Refugue",
      ],
      "Artist on: searched again with the album artist and track artist groups",
    );
    eq(composers(), 0, "still no composer request");

    await area("Album");
    await gridIs(
      ["Baroque Night", "Night Moves", "| 1 album with \u201Cfugue\u201D as a track artist", "Refugue"],
      "Album off: only the artist groups",
    );
    eq(await t.msg(), "2 albums with \u201Cfugue\u201D as an album artist", "status line = album artist group");
    eq(t.reqs(LIB_ALL).length, 1, "album list of the library read once for the session");

    const n = searches();
    await area("Artist");
    await t.waitMsg("Select at least one search area.");
    eq(searches(), n, "every area off: no search");

    const a1 = albumLists();
    await area("Composer");
    await gridIs(["A Fugue for Two", "Cello Suites"], "only Composer: the albums of the composers found");
    eq(await t.msg(), "2 albums with \u201Cfugue\u201D as a composer", "status line = composer group");
    eq(albumLists(), a1, "no albums list read");

    await t.reload();
    await t.connect();
    eq((await chips()).join(), "Album:false,Artist:false,Composer:true", "areas stored across a reload");
    const m = searches();
    await t.openSearch();
    await area("Album");
    await t.settle();
    eq(searches(), m, "chip with an empty search field: no search");
  },
  { overrides: fugueSearch(), appDefaults: true },
);

test(
  "SRH-12 search field hidden until the search button, Esc and the button hide it and restore the view",
  async (t) => {
    const shown = () => t.page.isVisible("#qbox");
    const focus = () => t.page.evaluate(() => document.activeElement.id);
    const lists = () => t.reqs(/^\/(Browse|library)/).length;
    ok(!(await shown()), "search field hidden at the start");
    eq(await t.page.getAttribute("#sbtn", "aria-expanded"), "false", "search button collapsed");
    const bg = () => t.page.$eval("#sbtn", (b) => getComputedStyle(b).backgroundColor);
    eq(await bg(), "rgba(0, 0, 0, 0)", "search button not highlighted");
    const left = (sel) => t.page.$eval(sel, (e) => e.getBoundingClientRect().left);
    ok(
      (await left("#sbtn")) < (await left("#fbtn")) && (await left("#fbtn")) < (await left("#qbtn")),
      "search, filter, queue button",
    );
    await t.page.click("#sbtn");
    ok((await shown()) && (await t.page.isVisible("#sin")), "field and search areas shown");
    eq(await t.page.getAttribute("#sbtn", "aria-expanded"), "true", "search button expanded");
    ok((await bg()) !== "rgba(0, 0, 0, 0)", "search button highlighted while the field is shown");
    eq(await focus(), "q", "focus in the field");
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    let n = lists();
    await t.page.press("#q", "Escape");
    await t.waitMsg(nAlb(TD.FAV.length));
    eq(await t.msg(), nAlb(TD.FAV.length) + " in favourites", "status line of the view restored");
    ok(!(await shown()), "Esc hides the field");
    eq(await focus(), "sbtn", "focus back on the search button");
    eq(await t.page.getAttribute('#az button[aria-label="Favourites"]', "aria-pressed"), "true", "view restored");
    eq(lists(), n, "no request");
    await t.page.click("#sbtn");
    eq(await t.page.inputValue("#q"), "", "field empty when shown again");
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    n = lists();
    await t.page.click("#sbtn");
    await t.waitMsg(nAlb(TD.FAV.length));
    ok(!(await shown()), "the search button hides the field");
    eq(lists(), n, "no request");
    // Clear button of the field (Safari, Chrome; Firefox draws none): own cross, clears the field and restores the view
    if (await t.page.evaluate(() => CSS.supports("selector(::-webkit-search-cancel-button)"))) {
      await t.page.click("#sbtn");
      await t.page.fill("#q", TD.TERM);
      await t.page.press("#q", "Enter");
      await t.waitMsg(/ with \u201C/);
      // middle of the 18 px cross at the right end of the text area (inside the field's right padding)
      const r = await t.page.$eval("#q", (e) => ({
        ...e.getBoundingClientRect().toJSON(),
        pad: parseFloat(getComputedStyle(e).paddingRight),
      }));
      await t.page.mouse.click(r.right - r.pad - 9, r.top + r.height / 2);
      await t.waitMsg(nAlb(TD.FAV.length));
      eq(await t.page.inputValue("#q"), "", "the clear button empties the field");
      ok(await shown(), "field stays shown");
    }
  },
  R,
);

test("SRH-13 a view that finishes during a search waits until the search is cleared", async (t) => {
  // the artist view reads a favourite state only for an artist with a favourite album (TD-ART)
  ok(TD.ART, "a favourite whose artist has albums");
  const artist = TD.ART;
  const byArtist = () => t.page.evaluate((a) => void showArtist(a), artist);
  const changedPlaylists = () =>
    t.page.evaluate(() => {
      playlists.shift(); // as if one playlist was new on the player
      document.querySelector("#az .plc").click();
    });
  const failed = "Loading failed: Player responded with 500";
  const views = [
    { match: /CM\/LocalMusic-Album/, start: byArtist, msg: / by /, status: 500, popup: "Reading the favourite state" },
    { match: /[?&]genre=/, start: () => t.chip(TD.GEN_ONE), msg: / in the genre / },
    { match: /quality=cd/, start: () => t.chip("CD"), msg: /in CD quality/ },
    { match: /:S:Album\//, start: () => t.chip("All"), msg: /^\d+ albums?$/ },
    { match: /recent=1/, start: () => t.chip("New"), msg: /recently added/ },
    { match: /quality=hr/, start: () => t.chip("HD"), msg: failed, status: 500, popup: "Loading the albums" },
    { match: /key=BluOS:$/, start: changedPlaylists, msg: /^\d+ (BluOS|library) playlists?$/ },
  ];
  await t.openSearch();
  for (const v of views) {
    const late = t.player.state.hold(v.match, v.status);
    await v.start();
    await late.asked();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    const screen = async () => [await t.msg(), await t.page.$$eval("#grid .item", (x) => x.length)];
    const results = await screen();
    await late.release();
    await t.settle(300);
    eq(await screen(), results, "search results stay: " + v.match);
    eq(await t.page.$("#apidlg[open]"), null, "no popup over the search results: " + v.match);
    await t.page.fill("#q", "");
    await t.waitMsg(v.msg);
    if (v.popup) await t.apiPopup(v.popup + " did not succeed");
    else ok((await t.page.$$eval("#grid .item", (x) => x.length)) > 1, "view after clearing: " + v.match);
  }
});

// ---------- 4.9 Player footer (FTR) ----------
test(
  "FTR-01 FTR-03 now playing, quality tag, no source icon",
  async (t) => {
    const st = t.st;
    ok(st("title1") || st("name"), "something is playing (precondition)");
    await t.page.waitForFunction((x) => document.querySelector("#nt1").textContent === x, st("title1") || st("name"));
    eq(await t.page.textContent("#nt2"), nowLines(st).bar, "line 2");
    if (st("title2") === st("artist") && st("title3") === st("album"))
      eq(
        await nowStyles(t.page, "#nt2"),
        [
          [st("title2"), false],
          [st("title3"), false],
        ],
        "artist and album highlighted, not bold",
      );
    const q = /^MP3\b/.test(st("streamFormat")) ? "MP3" : { cd: "CD", hd: "HD", hr: "HD" }[st("quality")] || "";
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
  },
  { ...R, needs: ["library"] },
);

test("FTR-02 quality tag for every quality value of /Status", async (t) => {
  for (const [quality, format, tag] of [
    ["cd", "FLAC 16/44.1", "CD"],
    ["hd", "FLAC 24/96", "HD"],
    ["hr", "FLAC 24/192", "HD"],
    ["mqa", "MQA 24/96", "MQA"],
    ["dolbyAtmos", "Dolby Atmos", "Dolby"],
    ["320000", "MP3 320 kb/s", "MP3"],
    ["other", "PCM", ""],
  ]) {
    t.player.state.statusPatch = { quality, streamFormat: format };
    await t.page.waitForFunction(
      ([f, tg]) => {
        const q = document.querySelector("#nq");
        return q.title === f && (tg ? !q.hidden && q.textContent === tg : q.hidden);
      },
      [format, tag],
    );
  }
});

test(
  "FTR-04 nothing playing: placeholder, no cover, no tag, no full screen",
  async (t) => {
    await t.waitText("#nt1", "Nothing playing");
    eq(await t.page.textContent("#nt2"), "", "line 2 empty");
    ok(await t.page.$eval("#cov", (e) => e.hidden), "no cover");
    ok(await t.page.$eval("#nq", (e) => e.hidden), "no quality tag");
    await t.page.click("#cvb");
    ok(await t.page.$eval("#full", (e) => e.hidden), "full screen does not open");
  },
  { playing: false },
);

test(
  "FTR-05 play / pause button shows an SVG icon and sends /Pause",
  async (t) => {
    await t.page.evaluate(() => setState("pause"));
    ok(await t.page.$eval("#pp", (b) => !!b.querySelector("svg") && !b.textContent.trim()), "play icon is an SVG");
    const play = await t.page.innerHTML("#pp");
    await t.page.evaluate(() => setState("play"));
    ok((await t.page.innerHTML("#pp")) !== play, "pause icon differs from play icon");
    // the icon follows the state the player answers (mock: paused)
    if (!REAL) t.player.state.overrides.push({ match: /^\/Pause/, body: "<state>pause</state>", times: 1 });
    await t.page.waitForFunction(() => document.querySelector("#nt1").textContent);
    const before = await t.page.innerHTML("#pp");
    await t.page.click("#pp");
    await t.page.waitForFunction((p) => document.querySelector("#pp").innerHTML !== p, before);
    eq(t.cmds(/^\/Pause\?toggle=1/).length, 1, "/Pause?toggle=1 sent, icon follows the answer");
    if (REAL) {
      // back to the former state
      await t.page.click("#pp");
      await t.page.waitForFunction((p) => document.querySelector("#pp").innerHTML === p, before);
    }
  },
  { ...W, needs: ["library"] },
);

test(
  "FTR-06 previous / next",
  async (t) => {
    await t.page.click("#bk");
    await t.page.click("#sk");
    await t.settle();
    ok(t.player.state.commands.includes("/Back") && t.player.state.commands.includes("/Skip"), "/Back and /Skip sent");
  },
  { ...W, needs: ["library"] },
);

test("FTR-07 progress strip follows the position", async (t) => {
  await t.page.waitForFunction(
    (n) => document.querySelector("#prog").getAttribute("aria-valuemax") === n,
    t.st("totlen"),
  );
  const p = await t.page.$eval("#prog", (e) => ({
    now: +e.getAttribute("aria-valuenow"),
    max: +e.getAttribute("aria-valuemax"),
    w: parseFloat(e.style.getPropertyValue("--w")),
  }));
  ok(p.now >= +t.st("secs") && p.now <= p.max, "position from secs");
  ok(Math.abs(p.w - (p.now / p.max) * 100) < 1.5, `strip width ${p.w} %`);
  const step = () =>
    t.page.evaluate(() => {
      const a = curPos(),
        end = Date.now() + 200;
      while (Date.now() < end); // no status update can come in between
      return curPos() - a;
    });
  ok((await step()) > 0.1, "advances while playing");
  t.player.state.statusPatch = { state: "pause" };
  await t.page.waitForFunction(() => !pos.playing);
  eq(await step(), 0, "stands while paused");
});

test(
  "FTR-11 tooltip of the progress strip shows the position",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#prog").classList.contains("seek"));
    const r = await t.page.$eval("#prog", (e) => {
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top + b.height / 2, w: b.width };
    });
    const total = +(await t.page.getAttribute("#prog", "aria-valuemax"));
    await t.page.mouse.move(r.x + r.w / 2, r.y);
    const tip = await t.page.getAttribute("#prog", "title");
    ok(
      new RegExp(`^\\d+:\\d\\d / ${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}$`).test(tip),
      "tooltip " + tip,
    );
    eq(t.cmds(/seek=/), [], "no seek request");
  },
  { ...R, needs: ["library"] },
);

test(
  "FTR-08 seek by click",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#prog").classList.contains("seek"));
    const r = await t.page.$eval("#prog", (e) => {
      const b = e.getBoundingClientRect();
      return { x: b.left, y: b.top + b.height / 2, w: b.width };
    });
    const total = +(await t.page.getAttribute("#prog", "aria-valuemax"));
    await t.page.mouse.click(r.x + r.w / 2, r.y);
    await t.settle();
    const s = +(t.cmds(/^\/Play\?seek=/)[0] || "").split("=")[1];
    ok(Math.abs(s - total / 2) <= 2, `seek to the middle (${s} of ${total})`);
    await t.page.mouse.click(r.x + r.w - 1, r.y);
    await t.settle();
    const last = +t
      .cmds(/^\/Play\?seek=/)
      .pop()
      .split("=")[1];
    ok(last <= total - 1, `limited to the end (${last})`);
  },
  { ...W, needs: ["library"] },
);

test(
  "FTR-09 seek with the arrow keys",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#prog").classList.contains("seek"));
    await t.page.focus("#prog");
    const p0 = await t.page.evaluate(() => curPos());
    await t.page.keyboard.press("ArrowRight");
    await t.settle();
    const right = +t.cmds(/^\/Play\?seek=/)[0].split("=")[1];
    ok(right >= p0 + 4 && right <= p0 + 7, `+5 s (${right}, position ${Math.round(p0)})`);
    await t.page.keyboard.press("ArrowLeft");
    await t.settle();
    const left = +t.cmds(/^\/Play\?seek=/)[1].split("=")[1];
    ok(left < right, `-5 s (${left})`);
  },
  { ...W, needs: ["library"] },
);

test(
  "FTR-10 no seeking when the player reports canSeek 0",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#prog").getAttribute("aria-disabled") === "true");
    await t.page.$eval("#prog", (e) => {
      const b = e.getBoundingClientRect();
      e.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top }));
    });
    await t.page.focus("#prog");
    await t.page.keyboard.press("ArrowRight");
    await t.settle();
    eq(t.cmds(/seek=/), [], "no seek request");
  },
  { statusPatch: { canSeek: "0" } },
);

test(
  "FTR-12 volume slider: rate limited while dragging, not overwritten by status",
  async (t) => {
    await t.page.waitForFunction(
      () => !document.querySelector("#vs").disabled && document.querySelector("#nt1").textContent,
    );
    // a few steps up from the current volume (restored after the test on a real player)
    const v0 = +(await t.page.inputValue("#vs")),
      v1 = Math.min(100, v0 + 5);
    await t.page.evaluate(
      ([a, b]) => {
        const s = document.querySelector("#vs");
        s.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        for (let v = a + 1; v <= b; v++) {
          s.value = v;
          s.dispatchEvent(new Event("input"));
        }
      },
      [v0, v1],
    );
    await t.settle(500);
    eq(t.reqs(/^\/Volume\?level=/), ["/Volume?level=" + v1], "one request for the burst, last value");
    await t.settle(2500); // a status update arrives
    eq(await t.page.inputValue("#vs"), String(v1), "slider kept while dragging");
    await t.page.evaluate(() => {
      const s = document.querySelector("#vs");
      s.dispatchEvent(new Event("change"));
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    await t.settle();
    eq(t.reqs(/^\/Volume\?level=/).length, 2, "once more on release");
  },
  W,
);

test(
  "FTR-13 volume buttons, slider follows the answer",
  async (t) => {
    await t.page.waitForFunction(
      () => !document.querySelector("#vs").disabled && document.querySelector("#nt1").textContent,
    );
    if (!REAL) t.player.state.overrides.push({ match: /^\/Volume\?db=2$/, body: "<volume>42</volume>" });
    const v0 = await t.page.inputValue("#vs");
    await t.page.click("#vu");
    await t.page.waitForFunction((v) => document.querySelector("#vs").value !== v, v0);
    await t.page.click("#vd");
    await t.settle();
    ok(t.reqs(/^\/Volume\?db=2$/).length === 1 && t.reqs(/^\/Volume\?db=-2$/).length === 1, "db=2 and db=-2 sent");
  },
  W,
);

test(
  "FTR-14 fixed volume disables the controls",
  async (t) => {
    await t.page.waitForFunction(() => ["#vs", "#vd", "#vu"].every((s) => document.querySelector(s).disabled));
    await t.waitText("#nt1", t.st("title1"));
  },
  { statusPatch: { volume: "-1" } },
);

// Listening mode of the player (/audioPreset): icon of the current mode (iconActive) before the volume
// controls, display only; alt text and tooltip from the displayName values of the answer.
const lmIcon = (mode) => (TD.LM.match(new RegExp(`name="${mode}"[^>]*iconActive="([^"]*)"`)) || [])[1];
const lmShown = (t, mode) =>
  t.page.waitForFunction(
    (x) => {
      const e = document.querySelector("#lm");
      return !e.hidden && e.alt === x.name && e.dataset.src.endsWith(x.icon) && /^blob:/.test(e.src);
    },
    { name: lmName(mode), icon: lmIcon(mode) },
  );
test(
  "FTR-15 listening mode icon before the volume controls, icon, alt text and tooltip from /audioPreset",
  async (t) => {
    if (!TD.LM) {
      // player without listening modes
      await t.settle(1500);
      ok(await t.page.$eval("#lm", (e) => e.hidden && e.parentElement.hidden), "icon and frame hidden");
      return;
    }
    const cur = (TD.LM.match(/<setting [^>]*value="([^"]*)"/) || [])[1];
    await lmShown(t, cur);
    ok(t.reqs(new RegExp("^" + reEsc(lmIcon(cur)) + "$")).length > 0, "iconActive read from the player");
    eq(
      await t.page.getAttribute("#lm", "title"),
      (TD.LM.match(/<setting [^>]*displayName="([^"]*)"/) || [])[1] + ": " + lmName(cur),
      "tooltip",
    );
    const filter = (theme) =>
      t.page.evaluate((th) => {
        document.documentElement.setAttribute("data-theme", th);
        return getComputedStyle(document.querySelector("#lm")).filter;
      }, theme);
    eq(await filter("light"), "invert(1)", "white icon inverted in the light design");
    eq(await filter("dark"), "none", "white icon as it is in the dark design");
    ok(
      await t.page.$eval(
        "#lm",
        (e) =>
          e.parentElement.id === "lmf" &&
          e.parentElement.parentElement.matches("#ctl .vl") &&
          e.parentElement.nextElementSibling?.id === "vd",
      ),
      "icon in its frame sits right before the volume-down button",
    );
    ok(
      await t.page.$eval("#lmf", (f) => {
        const s = getComputedStyle(f),
          i = getComputedStyle(f.firstElementChild),
          r = parseFloat(s.borderRadius || "0");
        return !f.hidden && s.borderStyle === "solid" && r > 0 && r < f.offsetWidth / 4 && +i.opacity < 1;
      }),
      "status tag look: frame with the corners of a tag (not round like the buttons), grey (dimmed) icon",
    );
    // Frame colour, compared with the colour token (computed through a probe element); no hover effect
    const look = () =>
      t.page.$eval("#lmf", (f) => {
        const p = document.body.appendChild(document.createElement("i"));
        p.style.color = "var(--line)";
        const r = {
          border: getComputedStyle(f).borderTopColor,
          opacity: +getComputedStyle(f.firstElementChild).opacity,
          line: getComputedStyle(p).color,
        };
        p.remove();
        return r;
      });
    const rest = await look();
    eq(rest.border, rest.line, "frame in the line colour");
    await t.page.hover("#lmf");
    eq(await look(), rest, "no hover effect: frame and icon unchanged");
    await t.page.mouse.move(0, 0);
    ok(
      await t.page.$eval("#lmf", (f) =>
        [f, f.firstElementChild].every(
          (e) => e.tagName !== "BUTTON" && !e.onclick && e.getAttribute("tabindex") === null,
        ),
      ),
      "display only (no button)",
    );
  },
  R,
);

test("FTR-16 listening mode follows syncStat of /Status, /audioPreset read only on a change", async (t) => {
  await lmShown(t, t.player.state.listeningMode);
  const count = () => t.player.state.requests.filter((x) => x === "/audioPreset").length;
  eq(count(), 1, "read once on connect");
  await t.settle(3500); // two more long polls with the same syncStat
  eq(count(), 1, "no further reads while syncStat stays");
  const other = [...TD.LM.matchAll(/name="(\w+)"/g)]
    .map((m) => m[1])
    .find((n) => n !== "preset" && n !== t.player.state.listeningMode);
  t.player.state.listeningMode = other;
  t.player.state.syncStat++;
  await lmShown(t, other);
  eq(count(), 2, "read again after the syncStat change");
  eq(t.cmds(/alsa_setting/), [], "no listening mode command");
});

test(
  "FTR-17 ERR-08 no listening mode icon on a player without listening modes",
  async (t) => {
    await t.settle(1500);
    ok(t.player.state.requests.includes("/audioPreset"), "asked once");
    ok(await t.page.$eval("#lm", (e) => e.hidden && !e.getAttribute("src")), "icon hidden");
    ok(await t.page.$eval("#lmf", (f) => f.hidden && getComputedStyle(f).display === "none"), "no empty frame");
    ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup");
    eq(t.errors, [], "no JavaScript errors");
  },
  { listeningModes: false },
);

test("FTR-18 ERR-08 long polling with etag, pause between requests, longer after an error", async (t) => {
  const status = () =>
    t.player.state.requests.map((r, i) => ({ r, at: t.player.state.times[i] })).filter((x) => /^\/Status\?/.test(x.r));
  await t.settle(3000);
  const s = status();
  ok(/^\/Status\?timeout=100$/.test(s[0].r), "first request without etag");
  const etag = (TD.STATUS.match(/<status etag="([^"]*)"/) || [])[1];
  eq(s[1].r, "/Status?timeout=100&etag=" + encodeURIComponent(etag), "then with the etag of the last answer");
  // The app pauses 1 s from request start to request start; the mock sees the arrival times,
  // which jitter by some 10 ms on slow runners (Safari on macOS)
  const gaps = s.slice(1).map((x, i) => x.at - s[i].at);
  ok(
    gaps.every((g) => g >= 900),
    `about 1 s between requests (${gaps.join(", ")} ms)`,
  );
  const o = { match: /^\/Status\?/, status: 500, times: 1 };
  t.player.state.overrides.push(o);
  const t0 = Date.now();
  while (!o.hits && Date.now() - t0 < 5000) await t.page.waitForTimeout(100);
  const failed = status().length - 1;
  while (status().length <= failed + 1 && Date.now() - t0 < 15000) await t.page.waitForTimeout(200);
  const a = status();
  ok(a.length > failed + 1, "polling goes on after the error");
  ok(a[failed + 1].at - a[failed].at >= 4900, `5 s pause after an error (${a[failed + 1].at - a[failed].at} ms)`);
  ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup");
  eq(
    t.player.state.requests.filter((x) => /^\/Status$|^\/Volume$/.test(x)),
    [],
    "no one-off /Status or /Volume",
  );
});

test("FTR-19 ERR-08 long polling starts again after a sleep and after a hanging request", async (t) => {
  const status = () => t.player.state.requests.filter((x) => /^\/Status\?/.test(x));
  await t.page.waitForFunction((x) => document.querySelector("#nt1").textContent === x, t.st("title1"));
  // Sleep: the long poll hangs (a connection broken during the sleep), the clock of the page jumps 60 s ahead
  let held = t.player.state.hold(/^\/Status\?.*etag=/);
  await held.asked();
  let before = status().length;
  t.player.state.statusPatch.title1 = "After the sleep";
  await t.page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 60e3;
  });
  await t.page.waitForFunction(() => document.querySelector("#nt1").textContent === "After the sleep", null, {
    timeout: 3000,
  });
  eq(status()[before], "/Status?timeout=100", "at once a new request without etag after waking up");
  await held.release();
  // Hanging request without a sleep: the clock runs fast (2.5 s per tick, below the sleep gap) until the request is
  // 115 s old
  held = t.player.state.hold(/^\/Status\?.*etag=/);
  await held.asked();
  before = status().length;
  const t0 = Date.now();
  await t.page.evaluate(() => {
    const now = Date.now;
    let off = 0;
    Date.now = () => now() + off;
    const iv = setInterval(() => (off += 1e3) > 130e3 && clearInterval(iv), 100);
  });
  while (status().length === before && Date.now() - t0 < 20000) await t.page.waitForTimeout(100);
  eq(status()[before], "/Status?timeout=100", "new request without etag");
  ok(Date.now() - t0 >= 9000, `only after the request limit (${Date.now() - t0} ms, about 11.5 s expected)`);
  await held.release();
  ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup");
  eq(t.errors, [], "no JavaScript errors");
});

test(
  "FTR-20 year after the album, read once per track",
  async (t) => {
    const song = t.st("song"),
      path = `/Playlist?start=${song}&end=${song}`,
      year = stOf(await t.player.get(path))("date");
    const asked = () => t.player.state.requests.filter((x) => x === path).length;
    await t.page.waitForFunction((y) => document.querySelector("#fy").textContent === y, year);
    const around = (p) => t.page.$eval("#fy", (e, p) => getComputedStyle(e, p).content, p);
    eq([await around("::before"), await around("::after")], ['" ("', '")"'], "year in brackets");
    eq(asked(), 1, "one request for the year");
    await t.page.click("#cvb");
    await t.settle();
    eq(await t.page.textContent("#ft3"), nowLines(t.st).full[1], "no year in the full screen");
    await t.page.keyboard.press("Escape");
    await t.settle();
    eq(asked(), 1, "not read again for the same track");
    eq(await t.page.textContent("#fy"), year, "year kept");
  },
  { ...R, needs: ["library"] },
);

test(
  "FTR-20 year follows the track; none for a stream outside the queue; no by / from for other lines",
  async (t) => {
    // the year of the playing track from the recording; queue entry 2 answers 1999 (override)
    const song = t.st("song"),
      year = stOf(await t.player.get(`/Playlist?start=${song}&end=${song}`))("date");
    ok(song !== "2" && year && year !== "1999", "the playing track is not entry 2 and has a year other than 1999");
    await t.page.waitForFunction((y) => document.querySelector("#fy").textContent === y, year);
    t.player.state.statusPatch.song = "2";
    await t.page.waitForFunction(() => document.querySelector("#fy").textContent === "1999");
    ok(t.player.state.requests.includes("/Playlist?start=2&end=2"), "queue entry of the new track");
    t.player.state.statusPatch.streamUrl = "RadioParadise:/0:4";
    t.player.state.statusPatch.title2 = "Radio Paradise";
    await t.page.waitForFunction(() => document.querySelector("#fy").textContent === "");
    await t.settle();
    eq(await t.page.textContent("#fy"), "", "no year for a stream");
    eq(await t.page.textContent("#nt2"), "Radio Paradise – " + t.st("title3"), "title2 not the artist: no by / from");
  },
  {
    overrides: [
      { match: /^\/Playlist\?start=2&end=2$/, edit: (x) => x.replace(/<date>\d+<\/date>/, "<date>1999</date>") },
    ],
  },
);

// ---------- 4.10 Full screen (FUL) ----------
test(
  "FUL-01 FUL-02 FUL-03 full screen: opens from the footer cover, no player controls, Esc",
  async (t) => {
    await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, t.st("title1"));
    await t.page.click("#cvb");
    ok(await t.page.isVisible("#full"), "full screen visible");
    eq([await t.page.textContent("#ft2"), await t.page.textContent("#ft3")], nowLines(t.st).full, "lines 2 and 3");
    if (t.st("title2") === t.st("artist") && t.st("title3") === t.st("album"))
      eq(
        await nowStyles(t.page, "#full .ftx"),
        [
          [t.st("title2"), true],
          [t.st("title3"), true],
        ],
        "artist and album bold",
      );
    ok(!(await t.page.$("#full #fy")), "no year in the full screen");
    // no player controls: the view covers the footer (also at the bottom edge), the footer is inert
    const x = VIEWPORT.width / 2,
      h = VIEWPORT.height;
    await t.page.mouse.move(x, h - 1);
    await t.settle(400);
    const atBottom = () => t.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest("#full"), [x, h - 5]);
    ok(await atBottom(), "footer covered, also with the pointer at the bottom edge");
    ok(await t.page.$eval("#ctl", (e) => e.inert), "footer inert");
    await t.page.keyboard.press("Escape");
    ok(!(await t.page.isVisible("#full")), "closed with Esc");
    ok(!(await t.page.$eval("#ctl", (e) => e.inert)), "footer usable again");
  },
  { ...R, needs: ["library"] },
);

test(
  "FUL-03 close by a click in the view and by the close button (shown while the mouse moves)",
  async (t) => {
    await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, t.st("title1"));
    await t.page.click("#cvb");
    await t.page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height * 0.4);
    ok(!(await t.page.isVisible("#full")), "closed by a click in the view");
    // close button: shown on opening, hidden after 2.5 s without mouse movement, shown again by a movement
    const shown = () => t.page.$eval("#fclose", (b) => getComputedStyle(b).opacity === "1");
    await t.page.click("#cvb");
    ok(await shown(), "close button shown on opening");
    await t.settle(2900);
    ok(!(await shown()), "close button hidden while the mouse rests");
    await t.page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height * 0.3);
    await t.settle(400);
    ok(await shown(), "close button shown again by a mouse movement");
    await t.page.click("#fclose");
    ok(!(await t.page.isVisible("#full")), "closed by the close button");
  },
  { ...R, needs: ["library"] },
);

test(
  "FUL-04 keyboard: Enter on the footer cover opens, the focus moves to the close button and back",
  async (t) => {
    await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, t.st("title1"));
    const focused = () => t.page.evaluate(() => document.activeElement.id);
    await t.page.focus("#cvb");
    await t.page.keyboard.press("Enter");
    ok(await t.page.isVisible("#full"), "opened with Enter");
    eq(await focused(), "fclose", "focus on the close button");
    await t.page.keyboard.press(" ");
    ok(!(await t.page.isVisible("#full")), "closed with Space on the close button");
    eq(await focused(), "cvb", "focus back on the footer cover");
  },
  { ...R, needs: ["library"] },
);

test("FUL-05 full screen closes when playback stops", async (t) => {
  await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, t.st("title1"));
  await t.page.click("#cvb");
  ok(await t.page.isVisible("#full"), "open");
  t.player.state.playing = false;
  await t.page.waitForFunction(() => document.querySelector("#full").hidden);
  await t.page.click("#cvb");
  ok(!(await t.page.isVisible("#full")), "cannot be opened while nothing plays");
});

test("FUL-06 background colour from the cover", async (t) => {
  await t.page.waitForFunction(() => document.querySelector("#full").style.getPropertyValue("--amb"));
  const [amb, cover] = await t.page.evaluate(() => {
    // the mock cover has one colour: its pixel is the expected ambient colour
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d");
    x.drawImage(document.querySelector("#fimg"), 0, 0, 1, 1);
    return [
      document.querySelector("#full").style.getPropertyValue("--amb"),
      [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)],
    ];
  });
  const got = (amb.match(/\d+/g) || []).map(Number);
  eq(got.length, 3, "--amb is an rgb colour: " + amb);
  ok(
    got.every((v, i) => Math.abs(v - cover[i]) <= 2),
    `--amb ${amb} matches the cover rgb(${cover.join(" ")})`,
  );
  await t.page.click("#cvb");
  ok(
    await t.page.$eval("#full", (e) => getComputedStyle(e).backgroundImage.startsWith("radial-gradient")),
    "full screen has the gradient background",
  );
});

// 1x1 PNG of one colour (covers of different colours for FUL-06)
function png1(r, g, b) {
  const zlib = require("zlib");
  const crc = (buf) => {
    let c = ~0;
    for (const x of buf) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4),
      td = Buffer.concat([Buffer.from(type), data]),
      c = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.from([0, r, g, b]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test(
  "FUL-06 background follows a new cover while the full screen is open",
  async (t) => {
    const amb = () => t.page.$eval("#full", (e) => e.style.getPropertyValue("--amb"));
    await t.page.waitForFunction(() => document.querySelector("#full").style.getPropertyValue("--amb"));
    await t.page.click("#cvb");
    eq(await amb(), "rgb(200 30 30)", "colour of the first cover");
    t.player.state.statusPatch = { image: "/Artwork?service=LocalMusic&amp;album=Blue" };
    await t.page.waitForFunction(
      () => document.querySelector("#full").style.getPropertyValue("--amb") !== "rgb(200 30 30)",
      null,
      {
        timeout: 5000,
      },
    );
    eq(await amb(), "rgb(30 60 200)", "colour of the new cover");
    ok(await t.page.isVisible("#full"), "still open");
  },
  {
    overrides: [
      { match: /^\/Artwork\?service=LocalMusic&album=Blue/, type: "image/png", body: png1(30, 60, 200) },
      { match: /^\/Artwork/, type: "image/png", body: png1(200, 30, 30) },
    ],
  },
);

test(
  "FUL-06 no readable cover: plain theme background",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#cov").hidden);
    await t.page.waitForFunction((x) => document.querySelector("#ft1").textContent === x, t.st("title1"));
    eq(await t.page.$eval("#full", (e) => e.style.getPropertyValue("--amb")), "", "no ambient colour");
  },
  { overrides: [{ match: /^\/Artwork/, status: 404, type: "text/plain" }] },
);

test(
  "POP-15 FUL-07 full-size covers in the popup and now playing, grid covers without a size",
  async (t) => {
    const full = (u) => /[?&]width=3000&height=3000&followRedirects=1$/.test(u || "");
    await t.page.waitForFunction(() => document.querySelector("#fimg").dataset.src);
    const fimg = await t.page.$eval("#fimg", (e) => e.dataset.src);
    ok(full(fimg), "now playing asks the full size: " + fimg);
    eq(await t.page.$eval("#cov", (e) => e.dataset.src), fimg, "footer and full screen share one request");
    await t.all();
    const grid = await t.page.$$eval("#grid .item img", (i) => i.map((x) => x.dataset.url).filter(Boolean));
    ok(grid.length > 0, "grid has covers");
    ok(
      grid.every((u) => /followRedirects=1$/.test(u) && !/[?&](width|height)=/.test(u)),
      "grid covers without a size",
    );
    await openLibAlbum(t);
    const dimg = await t.page.$eval("#dimg", (e) => e.dataset.src);
    ok(full(dimg), "popup asks the full size: " + dimg);
    await t.page.waitForFunction(() => /^blob:/.test(document.querySelector("#dimg").src || ""));
    ok(
      t.reqs(/^\/Artwork\?.*&width=3000&height=3000&followRedirects=1$/).length >= 2,
      "full-size requests reach the player",
    );
  },
  { ...R, needs: ["library"] },
);

// ---------- 4.11 Queue panel (QUE) ----------
test(
  "QUE-01 QUE-03 QUE-04 pinned panel, list, durations",
  async (t) => {
    await t.openQueue();
    eq(await t.page.getAttribute("#qbtn", "aria-label"), "Unpin queue", "button label");
    ok((await t.page.$eval("#qbtn", (b) => getComputedStyle(b).backgroundColor)) !== "rgba(0, 0, 0, 0)", "highlighted");
    eq(await t.page.evaluate(() => localStorage.getItem("qpin")), "1", "pin stored");
    ok(t.player.state.requests.includes("/Playlist?start=0&end=199"), "first page of the queue");
    await t.page.waitForFunction((n) => document.querySelectorAll("#qlist li").length === n, TD.QUEUE.length);
    eq(
      await t.page.$$eval("#qlist li .qn", (x) => x.map((e) => e.textContent)),
      TD.QUEUE.map((q) => String(+q.id + 1)),
      "numbers",
    );
    ok(/^\d+:\d\d$/.test((await t.page.textContent("#qlist li .qd")).trim()), "duration m:ss");
    const total = TD.QUEUE.reduce((n, q) => n + q.time, 0);
    eq(
      await t.page.textContent("#qcount"),
      `${TD.QUEUE.length} ${TD.QUEUE.length === 1 ? "track" : "tracks"}\n${fmtTime(total)}`,
      "number of tracks and total time",
    );
    await t.page.click("#msg");
    ok(await t.page.isVisible("#qside"), "stays open when clicking outside (pinned)");
    if (VIEWPORT.width >= 800)
      ok(
        await t.page.evaluate(
          () =>
            document.querySelector("#grid").getBoundingClientRect().right <=
            document.querySelector("#qside").getBoundingClientRect().left + 1,
        ),
        "grid moves aside",
      );
  },
  { ...R, needs: ["queue"] },
);

test(
  "QUE-11 save the queue as BluOS playlist",
  async (t) => {
    await t.openQueue();
    const pl = t.reqs(/key=BluOS:$/).length;
    await t.page.click("#qsave");
    await t.waitToast(new RegExp(`^Saved BluOS playlist \u201C${TEST_LIST}\u201D \\(\\d+ tracks?\\)$`));
    ok(/^Queue \d{4}-\d\d-\d\d \d\d:\d\d$/.test(t.dialogs.log[0].value), "default name " + t.dialogs.log[0].value);
    eq([t.dialogs.log[0].type, t.dialogs.log[0].ok], ["prompt", "Save"], "question popup with a name field and Save");
    eq(t.cmds(new RegExp(`^/Save\\?name=${TEST_LIST}$`)).length, 1, "save sent");
    await t.settle();
    ok(t.reqs(/key=BluOS:$/).length > pl, "playlists reloaded");
  },
  {
    ...W,
    needs: ["queue"],
    promptValue: TEST_LIST,
    cleanup: (get) => get("/Delete?service=BluOS&name=" + encodeURIComponent(TEST_LIST)),
  },
);

test(
  "QUE-02 pinned panel is restored after a reload",
  async (t) => {
    await t.openQueue();
    await t.reload();
    ok(await t.page.isVisible("#qside"), "panel open after reload");
    await t.page.click("#go");
    await t.page.waitForFunction((n) => document.querySelectorAll("#qlist li").length === n, TD.QUEUE.length);
  },
  { ...R, needs: ["queue"] },
);

test(
  "QUE-05 current track highlighted",
  async (t) => {
    await t.openQueue();
    await t.page.waitForFunction(
      (id) => document.querySelector(`#qlist li[data-id="${id}"]`)?.classList.contains("cur"),
      t.st("song"),
    );
    eq(await t.page.$$eval("#qlist li.cur", (x) => x.length), 1, "one current entry");
  },
  { ...R, needs: ["library", "queue"] },
);

test(
  "QUE-06 click on a queue entry plays it",
  async (t) => {
    await t.openQueue();
    await t.page.click("#qlist li:nth-child(3) .it", { position: { x: 10, y: 10 } });
    await t.settle();
    ok(t.player.state.commands.includes("/Play?id=" + TD.QUEUE[2].id), "/Play?id= sent");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-07 remove button (x) replaces the duration on hover, removes the track via /Delete?id=",
  async (t) => {
    await t.openQueue();
    await t.page.mouse.move(0, 0);
    const op = () => t.page.$eval("#qlist li:nth-child(2) .rm", (e) => getComputedStyle(e).opacity);
    eq(await op(), "0", "hidden without hover");
    await t.page.hover("#qlist li:nth-child(2)");
    eq(await op(), "1", "shown on hover");
    eq(
      await t.page.$eval("#qlist li:nth-child(2) .qd", (e) => getComputedStyle(e).visibility),
      "hidden",
      "duration hidden",
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
    ok(t.player.state.commands.includes("/Delete?id=" + TD.QUEUE[1].id), "/Delete?id= sent");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-08 QUE-15 after remove, shuffle and clear the queue is loaded once",
  async (t) => {
    await t.openQueue();
    await t.settle(2500);
    const loads = () => t.player.state.requests.filter((x) => /^\/Playlist\?start=0&/.test(x)).length;
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
    eq(t.cmds(/^\/Clear/).length, 1, "/Clear after confirmation");
    const q = t.dialogs.log.pop();
    ok(/Clear the whole queue/.test(q.message) && q.ok === "Clear", "question text, button Clear");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-15 clear cancelled: nothing sent",
  async (t) => {
    await t.openQueue();
    await t.page.click("#qclear");
    await t.settle();
    eq(t.cmds(/^\/Clear/), [], "no /Clear");
  },
  { ...R, needs: ["queue"], dialog: "dismiss" },
);

test(
  "QUE-09 shuffle on / off via the player, button follows /Status",
  async (t) => {
    await t.openQueue();
    const on = (await t.page.getAttribute("#qshuf", "aria-pressed")) === "true";
    for (const s of [!on, on]) {
      await t.page.click("#qshuf");
      await t.waitToast(s ? "Shuffle on" : "Shuffle off");
      await t.page.waitForSelector(`#qshuf[aria-pressed=${s}]`, { timeout: 6000 });
      ok(t.player.state.commands.includes("/Shuffle?state=" + (s ? 1 : 0)), "/Shuffle?state=" + (s ? 1 : 0) + " sent");
    }
  },
  W,
);

test(
  "QUE-10 repeat off -> queue -> track -> off via the player, button follows /Status",
  async (t) => {
    await t.openQueue();
    const labels = { 2: "off", 0: "queue", 1: "track" },
      next = { 2: "0", 0: "1", 1: "2" };
    const label = (await t.page.getAttribute("#qrep", "aria-label")).replace("Repeat: ", "");
    let v = Object.keys(labels).find((k) => labels[k] === label);
    ok(v !== undefined, "repeat state at start: " + label);
    for (let i = 0; i < 3; i++) {
      v = next[v];
      await t.page.click("#qrep");
      await t.page.waitForSelector(`#qrep[aria-label="Repeat: ${labels[v]}"]`, { timeout: 6000 });
      ok(t.player.state.commands.includes("/Repeat?state=" + v), "/Repeat?state=" + v + " sent");
      eq(await t.page.getAttribute("#qrep", "aria-pressed"), String(v !== "2"), "highlighted unless off");
    }
  },
  W,
);

test(
  "QUE-12 save cancelled: no request",
  async (t) => {
    await t.openQueue();
    await t.page.click("#qsave");
    await t.settle();
    eq(t.cmds(/^\/Save/), [], "no /Save");
  },
  { ...R, needs: ["queue"], dialog: "dismiss" },
);

test(
  "QUE-12 ERR-04 save not successful: popup with request, status and answer",
  async (t) => {
    await t.openQueue();
    await t.page.click("#qsave");
    await t.page.waitForSelector("#apidlg[open]");
    eq(await t.page.textContent("#apit"), "Saving the playlist did not succeed", "title");
    eq(await t.page.textContent("#apiu"), "/Save?name=" + encodeURIComponent(TEST_LIST), "request without host");
    ok(/^200/.test(await t.page.textContent("#apis")), "HTTP status");
    eq(await t.page.textContent("#apib"), "<saved><entries>0</entries></saved>", "raw answer");
    ok(await t.page.evaluate(() => document.activeElement.id !== "apiclose"), "close button not focused");
    await t.page.click("#apiclose");
    t.player.state.overrides[0] = { match: /^\/Save/, status: 500, body: "" };
    await t.page.click("#qsave");
    await t.page.waitForSelector("#apidlg[open]");
    eq(await t.page.textContent("#apib"), "(empty response)", "empty answer");
    ok(/^500/.test(await t.page.textContent("#apis")), "HTTP 500");
  },
  { promptValue: TEST_LIST, overrides: [{ match: /^\/Save/, body: "<saved><entries>0</entries></saved>" }] },
);

test(
  "QUE-16 empty queue: buttons disabled, no count",
  async (t) => {
    await t.page.click("#qbtn");
    await t.page.waitForFunction(() => document.querySelector("#qsave").disabled);
    ok(
      await t.page.evaluate(() =>
        ["#qsave", "#qclear", "#qshuf", "#qrep"].every((s) => document.querySelector(s).disabled),
      ),
      "save, clear, shuffle, repeat disabled",
    );
    eq(await t.page.textContent("#qcount"), "", "no count");
  },
  { mock: (s) => (s.queueEmpty = true) },
);

test(
  "QUE-16 long queue: pages of 200, at most 2000 entries",
  async (t) => {
    await t.page.click("#qbtn");
    await t.page.waitForFunction(() => document.querySelectorAll("#qlist li").length === 2000, null, {
      timeout: 15000,
    });
    eq(
      [...new Set(t.reqs(/^\/Playlist\?/))].filter((u) => !/start=(\d+)&end=\1$/.test(u)).sort(), // without the year
      Array.from({ length: 10 }, (_, i) => `/Playlist?start=${i * 200}&end=${i * 200 + 199}`).sort(),
      "ten pages",
    );
    ok((await t.page.textContent("#qcount")).startsWith("2500 tracks"), "count of the whole queue");
  },
  { mock: (s) => (s.queueSize = 2500) },
);

test(
  "QUE-16 queue cannot be loaded",
  async (t) => {
    await t.page.click("#qbtn");
    await t.waitText("#qcount", "Could not load queue");
    const p = await t.apiPopup("Loading the queue did not succeed");
    ok(/^\/Playlist\?/.test(p.u), "queue request: " + p.u);
  },
  { overrides: [{ match: /^\/Playlist\?start=0&end=199$/, status: 500 }] }, // only the queue, not the year
);

// Titles of the queue rows, in their order
const qTitles = (t) => t.page.$$eval("#qlist li .qt b", (x) => x.map((e) => e.textContent));
// Waits until the queue panel has slid in (the row positions are read for mouse moves)
const qStill = (t) =>
  t.page.waitForFunction(
    () => {
      const r = document.querySelector("#qside").getBoundingClientRect();
      const was = window.__qRight;
      window.__qRight = r.right;
      return was === r.right && r.right <= innerWidth;
    },
    null,
    { polling: 100 },
  );
// Drags queue row `from` (0-based) by its number (never a link, which would not start a drag) with the mouse to
// `frac` of the height of row `over` (0 = its top edge)
const dragRow = async (t, from, over, frac) => {
  await qStill(t);
  const box = async (sel) => (await t.page.$(sel)).boundingBox();
  const a = await box(`#qlist li:nth-child(${from + 1}) .qn`),
    b = await box(`#qlist li:nth-child(${over + 1})`),
    x = a.x + a.width / 2;
  await t.page.mouse.move(x, a.y + a.height / 2);
  await t.page.mouse.down();
  await t.page.mouse.move(x, b.y + b.height * frac, { steps: 12 });
  const during = await t.page.evaluate(() => ({
    drag: document.querySelectorAll("#qlist li.drag").length,
    line: [...document.querySelectorAll("#qlist li")].findIndex((l) => l.matches(".dropb, .dropa")),
    cls: document.querySelector("#qlist .dropb, #qlist .dropa")?.className || "",
  }));
  await t.page.mouse.up();
  await t.settle(300);
  return during;
};
// Moves entry `from` to `to` in a list (position afterwards, like /Move)
const moved = (list, from, to) => {
  const l = [...list];
  l.splice(to, 0, ...l.splice(from, 1));
  return l;
};

test(
  "QUE-17 drag an entry down: line where it lands, /Move?new=3&old=0, list reordered, no play",
  async (t) => {
    await t.openQueue();
    await t.settle(2500);
    const before = await qTitles(t),
      loads = () => t.player.state.requests.filter((x) => x === "/Playlist?start=0&end=199").length,
      n = loads();
    const during = await dragRow(t, 0, 3, 0.75);
    eq(during.drag, 1, "dragged row dimmed");
    eq([during.line, during.cls.includes("dropb")], [4, true], "line above the fifth row");
    eq(await qTitles(t), moved(before, 0, 3), "rows reordered at once");
    eq(
      await t.page.$$eval("#qlist li", (x) => x.map((e) => e.dataset.id + ":" + e.querySelector(".qn").textContent)),
      before.map((_, i) => i + ":" + (i + 1)),
      "rows numbered again",
    );
    eq(t.cmds(/^\/Move/), ["/Move?new=3&old=0"], "/Move sent");
    eq(t.cmds(/^\/Play\?id=/), [], "no track started by the drag");
    await t.settle(3500);
    eq(loads() - n, 1, "queue loaded once (new playlist id)");
    eq(await qTitles(t), moved(before, 0, 3), "order of the player");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-17 drag an entry up: /Move?new=1&old=4",
  async (t) => {
    await t.openQueue();
    const before = await qTitles(t);
    await dragRow(t, 4, 1, 0.25);
    eq(t.cmds(/^\/Move/), ["/Move?new=1&old=4"], "/Move sent");
    eq(await qTitles(t), moved(before, 4, 1), "rows reordered");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-17 the playing entry keeps its mark when it moves",
  async (t) => {
    await t.openQueue();
    const cur = +t.st("song");
    await t.page.waitForFunction(
      (id) => document.querySelector(`#qlist li[data-id="${id}"]`)?.classList.contains("cur"),
      cur,
    );
    const title = await t.page.textContent("#qlist li.cur .qt b"),
      to = cur > 0 ? 0 : 2,
      loads = () => t.player.state.requests.filter((x) => x === "/Playlist?start=0&end=199").length,
      n = loads();
    await dragRow(t, cur, to, to ? 0.75 : 0.25);
    eq(t.cmds(/^\/Move/), [`/Move?new=${to}&old=${cur}`], "/Move sent");
    // Checked after the reload of the queue (new playlist id): a /Status answer still on its way during the
    // drag may carry the old position for a moment
    for (let i = 0; i < 60 && loads() === n; i++) await t.settle(100);
    await t.settle(500);
    eq(loads() - n, 1, "queue loaded again (new playlist id)");
    eq(await t.page.textContent("#qlist li.cur .qt b"), title, "same entry marked");
    eq(await t.page.getAttribute("#qlist li.cur", "data-id"), String(to), "at its new position");
  },
  { ...W, needs: ["library", "queue"] },
);

test(
  "QUE-18 a short pointer movement is a click; dropping at the same place sends nothing",
  async (t) => {
    await t.openQueue();
    await qStill(t);
    const b = await (await t.page.$("#qlist li:nth-child(3) .it")).boundingBox();
    await t.page.mouse.move(b.x + 40, b.y + b.height / 2);
    await t.page.mouse.down();
    await t.page.mouse.move(b.x + 40, b.y + b.height / 2 + 3);
    await t.page.mouse.up();
    await t.settle();
    eq(t.cmds(/^\/Play\?id=/), ["/Play?id=" + TD.QUEUE[2].id], "click plays the entry");
    await dragRow(t, 2, 3, 0.3);
    await t.settle();
    eq(t.cmds(/^\/Move/), [], "no /Move for the same place");
    eq(t.cmds(/^\/Play\?id=/).length, 1, "no play after the drag");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-19 keyboard: Alt + arrow down / up moves the focused entry by one place",
  async (t) => {
    await t.openQueue();
    const before = await qTitles(t);
    await t.page.focus("#qlist li:nth-child(1) .it");
    await t.page.keyboard.press("Alt+ArrowUp");
    eq(t.cmds(/^\/Move/), [], "first entry: not up");
    await t.page.keyboard.press("Alt+ArrowDown");
    await t.settle(300);
    eq(t.cmds(/^\/Move/), ["/Move?new=1&old=0"], "/Move sent");
    eq(await qTitles(t), moved(before, 0, 1), "rows reordered");
    eq(await t.page.evaluate(() => document.activeElement.closest("li").dataset.id), "1", "focus stays on the entry");
  },
  { ...W, needs: ["queue"] },
);

test(
  "QUE-20 move not successful: popup, queue read again",
  async (t) => {
    await t.openQueue();
    const before = await qTitles(t),
      loads = () => t.player.state.requests.filter((x) => x === "/Playlist?start=0&end=199").length,
      n = loads();
    await dragRow(t, 0, 3, 0.75);
    const p = await t.apiPopup("The player command did not succeed");
    eq(p.u, "/Move?new=3&old=0", "request");
    await t.settle();
    ok(loads() > n, "queue read again");
    eq(await qTitles(t), before, "order of the player");
  },
  { overrides: [{ match: /^\/Move\?/, status: 500 }] },
);

// ---------- 4.12 Playlists (PLS) ----------
test(
  'PLS-01 Playlists chip: random playlist tile, groups BluOS / library, tiles with cover, name and "Playlist", list read again',
  async (t) => {
    const n = t.reqs(/key=BluOS:$/).length;
    await openPlaylists(t);
    eq(await t.page.getAttribute("#az .plc", "aria-pressed"), "true", "chip selected");
    const [first, ...lines] = plGroups();
    eq(await t.page.textContent("#msg"), first, "status line names the first group");
    eq(await t.$$text("#grid .gl"), lines, "a line for the library playlists");
    eq(
      await t.$$text("#grid .item:not(:has(.rnd)) b"),
      plNames(),
      "one tile per playlist: BluOS, then library, each in the player's order",
    );
    eq(
      await t.$$text("#grid .item:not(:has(.rnd)) > .card.static"),
      plNames().map(() => "Playlist"),
      "second line",
    );
    eq(await t.page.$$("#grid .item .ar"), [], "no artist link");
    eq(
      await t.$$text("#grid .item:first-child > .card"),
      ["Random playlist", "from " + nPl(plNames().length)],
      "random playlist tile first, for all playlists",
    );
    eq(
      await t.page.$$eval("#grid .item .cov img", (x) => x.length),
      [...TD.PL, ...TD.LPL].filter((p) => p.image).length,
      "cover of every playlist with an image",
    );
    await t.page.hover("#grid .item:nth-child(2)");
    eq(await t.page.$$("#grid .item:nth-child(2) .favc"), [], "BluOS playlist: no heart");
    ok(await t.page.isVisible("#grid .item:nth-child(2) .delp"), "delete button");
    ok(await t.page.isVisible("#grid .item:nth-child(2) .addq"), "add button");
    ok(t.reqs(/key=BluOS:$/).length > n, "playlists read again");
    if (TD.LPL.length) {
      const tile = await openTile(t, TD.LPL[0].text);
      await t.page.hover(tile);
      ok(await t.page.isVisible(tile + " .addq"), "library playlist: add button");
      ok(await t.page.isVisible(tile + " .favc"), "library playlist: heart");
      eq(await t.page.$$(tile + " .delp"), [], "library playlist: no delete button");
    }
  },
  { ...R, needs: ["playlist"] },
);

test(
  "PLS-02 playing a playlist reloads the open queue once",
  async (t) => {
    await t.openQueue();
    await openPlaylists(t);
    await t.settle(2500);
    const loads = () => t.player.state.requests.filter((x) => /^\/Playlist\?start=0&/.test(x)).length;
    const n = loads();
    await playPlaylist(t, TD.PL[0].text);
    await t.waitToast("Playing playlist: " + TD.PL[0].text);
    ok(t.player.state.commands.includes(decodeURIComponent(TD.PL[0].playURL)), "play URL of the playlist");
    await t.settle(3000);
    eq(loads() - n, 1, "queue reloaded once (new playlist id, or after 1.5 s when it stays)");
  },
  { ...W, needs: ["playlist"] },
);

test(
  "PLS-02 play URL from the context menu when the playlist has no playURL",
  async (t) => {
    await playPlaylist(t, TD.PL[0].text);
    await t.settle();
    eq(t.cmds(/^\/Add\?clear=0&playlist=/).length, 1, "play action of the context menu");
  },
  {
    overrides: [
      {
        match: /key=BluOS:$/,
        edit: (x) => x.replace(/ playURL="[^"]*"/g, "").replace(/type="add-now"/g, 'type="play-now"'),
      },
    ],
  },
);

test(
  "PLS-03 player without playlists: no chip, no statistic",
  async (t) => {
    eq(await t.page.$$("#az .plc"), [], "no Playlists chip");
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.waitText("#infodlg", /Composers\s*[\d,]/);
    ok(!/Playlists/.test(await t.page.textContent("#info")), "no Playlists statistic");
  },
  {
    overrides: [
      { match: TOP, edit: (x) => x.replace(/\s*<item browseKey="BluOS:"[^>]*><\/item>/, "") },
      { match: /key=[^&]*%3APlaylist%2F/, edit: (x) => x.replace(/<item [\s\S]*<\/item>/, "") },
    ],
  },
);

test(
  "PLS-03 player with library playlists only: chip, only the library group",
  async (t) => {
    await openPlaylists(t);
    eq(await t.page.textContent("#msg"), nPl(TD.LPL.length, "library"), "status line");
    eq(await t.$$text("#grid .gl"), [], "no group line");
    eq(
      await t.$$text("#grid .item:not(:has(.rnd)) b"),
      TD.LPL.map((p) => p.text),
      "library playlists",
    );
  },
  { overrides: [{ match: TOP, edit: (x) => x.replace(/\s*<item browseKey="BluOS:"[^>]*><\/item>/, "") }] },
);

test(
  "PLS-04 Playlists chip stays after New after a source change",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#srcl .srow:nth-child(2) .sw");
    await t.settle(800);
    await t.page.click("#srcl .srow:nth-child(2) .sw");
    await t.waitMsg(/in favourites/);
    eq(await t.$$text("#az .plc"), ["Playlists"], "chip");
    eq(await t.page.$eval("#az .plc", (b) => b.previousElementSibling.textContent), "New", "after New");
  },
  { ...U, needs: ["usb", "playlist"] },
);

test(
  "PLS-05 BluOS playlists over several pages",
  async (t) => {
    await openPlaylists(t);
    eq(
      await t.$$text("#grid .item:not(:has(.rnd)) b"),
      [...TD.PL.map((p) => p.text), "Page two", ...TD.LPL.map((p) => p.text)],
      "BluOS playlists of both pages",
    );
  },
  {
    overrides: [
      { match: /key=BluOS:$/, edit: (x) => x.replace(/<browse /, '<browse nextKey="BluOS:page2" ') },
      {
        match: /key=BluOS:page2$/,
        body: '<browse><item text="Page two" playURL="/Load?service=BluOS&amp;name=Page+two" type="playlist"></item></browse>',
      },
    ],
  },
);

test(
  "PLS-06 add a playlist to the end of the queue",
  async (t) => {
    const name = TD.PL[0].text,
      tile = await openTile(t, name);
    await t.page.hover(tile);
    await t.page.click(tile + " .addq");
    await t.waitToast("Added to queue: " + name);
    eq(t.cmds(/^\/Add\?playlist=.*&where=last$/).length, 1, "add-last of the playlist's context menu");
  },
  { ...W, needs: ["playlist"] },
);

test(
  "PLS-07 playlist popup: name, track count and time, tracks of every page, not cached; library playlist: source, tracks",
  async (t) => {
    const p = TD.PL[0];
    await openPlaylistPopup(t, p.text);
    eq(await t.page.textContent("#dt"), p.text, "name");
    eq((await t.page.textContent("#da")).trim(), "Playlist", "second line");
    ok(!(await t.page.$("#da button")), "no artist link");
    const secs = TD.PL_TRK.reduce((n, x) => n + (+x.duration || 0), 0);
    eq(
      await t.page.textContent("#dlen"),
      [nTr(TD.PL_TRK.length), secs && fmtTime(secs)].filter(Boolean).join(" · "),
      "track count and total time",
    );
    eq(
      await trackRows(t),
      TD.PL_TRK.map((x, i) => [String(i + 1), x.text, x.duration ? fmtTime(+x.duration) : ""]),
      "position, title and duration of every track",
    );
    eq(
      await t.$$text("#tracks .ta"),
      TD.PL_TRK.map((x) => x.text2),
      "track artist and album per track",
    );
    eq((await t.page.textContent("#dy")) + (await t.page.textContent("#dtech")), "", "no year, no quality");
    const n = t.reqs(/BluOS-Playlist/).length;
    await t.page.click("#close");
    await openPlaylistPopup(t, p.text);
    ok(t.reqs(/BluOS-Playlist/).length > n, "read again when opened again");
    // A library playlist: its source, all tracks in one answer
    if (!TD.LPL.length) return;
    const lp = TD.LPL[0],
      svc = lp.browseKey.split(":")[0];
    await t.page.click("#close");
    await openPlaylistPopup(t, lp.text);
    eq(await t.page.textContent("#dt"), lp.text, "library playlist: name");
    eq(
      (await t.page.textContent("#ds")).trim(),
      TD.SRC.find((x) => x.browseKey.split(":")[0] === svc).text,
      "library playlist: source",
    );
    eq(
      await trackRows(t),
      TD.LPL_TRK.map((x, i) => [String(i + 1), x.text, x.duration ? fmtTime(+x.duration) : ""]),
      "library playlist: every track",
    );
    eq(
      await t.$$text("#tracks .ta"),
      TD.LPL_TRK.map((x) => x.text2),
      "library playlist: track artist and album",
    );
  },
  { ...R, needs: ["playlist"] },
);

test(
  "PLS-08 click on a playlist track plays the playlist from that track",
  async (t) => {
    await openPlaylistPopup(t, TD.PL[0].text);
    const last = TD.PL_TRK[TD.PL_TRK.length - 1];
    await t.page.click("#tracks li:last-child .tp", { position: { x: 10, y: 10 } });
    await t.waitToast("Track started");
    ok(t.player.state.commands.includes(decodeURIComponent(last.autoplayURL || last.playURL)), "track URL");
  },
  { ...W, needs: ["playlist"] },
);

test(
  "PLS-09 empty search field returns to the Playlists view",
  async (t) => {
    await openPlaylists(t);
    await t.openSearch();
    await t.page.fill("#q", TD.TERM);
    await t.page.press("#q", "Enter");
    await t.waitMsg(/ with \u201C/);
    await t.page.fill("#q", "");
    await t.waitMsg(plGroups()[0]);
    eq(await t.page.getAttribute("#az .plc", "aria-pressed"), "true", "chip pressed again");
    eq(await t.$$text("#grid .item:not(:has(.rnd)) b"), plNames(), "playlist tiles");
    ok(await t.page.$("#grid .item:first-child .rnd"), "random playlist tile first");
  },
  { ...R, needs: ["playlist"] },
);

test(
  "PLS-10 delete a playlist with the button on its tile: confirm, request, toast, tile gone",
  async (t) => {
    // real player: a playlist saved for this test (never one of the owner's)
    const name = REAL ? TEST_LIST : TD.PL[TD.PL.length - 1].text,
      tile = await openTile(t, name);
    await t.page.hover(tile);
    eq(await t.page.getAttribute(tile + " .delp", "aria-label"), "Delete playlist " + name, "button label");
    const n = t.reqs(/key=BluOS:$/).length;
    await t.page.click(tile + " .delp");
    await t.waitToast(`Deleted playlist \u201C${name}\u201D`);
    const q = t.dialogs.log.pop();
    ok(q.message.includes(name) && q.ok === "Delete", "question names the playlist, button Delete");
    eq(t.cmds(/^\/Delete\?/).length, 1, "one delete");
    ok(/^\/Delete\?name=.+&service=BluOS$/.test(t.cmds(/^\/Delete\?/)[0]), "delete action of the context menu");
    await t.settle();
    ok(t.reqs(/key=BluOS:$/).length > n, "playlists reloaded");
    ok(!(await t.$$text("#grid .item b")).includes(name), "tile gone");
  },
  {
    ...W,
    before: (get) => get("/Save?name=" + encodeURIComponent(TEST_LIST)),
    cleanup: (get) => get("/Delete?service=BluOS&name=" + encodeURIComponent(TEST_LIST)),
  },
);

test(
  "PLS-11 delete cancelled: nothing sent",
  async (t) => {
    const tile = await openTile(t, TD.PL[0].text);
    await t.page.hover(tile);
    await t.page.click(tile + " .delp");
    await t.settle();
    eq(t.cmds(/^\/Delete\?/), [], "no delete");
    eq(await t.$$text("#grid .item:not(:has(.rnd)) b"), plNames(), "all tiles stay");
  },
  { ...R, needs: ["playlist"], dialog: "dismiss" },
);

test(
  "PLS-11 delete not successful: popup",
  async (t) => {
    const tile = await openTile(t, TD.PL[0].text);
    await t.page.hover(tile);
    await t.page.click(tile + " .delp");
    await t.page.waitForSelector("#apidlg[open]");
    eq(await t.page.textContent("#apit"), "Deleting the playlist did not succeed", "title");
    eq(await t.page.textContent("#apib"), "<error>Test failure</error>", "raw answer");
  },
  { overrides: [{ match: /^\/Delete\?name=/, body: "<error>Test failure</error>" }] },
);

test(
  "PLS-12 random playlist: play button plays a playlist of the view",
  async (t) => {
    await openPlaylists(t);
    await t.page.hover("#grid .item:first-child");
    eq(
      await t.page.getAttribute("#grid .item:first-child .play:not(.addq)", "aria-label"),
      "Play a random playlist",
      "label",
    );
    await t.page.click("#grid .item:first-child .play:not(.addq)");
    await t.waitToast(/^Playing playlist: .+$/);
    const name = (await t.page.textContent("#toast")).replace(/^Playing playlist: /, ""),
      p = [...TD.PL, ...TD.LPL].find((x) => x.text === name);
    ok(p, "a playlist of the view: " + name);
    ok(t.player.state.commands.includes(decodeURIComponent(p.playURL)), "its play URL");
  },
  { ...W, needs: ["playlist"] },
);

test(
  "PLS-12 random playlist: add button appends a playlist of the view",
  async (t) => {
    await openPlaylists(t);
    await t.page.hover("#grid .item:first-child");
    await t.page.click("#grid .item:first-child .addq");
    await t.waitToast(/^Added to queue: .+$/);
    const name = (await t.page.textContent("#toast")).replace(/^Added to queue: /, "");
    ok(plNames().includes(name), "a playlist of the view: " + name);
    eq(t.cmds(/^\/Add\?playlist(id)?=.*&where=last$/).length, 1, "add-last of its context menu");
  },
  { ...W, needs: ["playlist"] },
);

test("PLS-13 library playlist: the heart adds and removes the favourite via the player", async (t) => {
  const p = TD.LPL[0],
    tile = await openTile(t, p.text),
    heart = tile + " .favc",
    pressed = (v) =>
      t.page.waitForFunction(([s, x]) => document.querySelector(s).getAttribute("aria-pressed") === x, [heart, v]);
  await t.page.hover(tile);
  eq(await t.page.getAttribute(heart, "aria-pressed"), "false", "empty heart");
  eq(await t.page.getAttribute(heart, "aria-label"), "Add to favourites: " + p.text, "label");
  await t.page.click(heart);
  await t.waitToast("Added to favourites");
  ok(
    /^\/AddFavourite\?playlistid=.+&service=LocalMusic$/.test(t.cmds(/^\/AddFavourite/)[0] || ""),
    "AddFavourite of its menu",
  );
  await pressed("true");
  eq(t.reqs(/CM\/LocalMusic-Playlist.*isFavourite=1/).length, 1, "context menu read again with isFavourite=1");
  await t.page.click(heart);
  await t.waitToast("Removed from favourites");
  ok(/^\/DeleteFavourite\?playlistid=/.test(t.cmds(/^\/DeleteFavourite/)[0] || ""), "DeleteFavourite of its menu");
  await pressed("false");
});

// ---------- 4.13 Settings panel (SET) ----------
test(
  "SET-01 settings panel opens and closes (button, back, scrim, Esc)",
  async (t) => {
    const open = () => t.page.$eval("#side", (e) => e.classList.contains("open"));
    for (const [name, close] of [
      ["back button", () => t.page.click("#sclose")],
      ["scrim", () => t.page.mouse.click(VIEWPORT.width - 10, VIEWPORT.height / 2)],
      ["Esc", () => t.page.keyboard.press("Escape")],
    ]) {
      await t.page.click("#gear");
      ok(await open(), "open before " + name);
      eq(await t.page.getAttribute("#gear", "aria-expanded"), "true", "aria-expanded");
      await t.settle(300);
      await close();
      await t.settle(300);
      ok(!(await open()), "closed with the " + name);
      eq(await t.page.getAttribute("#gear", "aria-expanded"), "false", "aria-expanded after " + name);
    }
  },
  R,
);

test(
  "SET-02 SET-03 chip switches hide genres / quality, stored, on again; Playlists chip always shown; filter button hides the chip row",
  async (t) => {
    await t.page.click("#gear");
    const visible = () =>
      t.page.$$eval("#az > button", (x) =>
        x.filter((e) => e.offsetParent).map((e) => e.getAttribute("aria-label") || e.textContent),
      );
    const before = await visible();
    ok(!(await t.page.$("#psw")), "no switch for the Playlists chip");
    await t.page.click("#gsw");
    await t.page.click("#qsw");
    eq(await visible(), ["All", "Favourites", "New", "Playlists"], "only special chips and Playlists left");
    eq(await t.page.$$eval("#az .gap", (x) => x.filter((e) => e.offsetParent).length), 0, "no separator left");
    await t.reload();
    await t.settle(200);
    for (const s of ["#gsw", "#qsw"]) eq(await t.page.getAttribute(s, "aria-checked"), "false", s + " remembered");
    await t.connect();
    await t.openPanel();
    await t.page.click("#gsw");
    await t.page.click("#qsw");
    eq(await visible(), before, "all chips back");
    // Filter button in the header: hides / shows the whole chip row, the status line stays; highlighted while shown
    await t.page.click("#sclose");
    const fbtn = () =>
      t.page.$eval("#fbtn", (b) => [b.getAttribute("aria-expanded"), getComputedStyle(b).backgroundColor]);
    const [on, accent] = await fbtn();
    ok(on === "true" && accent !== "rgba(0, 0, 0, 0)", "chip row shown by default, button highlighted");
    await t.page.click("#fbtn");
    ok(!(await t.page.isVisible("#az")) && (await t.page.isVisible("#stl")), "chip row hidden, status line stays");
    await t.page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2); // off the button: no hover tint
    eq(await fbtn(), ["false", "rgba(0, 0, 0, 0)"], "button not highlighted");
    await t.reload();
    await t.settle(200);
    await t.connect();
    ok(!(await t.page.isVisible("#az")), "hidden chip row remembered");
    await t.page.click("#fbtn");
    ok(await t.page.isVisible("#az"), "chip row back");
  },
  R,
);

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
    const grid = getComputedStyle(document.querySelector("#grid"));
    return {
      tile: document.querySelector("#grid .item:not(:first-child)").getBoundingClientRect().width,
      colGap: parseFloat(grid.columnGap),
      rowGap: parseFloat(grid.rowGap),
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

test(
  "SET-04 SET-05 LAY-01 every cover size in every design, no horizontal scrolling, readable titles",
  async (t) => {
    await t.all();
    for (const d of DESIGNS) {
      await t.page.emulateMedia({ colorScheme: d.scheme });
      const widths = [];
      const gaps = [];
      for (const size of ["s", "m", "l"]) {
        await t.page.click("#gear");
        await t.page.click(`#themes [data-theme="${d.theme}"]`);
        await t.page.click(`#sizes [data-size="${size}"]`);
        eq(await t.page.getAttribute(`#sizes [data-size="${size}"]`, "aria-pressed"), "true", "size segment pressed");
        await t.page.keyboard.press("Escape");
        await t.settle(300);
        const l = await wallLayout(t.page);
        const at = `${d.theme} (system ${d.scheme}), ${size.toUpperCase()}`;
        ok(l.overflow <= 0, `${at}: no horizontal scrolling (${l.overflow} px too wide)`);
        eq(l.dark, d.dark, `${at}: dark background`);
        ok(l.contrast >= 4.5, `${at}: title contrast ${l.contrast} (at least 4.5)`);
        ok(l.rowGap > l.colGap, `${at}: more space between rows (${l.rowGap} px) than columns (${l.colGap} px)`);
        widths.push(l.tile);
        gaps.push(l.colGap);
      }
      ok(widths[0] < widths[1] && widths[1] < widths[2], `${d.theme}: S < M < L (${widths.join(" / ")} px)`);
      ok(gaps[0] < gaps[1] && gaps[1] < gaps[2], `${d.theme}: spacing S < M < L (${gaps.join(" / ")} px)`);
    }
    eq(
      await t.page.evaluate(() => [localStorage.getItem("theme"), localStorage.getItem("tile")]),
      ["system", "l"],
      "stored",
    );
  },
  R,
);

test(
  "SET-06 stored cover size and design are restored before connecting",
  async (t) => {
    eq(await t.page.getAttribute("html", "data-theme"), "dark", "design");
    eq(
      await t.page.evaluate(() => document.documentElement.style.getPropertyValue("--tile")),
      await t.page.evaluate(() => TILE.l),
      "cover size",
    );
    eq(await t.page.getAttribute('#themes [data-theme="dark"]', "aria-pressed"), "true", "design segment");
    eq(await t.page.getAttribute('#sizes [data-size="l"]', "aria-pressed"), "true", "size segment");
  },
  { ...R, connect: false, storage: { theme: "dark", tile: "l" } },
);

test(
  "SET-07 invalid stored values fall back to System and M",
  async (t) => {
    eq(await t.page.getAttribute("html", "data-theme"), null, "System design");
    eq(
      await t.page.evaluate(() => document.documentElement.style.getPropertyValue("--tile")),
      await t.page.evaluate(() => TILE.m),
      "size M",
    );
    eq(await t.page.getAttribute('#themes [data-theme="system"]', "aria-pressed"), "true", "design segment");
    eq(await t.page.getAttribute('#sizes [data-size="m"]', "aria-pressed"), "true", "size segment");
  },
  { ...R, connect: false, storage: { theme: "x", tile: "x" } },
);

test(
  "SET-08 SET-09 library settings and version in the panel",
  async (t) => {
    await t.page.click("#gear");
    const onoff = await t.page.evaluate(() => ONOFF);
    await t.waitText("#libset", "Music Library Settings");
    const rows = await t.page.$$eval("#libset dt", (x) =>
      x.map((e) => [e.textContent, e.nextElementSibling.textContent]),
    );
    const share = TD.SET.share && /^\s*$|no shares|keine/i.test(TD.SET.share) ? "None" : TD.SET.share || "None";
    eq(
      rows,
      [
        ["Network shares", share],
        ["Optimize artwork", onoff[TD.SET.resizeall] || TD.SET.resizeall],
        ["Server mode", onoff[TD.SET.server] || TD.SET.server],
      ].filter((x) => x[1]),
      "library settings",
    );
    eq(await t.page.textContent("#ver"), "v" + (await t.page.evaluate(() => APP.version)), "version");
  },
  R,
);

test(
  "SET-08 no network shares: None",
  async (t) => {
    await t.page.click("#gear");
    await t.waitText("#libset", "Network shares");
    eq(await t.page.$eval("#libset dt", (e) => e.nextElementSibling.textContent), "None", "network shares");
  },
  {
    overrides: [
      { match: /^\/Settings$/, edit: (x) => x.replace(/(<setting id="sharecfg"[^>]*description=")[^"]*"/, '$1"') },
    ],
  },
);

// ---------- 4.14 About popup (ABT) ----------
test(
  "ABT-01 about: name, version, copyright, GitHub link, notice, player info",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.page.waitForSelector("#infodlg[open]");
    await t.waitText("#infodlg", /BluOS version\s*\S/);
    await t.waitText("#infodlg", "Playlists");
    const app = await t.page.evaluate(() => APP);
    const txt = await t.page.textContent("#infodlg");
    ok(
      txt.includes(app.name) && txt.includes("Version v" + app.version) && /Copyright © \d{4} \S/.test(txt),
      "header lines",
    );
    ok(/Albums/.test(txt) && /Playlists/.test(txt), "stats");
    ok(txt.includes("BluOS version" + TD.VER.bluos) && txt.includes("API version" + TD.VER.api), "player versions");
    ok(txt.includes("Room" + TD.SET.room), "room name");
    ok(
      await t.page.$eval("#infodlg .abt", (a) => {
        const l = a.firstElementChild;
        return l.matches("svg.logo") && l.nextElementSibling.tagName === "H2" && l.getBoundingClientRect().width > 0;
      }),
      "logo above the app name",
    );
    ok(!/independent project/.test(await t.page.textContent("#infodlg .abt")), "no independence notice");
    const link = await t.page.$eval("#infodlg a#repo", (a) => ({
      href: a.href,
      text: a.textContent,
      target: a.target,
    }));
    eq(link, { href: app.repo, text: app.repo.replace(/^https:\/\//, ""), target: "_blank" }, "GitHub link");
  },
  R,
);

test(
  "ABT-02 statistics and versions are loaded when the popup opens, once",
  async (t) => {
    const count = () => t.reqs(/^\/(GitVersion|Version)$|bySection:(Album|Artist|Song|Composer)/).length;
    eq(count(), 0, "nothing before the popup");
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.waitText("#infodlg", /Composers\s*[\d,]/);
    await t.waitText("#infodlg", "BluOS version");
    eq(count(), 2 + TD.STAT_LISTS, "versions + the statistics lists of every source");
    await t.page.click("#infoclose");
    await t.page.click("#aboutb");
    await t.settle(300);
    eq(count(), 2 + TD.STAT_LISTS, "second opening: no new requests");
  },
  R,
);

test(
  "ABT-03 statistic values",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.page.waitForFunction(
      () =>
        /Composers/.test(document.querySelector("#info").textContent) &&
        !/\u2026/.test(document.querySelector("#info").textContent),
      null,
      { timeout: REAL ? 120000 : 30000 },
    );
    const got = Object.fromEntries(
      await t.page.$$eval("#info dt", (x) => x.map((e) => [e.textContent, e.nextElementSibling.textContent])),
    );
    for (const k of Object.keys(TD.STATS)) eq(got[k], TD.STATS[k], k);
  },
  R,
);

test(
  "ABT-03 ERR-08 statistics: placeholder while loading, dash when not available",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    const dd = (k) =>
      t.page.evaluate(
        (x) =>
          [...document.querySelectorAll("#info dt")].find((e) => e.textContent === x)?.nextElementSibling.textContent,
        k,
      );
    await t.page.waitForFunction(() => /Songs/.test(document.querySelector("#info").textContent));
    eq(await dd("Composers"), "\u2026", "loading");
    await t.page.waitForFunction(() =>
      [...document.querySelectorAll("#info dt")].some(
        (e) => e.textContent === "Songs" && e.nextElementSibling.textContent === "\u2013",
      ),
    );
    await t.page.waitForFunction(() =>
      [...document.querySelectorAll("#info dt")].some(
        (e) => e.textContent === "Composers" && /\d/.test(e.nextElementSibling.textContent),
      ),
    );
    ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup for a list that is not available");
  },
  {
    overrides: [
      { match: /bySection:Composer/, delay: 2000 },
      { match: /bySection:Song/, status: 500 },
    ],
  },
);

test(
  "ABT-04 statistics are loaded again after a source change",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.waitText("#infodlg", /Composers\s*[\d,]/);
    const n = t.reqs(/bySection:Artist/).length;
    await t.page.click("#infoclose");
    await t.page.click("#srcl .srow:nth-child(2) .sw");
    await t.waitMsg(/in favourites/);
    await t.page.click("#aboutb");
    await t.waitText("#infodlg", /Composers\s*[\d,]/);
    ok(t.reqs(/bySection:Artist/).length > n, "statistics requested again");
  },
  U,
);

test(
  "ABT-05 update check only on click, newer / same version / failure",
  async (t) => {
    const version = await t.page.evaluate(() => APP.version);
    const repo = await t.page.evaluate(() => RELEASES_LATEST);
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
    const newer =
      "v" +
      version
        .split(".")
        .map((x, i) => (i === 0 ? +x + 1 : 0))
        .join(".");
    const url = "https://example.com/releases/" + newer;
    t.gh.answer = { status: 200, body: { tag_name: newer, html_url: url } };
    t.gh.delay = 500;
    await t.page.click("#updb");
    ok(await t.page.$eval("#updb", (b) => b.disabled), "button disabled while checking");
    await t.waitText("#updmsg", "Update available: " + newer);
    ok(!(await t.page.$eval("#updb", (b) => b.disabled)), "enabled again");
    t.gh.delay = 0;
    eq(await t.page.$eval("#updmsg a", (a) => [a.href, a.target]), [url, "_blank"], "release link");
    eq(t.gh.urls, [repo], "one request to the latest release");
    t.gh.answer = { status: 200, body: { tag_name: "v" + version, html_url: url } };
    eq(await check(), "You have the latest version.", "same version");
    t.gh.answer = { status: 403, body: { message: "rate limit" } };
    eq(await check(), "Update check failed (HTTP 403).", "failed request");
  },
  R,
);

test(
  "ABT-06 update check without network or without a release",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click("#aboutb");
    await t.page.click("#updb");
    await t.waitText("#updmsg", /^Update check failed \(.+\)\.$/);
    t.gh.answer = { status: 200, body: {} };
    await t.page.click("#updb");
    await t.waitText("#updmsg", "Update check failed (no release).");
  },
  R,
);

// ---------- 4.15 Error handling (ERR) ----------
test("ERR-01 failed command: popup with request, status and answer", async (t) => {
  t.player.state.overrides.push({ match: /^\/Add/, status: 500, body: "Test failure" });
  const tile = "#grid .item:nth-child(2)";
  await t.page.hover(tile);
  await t.page.click(tile + " .play:not(.addq):not(.favc)");
  const p = await t.apiPopup("The player command did not succeed");
  ok(/^\/Add\?/.test(p.u), "request without host: " + p.u);
  ok(/^500/.test(p.s), "HTTP 500");
  eq(p.b, "Test failure", "answer");
});

test(
  "ERR-02 commands before connecting: toast, no request",
  async (t) => {
    await t.page.click("#sclose");
    await t.page.click("#pp");
    await t.waitToast("Connect first");
    await t.page.click("#qbtn");
    await t.page.click("#qsave");
    await t.waitToast("Connect first");
    eq(t.player.state.requests, [], "no request");
  },
  { ...R, connect: false },
);

test("ERR-03 player error answer: message of the player", async (t) => {
  t.player.state.overrides.push({ match: /recent=1/, body: "<e><message>Test player error</message></e>" });
  await t.chip("New");
  await t.waitMsg("Loading failed: Test player error");
  const p = await t.apiPopup("Loading the albums did not succeed");
  eq(p.b, "<e><message>Test player error</message></e>", "answer of the player");
  t.player.state.overrides.push({ match: /^\/Shuffle/, body: "<e><message>Test player error</message></e>" });
  await t.page.click("#qbtn");
  await t.page.click("#qshuf");
  const q = await t.apiPopup("The player command did not succeed");
  ok(/^\/Shuffle\?/.test(q.u), "request: " + q.u);
  ok(/^200/.test(q.s), "HTTP 200");
});

test(
  "ERR-05 every player request asks for English answers",
  async (t) => {
    await t.all();
    await openLibAlbum(t);
    const other = t.player.state.requests
      .map((r, i) => [r, t.player.state.langs[i]])
      .filter(([r, l]) => !/^\/(Artwork|images\/)/.test(r) && !/^en\b/i.test(l)); // images: no text
    eq(other, [], "requests without Accept-Language: en");
  },
  R,
);

test(
  "ERR-06 no genres: message, panel open",
  async (t) => {
    await t.connect(IP, false);
    await t.waitMsg("Could not open the music source: No genres found. Has the library finished indexing?");
    ok(await t.page.$eval("#side", (e) => e.classList.contains("open")), "panel open");
  },
  { connect: false, overrides: [{ match: /GG\/Genres$/, body: "<browse></browse>" }] },
);

// ---------- 4.16 Security & robustness (SEC) ----------
test(
  "SEC-01 image URLs only on the player or http(s), /Artwork with followRedirects",
  async (t) => {
    const r = await t.page.evaluate(() => [
      imgUrl("/Artwork?service=LocalMusic&album=A%20B&artist=C"),
      imgUrl("/images/LibraryIcon.png"),
      imgUrl("https://cdn.example.com/cover.jpg"),
      imgUrl("//evil.example.com/x.png"),
      imgUrl("javascript:alert(1)"),
      imgUrl("data:image/svg+xml,<svg/>"),
      imgUrl(""),
    ]);
    eq(
      r,
      [
        BASE + "/Artwork?service=LocalMusic&album=A%20B&artist=C&followRedirects=1",
        BASE + "/images/LibraryIcon.png",
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
    ok(src.startsWith(BASE + "/Artwork?") && src.endsWith("&followRedirects=1"), "grid cover from /Artwork: " + src);
  },
  R,
);

// Firefox upgrades <img src="http://…"> on a file:// page to https (mixed content); the player has no https,
// so covers set as plain http image URLs stay empty there.
test(
  "SEC-02 covers: grid, popup and now playing show the player's images as blob URLs",
  async (t) => {
    const loaded = (sel) =>
      t.page.waitForFunction((s) => {
        const i = document.querySelector(s);
        return i && i.complete && i.naturalWidth > 0 && /^blob:/.test(i.src);
      }, sel);
    await loaded("#grid .item .cov img");
    await loaded("#cov");
    await openAlbumBy(t, 'x.key.startsWith("LocalMusic")');
    await loaded("#dimg");
    ok(t.reqs(/^\/Artwork\?.*followRedirects=1/).length > 0, "covers come from /Artwork with followRedirects=1");
  },
  { ...R, needs: ["library"] },
);

test(
  "SEC-02 FUL-01 the now playing cover is loaded once for footer and full-screen view",
  async (t) => {
    await t.page.waitForFunction(() =>
      ["#cov", "#fimg"].every((s) => /^blob:/.test(document.querySelector(s).getAttribute("src") || "")),
    );
    await t.settle(500);
    const img = t.st("image").replace(/^\/Artwork\?/, "");
    eq(
      t.player.state.requests.filter(
        (r) => r.startsWith("/Artwork?") && decodeURIComponent(r).includes(decodeURIComponent(img)),
      ).length,
      1,
      "one /Artwork request for the now playing cover",
    );
  },
  { ...R, needs: ["library"] },
);

test(
  "SEC-03 ERR-08 broken covers: grid image removed, footer cover hidden",
  async (t) => {
    await t.page.waitForFunction(() => document.querySelector("#cov").hidden);
    await t.page.waitForFunction(() => !document.querySelector("#grid .item:not(:first-child) .cov img"));
    eq((await t.tiles()).length, TD.FAV.length, "tiles stay");
    ok(!(await t.page.$eval("#apidlg", (e) => e.open)), "no error popup");
  },
  { overrides: [{ match: /^\/Artwork/, status: 404, type: "text/plain" }] },
);

test(
  "SEC-04 blocked storage: the app works",
  async (t) => {
    await t.page.click("#gear");
    await t.page.click('#themes [data-theme="dark"]');
    await t.page.click("#qsw");
    eq(await t.page.getAttribute("html", "data-theme"), "dark", "design applied");
    eq(t.errors, [], "no JavaScript errors");
  },
  { ...R, blockStorage: true },
);

test(
  "SEC-05 values of older versions are removed on start",
  async (t) => {
    const keys = await t.page.evaluate(() => Object.keys(localStorage));
    eq(
      keys.filter((k) => /^(fav|src|genres):|^plchips$/.test(k)),
      [],
      "fav:, src:, genres:, plchips removed",
    );
    ok(keys.includes("ip") && keys.includes("keep"), "other values kept");
  },
  { ...R, connect: false, storage: { ip: IP, keep: "1", "fav:x": "1", "src:y": "1", "genres:z": "1", plchips: "0" } },
);

// ---------- 4.17 Layout & accessibility (LAY) ----------
// Contrast of a text element against the background behind it (semi-transparent layers composited).
const contrastOf = (page, sel) =>
  page.$eval(sel, (el) => {
    const rgba = (c) => {
      const v = (c.match(/[\d.]+/g) || []).map(Number);
      return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
    };
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c.a > 0) layers.push(c);
    }
    let bg = { r: 255, g: 255, b: 255 };
    for (const c of layers.reverse())
      bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) };
    const lum = (c) =>
      [c.r, c.g, c.b]
        .map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [a, b] = [lum(rgba(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
  });

// LAY-01: titles, grey text on the page and in the queue panel, text on the accent (selected chip)
const LAY_TEXTS = ["#nt1", "#qlist li b", "#qlist li .qt span", "#qcount", "#msg", "#az [aria-pressed=true]"];

test(
  "LAY-01 popup, queue and footer: readable titles, no horizontal scrolling",
  async (t) => {
    await t.all();
    for (const theme of ["light", "dark"]) {
      await t.page.click("#gear");
      await t.page.click(`#themes [data-theme="${theme}"]`);
      await t.page.keyboard.press("Escape");
      if (!(await t.page.isVisible("#qside"))) await t.openQueue();
      await t.settle(300);
      for (const sel of LAY_TEXTS) {
        const c = await contrastOf(t.page, sel);
        ok(c >= 4.5, `${theme}: ${sel} contrast ${c}`);
      }
      ok(
        await t.page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth),
        theme + ": no horizontal scrolling with the queue pinned",
      );
      await openLibAlbum(t);
      for (const sel of ["#dt", "#tracks li.tr .tt"]) {
        const c = await contrastOf(t.page, sel);
        ok(c >= 4.5, `${theme}: ${sel} contrast ${c}`);
      }
      // the hover of the first track keeps a gap to the close button
      const rect = (sel) => t.page.$eval(sel, (e) => e.getBoundingClientRect().toJSON());
      const gap = (await rect("#tracks li")).top - (await rect("#close")).bottom;
      ok(gap >= 8, `${theme}: gap of ${Math.round(gap)} px between the close button and the first track`);
      await t.page.click("#close");
    }
  },
  R,
);

test(
  "LAY-02 every control has a name and its state, chips reachable with Tab",
  async (t) => {
    await t.openQueue();
    const missing = await t.page.evaluate(() =>
      [...document.querySelectorAll("button, [role=button], [role=slider], [role=switch], input")]
        .filter((e) => e.getClientRects().length && !e.hidden)
        .filter(
          (e) => !(e.getAttribute("aria-label") || e.textContent.trim() || e.title || (e.labels && e.labels.length)),
        )
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    eq(missing, [], "controls without a name");
    ok(
      await t.page.evaluate(
        () =>
          [...document.querySelectorAll("#az button")].every((b) => b.hasAttribute("aria-pressed")) &&
          [...document.querySelectorAll("#side .sw")].every((b) => b.hasAttribute("aria-checked")) &&
          ["#gear", "#fbtn", "#qbtn"].every((s) => document.querySelector(s).hasAttribute("aria-expanded")),
      ),
      "state attributes",
    );
    await t.page.focus("#az button");
    // Safari moves to buttons only with Option-Tab (its default setting "Press Tab to highlight each item" is off)
    await t.page.keyboard.press(t.key === "safari" ? "Alt+Tab" : "Tab");
    eq(
      await t.page.evaluate(() => document.activeElement === document.querySelectorAll("#az button")[1]),
      true,
      "Tab moves to the next chip",
    );
  },
  R,
);

test(
  "LAY-03 favicon embedded as SVG, follows light and dark mode",
  async (t) => {
    const r = await t.page.evaluate(async () => {
      const href = document.querySelector('link[rel="icon"]')?.getAttribute("href") || "";
      const svg = new DOMParser().parseFromString(
        decodeURIComponent(href.replace(/^data:image\/svg\+xml,/, "")),
        "image/svg+xml",
      );
      const loads = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(true);
        i.onerror = () => res(false);
        i.src = href;
      });
      return {
        data: href.startsWith("data:image/svg+xml,"),
        parsed: !svg.querySelector("parsererror") && !!svg.querySelector("mask circle, circle[mask]"),
        dark: /prefers-color-scheme:\s*dark/.test(svg.querySelector("style")?.textContent || ""),
        loads,
      };
    });
    eq(r, { data: true, parsed: true, dark: true, loads: true }, "favicon");
  },
  { ...R, connect: false },
);

test(
  "LAY-04 header: menu button, then the logo left of the title",
  async (t) => {
    const r = await t.page.evaluate(() => {
      const h = document.querySelector("header"),
        logo = h.querySelector("svg.logo");
      const box = (e) => e.getBoundingClientRect();
      return {
        menuFirst: h.firstElementChild.id === "gear",
        logo:
          !!logo &&
          logo.previousElementSibling.id === "gear" &&
          logo.nextElementSibling.id === "ttl" &&
          box(logo).width > 0,
        order:
          !!logo &&
          box(document.querySelector("#gear")).right <= box(logo).left &&
          box(logo).right <= box(document.querySelector("#ttl")).left,
      };
    });
    eq(r, { menuFirst: true, logo: true, order: true }, "header");
  },
  { ...R, connect: false },
);

// ---------- 4.18 Regression & session (REG) ----------
test(
  "REG-01 connect: no playback command on page load (regression)",
  async (t) => {
    await t.settle(1200);
    eq(t.cmds(/^\/(Add|Play|Load)(\?|$)/), [], "playback commands after load");
  },
  R,
);

test(
  "REG-02 connect: only the requests the first view needs (no genre crawl, stats, versions, one-off status)",
  async (t) => {
    await t.settle(1200);
    eq(t.reqs(/[?&]genre=/).length, 0, "no genre crawl");
    eq(t.reqs(/^\/(GitVersion|Version)$/), [], "no version requests");
    eq(t.reqs(/bySection:(Album|Artist|Song|Composer)/), [], "no statistics requests");
    eq(t.reqs(/^\/Status$|^\/Volume$/), [], "no one-off /Status or /Volume");
    ok(t.reqs(/^\/Status\?timeout=100/).length > 0, "status long polling runs");
    ok(t.reqs(/^\/Settings$/).length > 0, "settings (room name)");
  },
  R,
);

test(
  "REG-03 no JavaScript errors in a full session",
  async (t) => {
    for (const c of ["All", "New", "CD", TD.GEN[0]]) {
      await t.chip(c);
      await t.settle(500);
    }
    eq(t.errors, [], "page errors");
  },
  R,
);

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
  await t.all();
  for (const theme of ["light", "dark"]) {
    // album wall in every cover size
    for (const size of ["s", "m", "l"]) {
      await setting(`#themes [data-theme="${theme}"]`, `#sizes [data-size="${size}"]`);
      await t.settle(300); // covers
      await shot(`${theme}-1-albums-${size}`);
    }
    await setting('#sizes [data-size="m"]');
    await openLibAlbum(t);
    await t.settle(500);
    await shot(`${theme}-2-album-popup`);
    await t.page.click("#close");
    await t.openQueue();
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
if (SHOTS) test("ENV views: screenshots of the main views", views, R);

// ---------- real player: save and restore its state (write tests) ----------
// Like the Bruno folder "2 Write": the queue is saved as a playlist before the write tests and loaded
// again after each of them; playback position, pause state, shuffle, repeat and volume are set back.
// name: the playlist that keeps the queue. An input (e.g. HDMI) cannot be restored: the queue is restored paused.
async function saveState(get, name) {
  const s = stOf(await get("/Status"));
  const state = {
    name,
    volume: s("volume"),
    repeat: s("repeat"),
    shuffle: s("shuffle"),
    song: s("song"),
    secs: s("secs"),
    playing: s("state") === "play" && TD.SVC.includes(s("service")),
  };
  const q = (await get("/Playlist?start=0&end=0")) || "";
  state.queue = +((q.match(/<playlist [^>]*length="(\d+)"/) || [])[1] || 0);
  if (state.queue && !/<entries>[1-9]/.test((await get("/Save?name=" + name)) || ""))
    throw new Error("could not save the queue of the player");
  return state;
}
// Sets up what the write tests need (opts.needs) when the player lacks it: no library title playing or
// paused, or fewer than 3 tracks in the queue -> plays the first album with 3 or more tracks.
// Returns true when it changed the queue.
async function prepare(get) {
  if (TD.NOW_LIB && TD.QUEUE.length >= 3) return false;
  const album = TD.ALL.find((a) => +a.tracks >= 3 && a.playURL);
  if (!album) return false;
  console.log(`Preparing the player: playing "${album.text}" (no library title playing or fewer than 3 tracks queued)`);
  await get("/Clear");
  await get(album.playURL);
  await sleep(2000);
  return true;
}
async function restoreState(get, s) {
  await get("/Clear");
  if (s.queue) {
    await get("/Load?service=BluOS&name=" + s.name);
    await sleep(1500);
  }
  if (stOf(await get("/Status"))("shuffle") !== s.shuffle) await get("/Shuffle?state=" + (s.shuffle === "1" ? 1 : 0));
  if (s.repeat) await get("/Repeat?state=" + s.repeat);
  if (s.queue && s.song !== "") {
    await get(`/Play?seek=${Math.floor(+s.secs || 0)}&id=${s.song}`);
    if (!s.playing) {
      await sleep(500);
      await get("/Pause");
    }
  }
  if (s.volume && s.volume !== "-1") await get("/Volume?level=" + s.volume);
}

// ---------- runner ----------
// opts.needs on the real player: a test is skipped when the player lacks it (with --write prepare() sets it up)
const NEEDS = {
  usb: { ok: () => !!TD.USB, why: "the player has no USB drive" },
  library: { ok: () => TD.NOW_LIB, why: "no library title playing or paused" },
  queue: { ok: () => TD.QUEUE.length >= 3, why: "fewer than 3 tracks in the queue" },
  playlist: { ok: () => TD.PL.length > 0, why: "no BluOS playlist" },
};
async function runIn(key, list, real) {
  const { label } = BROWSERS[key];
  console.log(`\n${label} · ${VP_ARG}` + (JOBS > 1 ? ` · ${JOBS} tests at a time` : ""));
  let browser;
  try {
    browser = await BROWSERS[key].launch();
  } catch (e) {
    console.log(`  ✗ could not start ${label}: ${e.message.split("\n")[0]}`);
    return { label, pass: 0, fail: 1 };
  }
  let pass = 0,
    fail = 0,
    skip = 0;
  const runTest = async (tc) => {
    const missing = REAL && (tc.opts.needs || []).map((n) => NEEDS[n]).find((n) => !n.ok());
    if (missing) {
      skip++;
      console.log(`  - ${tc.name} (skipped: ${missing.why})`);
      return;
    }
    const t0 = Date.now();
    let t;
    try {
      if (real && tc.opts.before) await tc.opts.before(real.get);
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
      if (real && tc.opts.real === "write") {
        if (tc.opts.cleanup) await tc.opts.cleanup(real.get);
        await restoreState(real.get, real.saved);
      }
    }
  };
  const queue = [...list];
  const worker = async () => {
    while (queue.length) await runTest(queue.shift());
  };
  await Promise.all(Array.from({ length: JOBS }, worker));
  await browser.close();
  return { label, pass, fail, skip };
}

// The local core tests: tests whose name starts with a case the test plan marks "local". Exits when the plan
// breaks a limit, or when a test or a local mark has no counterpart.
function localTests() {
  const rows = fs.readFileSync(PLAN, "utf8").matchAll(/^\| ([A-Z]{3}-\d+) \|.*\| (local|yes|–) \|\r?$/gm);
  const marks = new Map([...rows].map((m) => [m[1], m[2]]));
  const first = (x) => x.name.split(" ")[0];
  const cases = tests.filter((x) => /^[A-Z]{3}-\d+$/.test(first(x))); // not the screenshots of --shots
  const local = cases.filter((x) => marks.get(first(x)) === "local");
  const core = [...marks.values()].filter((v) => v !== "–").length;
  const problems = [];
  if (core > CORE_MAX) problems.push(`${core} core cases, at most ${CORE_MAX}`);
  if (local.length > LOCAL_MAX) problems.push(`${local.length} local tests, at most ${LOCAL_MAX}`);
  for (const x of cases) if (!marks.has(first(x))) problems.push(`no Core mark for ${first(x)}`);
  for (const [id, v] of marks)
    if (v === "local" && !local.some((x) => first(x) === id)) problems.push(`no test starts with ${id}, marked local`);
  if (problems.length) {
    console.error("Test plan (column Core): " + problems.join("; "));
    process.exit(2);
  }
  return new Set(local);
}

// --list: names of the tests, whether they run against the real player and whether they are local core tests
if (process.argv.includes("--list")) {
  const local = localTests();
  for (const x of tests)
    console.log(`${(x.opts.real || "mock").padEnd(5)}  ${(local.has(x) ? "local" : "").padEnd(5)}  ${x.name}`);
  process.exit(0);
}

(async () => {
  // Without --all, --only and --player: the local core tests (and the screenshots of --shots)
  const local = ALL || ONLY || REAL ? null : localTests();
  if (local) console.log(`${local.size} local core tests of ${tests.length} tests (all: --all)`);
  const src = REAL ? createRecorder(BASE) : createPlayer();
  if (REAL) {
    console.log(`Real player ${IP}: ${WRITE ? "read and write tests" : "read-only tests"}; reading the test data …`);
    if (!(await src.get("/Status"))) {
      console.error(
        `The player ${IP} does not answer (network, IP address, Local Network permission of the terminal?)`,
      );
      process.exit(2);
    }
  }
  const list = tests.filter(
    (x) =>
      (!local || local.has(x) || x.name.startsWith("ENV ")) &&
      (!ONLY || x.name.includes(ONLY)) &&
      (!REAL || x.opts.real === "read" || (WRITE && x.opts.real === "write")),
  );
  if (REAL)
    console.log(
      `${list.length} of ${tests.filter((x) => !ONLY || x.name.includes(ONLY)).length} tests apply to the real player`,
    );
  TD = await buildTD(src.get);
  // --write: the player's state is saved (restored at the end), prepare() sets up what the tests need; the state
  // the tests start from is restored after every write test. The test data are read again: the saved
  // playlists are then part of them (chips, statistics).
  let real = null;
  if (WRITE && list.some((x) => x.opts.real === "write")) {
    const orig = await saveState(src.get, SAVE_NAME);
    const saved = (await prepare(src.get)) ? await saveState(src.get, WORK_NAME) : orig;
    real = { get: src.get, orig, saved };
    TD = await buildTD(src.get);
  }
  const results = [],
    began = Date.now();
  try {
    for (const key of PICK) results.push(await runIn(key, list, real));
  } finally {
    if (real && real.saved !== real.orig) {
      await restoreState(src.get, real.orig);
      if (real.saved.queue) await src.get("/Delete?service=BluOS&name=" + WORK_NAME);
    }
    if (real && real.orig.queue) await src.get("/Delete?service=BluOS&name=" + SAVE_NAME);
  }
  console.log("");
  for (const r of results)
    console.log(`${r.label} · ${VP_ARG}: ${r.pass} passed, ${r.fail} failed` + (r.skip ? `, ${r.skip} skipped` : ""));
  const took = Math.round((Date.now() - began) / 1000);
  console.log(`Run time: ${Math.floor(took / 60)}:${String(took % 60).padStart(2, "0")} min`);
  process.exit(results.some((r) => r.fail) ? 1 : 0);
})();
