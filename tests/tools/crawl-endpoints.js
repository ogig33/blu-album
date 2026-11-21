// Finds player endpoints that docs/bluos-api.md does not describe yet.
// Walks the answers of the player, starting at a few screens, and collects every URL they name
// (attributes such as URI, actionURL, url, image, browse keys, nested url= parameters, redirects).
// Read-only: it only requests endpoints of the READ_ONLY list; every other URL (play, add, delete,
// settings, web pages, other hosts) is only recorded, never requested. At the end it compares
// the findings with docs/bluos-api.md: undocumented endpoints, undocumented parameters of documented
// endpoints, and element / attribute names that appear nowhere in the document.
// Usage: node tests/tools/crawl-endpoints.js <player IP> [--max 1500] [--per 5] [--delay 50]
//   --max   at most this many requests
//   --per   at most this many requests per endpoint variant (path + parameter names + kind of key)
//   --delay pause between two requests in ms
// The full result goes to tests/api/fixtures/crawl-endpoints.json (git-ignored: personal data).
const fs = require("fs"),
  path = require("path");
const root = path.join(__dirname, "..", "..");
const DOC = path.join(root, "docs", "bluos-api.md");
const OUT = path.join(root, "tests", "api", "fixtures", "crawl-endpoints.json");
// A name from a player answer as a literal part of a regular expression
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const args = process.argv.slice(2);
const host = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const MAX = opt("max", 1500),
  PER = opt("per", 5),
  DELAY = opt("delay", 50);
if (!host) {
  console.log("Usage: node tests/tools/crawl-endpoints.js <player IP> [--max 1500] [--per 5] [--delay 50]");
  process.exit(1);
}
const BASE = `http://${host}:11000`;

// Endpoints that only read (checked in docs/bluos-api.md). Nothing else is ever requested.
// Left out on purpose although documented: /error (clears the message), /Name and /Volume (change
// with parameters), /ui/prf (runs a request), /ui/action, /ui/clearUsageHistory, /ui/resolveSoviURL,
// /Info (asks last.fm), /Artwork (images).
const READ_ONLY = new Set(
  `/Status /SyncStatus /Browse /RadioBrowse /Playlist /Playlists /Presets
   /Settings /Services /Alarms /audioPreset /Version /GitVersion /AddToPlaylistOptions /Songs
   /library/v1/Albums /library/v1/Artists /library/v1/Composers /library/v1/Folders
   /library/v1/Genres /library/v1/Playlists /library/v1/Search /library/v1/Songs
   /ui/browseContext /ui/browseGenres /ui/browseGrouped /ui/browseMenuGroup /ui/BrowseObjects
   /ui/Configuration /ui/ContextMenu /ui/Favourites /ui/Home /ui/myPlaylistsRow /ui/News
   /ui/nowPlayingCM /ui/presets /ui/Queue /ui/queueItemCM /ui/RecentlyPlayed /ui/Search /ui/Sources`.split(/\s+/),
);
// Parameters that change something or hold a request open: such URLs are not requested.
const DENY_PARAMS = new Set(["value", "level", "delete", "remove", "timeout", "etag", "action"]);
// Parameters whose kind of value makes a new variant (e.g. another menu); others are ignored.
const VARIANT_PARAMS = new Set(["key", "url", "uri", "service", "type", "id"]);
// Attributes that hold a /Browse key instead of a URL
const KEY_ATTRS = new Set(["browseKey", "contextMenuKey", "parentKey", "nextKey"]);
const AUDIO = /\.(flac|mp3|m4a|aac|wav|aiff?|ogg|opus|wma|alac|dsf|dff|mqa|cue|m3u8?|pls)$/i;
// Start points: the screens of the BluOS Controller and the top-level lists
const SEEDS = `/ui/Home /ui/Sources /ui/Configuration /ui/Queue /ui/presets /ui/Search /ui/RecentlyPlayed
  /ui/News /Browse /RadioBrowse /Settings?expand=1 /Services /Status /SyncStatus /Playlists /Presets
  /Alarms /audioPreset`.split(/\s+/);

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, "&");

// URL text -> {local, port, path, params, url} or null; local = same player
function parse(raw) {
  let u;
  try {
    u = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const local = u.hostname === host;
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  return { local, port, path: u.pathname, params: [...u.searchParams], url: u.href };
}

// "port path" -> {port, path, params: Map(name -> {value, url, from}), seen, fetched, from: Set, examples: Set}
const endpoints = new Map();
const fields = new Map(); // element / attribute name -> Set of endpoints
const external = new Map(); // host -> count
const deepLinks = new Set(); // navigation targets of the BluOS Controller
const variants = new Map(); // variant -> requests
const queue = [],
  queued = new Set();
let requests = 0,
  errors = 0;

function variantOf(p) {
  const kinds = p.params
    .map(([n, v]) => {
      if (!VARIANT_PARAMS.has(n.toLowerCase())) return n;
      const k = v.split("?")[0].replace(/\d+/g, "#").slice(0, 60);
      return `${n}=${k}`;
    })
    .sort();
  return `${p.port} ${p.path}?${kinds.join("&")}`;
}

function record(raw, from) {
  if (!raw || raw.length > 2000) return;
  const p = parse(raw);
  if (!p) return;
  if (!p.local) {
    let h;
    try {
      h = new URL(raw).host;
    } catch {
      return;
    }
    external.set(h, (external.get(h) || 0) + 1);
    return;
  }
  // Paths of music files on the player (file=, fn=, value=…), not endpoints
  if (/^\/(var|tmp|mnt|media|usr)\//.test(p.path) || AUDIO.test(p.path)) return;
  const id = `${p.port} ${p.path}`;
  let e = endpoints.get(id);
  if (!e) {
    e = { port: p.port, path: p.path, params: new Map(), seen: 0, fetched: 0, from: new Set(), examples: new Set() };
    endpoints.set(id, e);
  }
  e.seen++;
  e.from.add(from);
  if (e.examples.size < 5) e.examples.add(p.url.replace(`http://${host}`, "").replace(/^:11000/, ""));
  for (const [n, v] of p.params) {
    if (!e.params.has(n)) e.params.set(n, { value: v.slice(0, 120), url: p.url.replace(BASE, ""), from });
    // A parameter that holds a URL of the player (e.g. url= of /ui/browseGrouped); searchParams
    // already decoded it once, a second decode would split URLs nested one level deeper.
    // /redirectToCp?href=… leads to the web interface on port 80.
    const web = p.path === "/redirectToCp" && n === "href";
    if (/^\/[A-Za-z]/.test(v)) record(web ? `http://${host}${v}` : v, `${from} (${n}=)`);
  }
  if (p.port !== "11000" || !READ_ONLY.has(p.path)) return;
  if (p.params.some(([n]) => DENY_PARAMS.has(n.toLowerCase()))) return;
  const key = p.url;
  if (queued.has(key)) return;
  const v = variantOf(p);
  if ((variants.get(v) || 0) >= PER) return;
  variants.set(v, (variants.get(v) || 0) + 1);
  queued.add(key);
  queue.push(key);
}

function scan(body, from) {
  for (const tag of body.matchAll(/<([A-Za-z][\w:.-]*)([^>]*)>/g)) {
    addField(tag[1], from);
    // Navigation inside the BluOS Controller (type="deep-link"), not a player endpoint
    const deep = /\stype="deep-link"/.test(tag[2]);
    for (const m of tag[2].matchAll(/\s([A-Za-z][\w:.-]*)="([^"]*)"/g)) {
      addField(m[1], from);
      const name = m[1],
        val = decode(m[2]);
      if (KEY_ATTRS.has(name)) record(`/Browse?key=${encodeURIComponent(val)}`, `${from} @${name}`);
      else if (deep && name === "URI" && /^\/[A-Za-z]/.test(val)) {
        deepLinks.add(val.split("?")[0].replace(/\/[^/]*\d[^/]*$/, "/…"));
        // A player URL inside the deep link, e.g. /reorder-presets?url=/Presets/edit?prid=7
        for (const [n, v] of new URL(val, BASE).searchParams)
          if (/^\/[A-Za-z]/.test(v)) record(v, `${from} @URI deep-link (${n}=)`);
      } else if (/^(\/[A-Za-z]|https?:\/\/)/.test(val)) record(val, `${from} @${name}`);
    }
  }
  // URLs as element text, e.g. <nextlink>
  const TEXT_URL = /<([\w:.-]+)[^>]*>\s*((?:\/[A-Za-z]|https?:\/\/)[^<\s]*)\s*</g;
  for (const m of body.matchAll(TEXT_URL)) record(decode(m[2]), `${from} <${m[1]}>`);
}
function addField(name, from) {
  if (!fields.has(name)) fields.set(name, new Set());
  fields.get(name).add(from);
}

async function crawl() {
  for (const s of SEEDS) record(s, "seed");
  while (queue.length && requests < MAX) {
    const url = queue.shift();
    const p = parse(url);
    const label = p.path;
    requests++;
    let res, body;
    try {
      res = await fetch(url, {
        headers: { "Accept-Language": "en" },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      body = await res.text();
    } catch (e) {
      errors++;
      console.log(`  ! ${url.replace(BASE, "")}: ${e.message}`);
      continue;
    }
    endpoints.get(`11000 ${p.path}`).fetched++;
    if (res.status >= 300 && res.status < 400) record(res.headers.get("location"), `${label} (redirect)`);
    else if (res.status !== 200) {
      errors++;
      console.log(`  ! ${url.replace(BASE, "")}: HTTP ${res.status}`);
    }
    if (/^\s*<error/.test(body)) console.log(`  ! ${url.replace(BASE, "")}: ${body.trim().slice(0, 120)}`);
    scan(body, label);
    if (requests % 100 === 0) console.log(`  ${requests} requests, ${queue.length} queued, ${endpoints.size} paths`);
    if (DELAY) await new Promise((r) => setTimeout(r, DELAY));
  }
}

// docs/bluos-api.md: documented endpoints with the text of their section (### heading), or of
// their category (## heading) for endpoints only listed in its overview table (e.g. /Albums)
function readDoc() {
  const text = fs.readFileSync(DOC, "utf8");
  const docs = new Map();
  for (const cat of text.split(/^## /m).slice(1)) {
    for (const m of cat.matchAll(/^\| `[A-Z, ]+ (\/[^`?\s]+)`/gm)) docs.set(m[1], cat);
    for (const part of cat.split(/^### /m).slice(1)) {
      const m = part.match(/^`[A-Z, ]+ (\/[^`?\s]+)`/);
      if (m) docs.set(m[1], part);
    }
  }
  return { text, docs };
}

function report() {
  const { text, docs } = readDoc();
  const list = [...endpoints.values()].sort((a, b) => a.path.localeCompare(b.path));
  const fmt = (e) =>
    `  ${e.port === "11000" ? "" : `:${e.port} `}${e.path}` +
    `  (seen ${e.seen}×${e.fetched ? `, read ${e.fetched}×` : ""})\n` +
    `      params: ${[...e.params.keys()].join(", ") || "–"}\n` +
    `      from:   ${[...e.from].slice(0, 4).join("; ")}\n` +
    `      e.g.    ${[...e.examples][0]}`;

  const fresh = list.filter((e) => !docs.has(e.path) && !/\.(png|jpe?g|gif|svg|ico|css|js)$/i.test(e.path));
  const images = list.filter((e) => !docs.has(e.path) && /\.(png|jpe?g|gif|svg|ico|css|js)$/i.test(e.path));
  console.log(`\n== Endpoints not in docs/bluos-api.md (${fresh.length})`);
  for (const e of fresh) console.log(fmt(e));
  console.log(`\n== Static files (images, scripts; ${images.length}) – not listed`);

  console.log("\n== Parameters not mentioned in the section of a documented endpoint");
  for (const e of list.filter((x) => docs.has(x.path))) {
    const sec = docs.get(e.path);
    const named = (n) => new RegExp(`(^|[^\\w])${reEsc(n)}=`).test(sec) || sec.includes(`\`${n}\``);
    const missing = [...e.params.keys()].filter((n) => !named(n));
    for (const n of missing) {
      const x = e.params.get(n);
      console.log(`  ${e.path}  ${n}=${x.value}\n      from: ${x.from}\n      e.g.  ${x.url.slice(0, 200)}`);
    }
  }

  // XML declaration and schema attributes say nothing about the API
  const boilerplate = (n) => /^(xml|xmlns|xsi)\b|^(standalone|encoding)$/.test(n);
  const inDoc = (n) => new RegExp(`\\b${reEsc(n)}\\b`).test(text);
  const unknown = [...fields].filter(([n]) => !boilerplate(n) && !inDoc(n));
  console.log(`\n== Element / attribute names that appear nowhere in docs/bluos-api.md (${unknown.length})`);
  for (const [n, from] of unknown.sort()) console.log(`  ${n}  (${[...from].slice(0, 3).join(", ")})`);

  console.log("\n== Deep links: navigation inside the BluOS Controller, not player endpoints");
  console.log(`  ${[...deepLinks].sort().join("  ") || "–"}`);

  console.log("\n== Other hosts named in the answers (not requested)");
  for (const [h, n] of [...external].sort((a, b) => b[1] - a[1])) console.log(`  ${h}  (${n}×)`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        host,
        date: new Date().toISOString(),
        requests,
        endpoints: list.map((e) => ({
          ...e,
          documented: docs.has(e.path),
          params: Object.fromEntries(e.params),
          from: [...e.from],
          examples: [...e.examples],
        })),
        unknownFields: Object.fromEntries(unknown.map(([n, f]) => [n, [...f]])),
        deepLinks: [...deepLinks].sort(),
        external: Object.fromEntries(external),
      },
      null,
      2,
    ),
  );
  const left = queue.length ? `, ${queue.length} left in the queue – raise --max` : "";
  console.log(`\n${requests} requests (${errors} failed)${left}`);
  console.log(`Full result: ${path.relative(root, OUT)}`);
}

crawl().then(report);
