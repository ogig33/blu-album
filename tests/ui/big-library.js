// Generated music library for the mock player (performance tests, perf.js): any number of albums with titles, album
// artists, track artists, years, genres, quality and favourites, made from a seed (the same library on every run).
// createLibrary(n) answers the requests of the app for the library (service LocalMusic) in the formats of the real
// player (fixtures 04, 06, 07, 11, 12, 13, 18); browse() and library() return null for every other request, which the
// mock answers from its fixtures (album tracks, context menus, queue, status ...).
// The A-Z sections follow the distribution of the recorded library (fixture 06); like the real player, a /Browse
// section answers all its albums at once (All: 1 request per section, private/docs/blu-album-api-usage.md).
const LIB = "LocalMusic";

// Deterministic random numbers (mulberry32)
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Like the app's formEnc(): form encoding as the player writes it into keys and URLs
const fe = (v) =>
  encodeURIComponent(v)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
// Like the player's search (and the app's atWordStart()): the term at the start of a word
const atWordStart = (text, term) => {
  const t = fold(text),
    q = fold(term);
  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1)) if (!i || !/[\p{L}\p{N}]/u.test(t[i - 1])) return true;
  return false;
};

// Albums per A-Z section of the recorded library (fixture 06), scaled to the album count
const SECTION_WEIGHTS = {
  "#": 40,
  A: 143,
  B: 130,
  C: 126,
  D: 82,
  E: 63,
  F: 59,
  G: 57,
  H: 64,
  I: 56,
  J: 22,
  K: 24,
  L: 100,
  M: 108,
  N: 42,
  O: 48,
  P: 81,
  Q: 5,
  R: 62,
  S: 180,
  T: 329,
  U: 27,
  V: 34,
  W: 53,
  X: 2,
  Y: 12,
  Z: 7,
};
const SECTIONS = Object.keys(SECTION_WEIGHTS);

function createLibrary(n, { seed = 1, genres = [] } = {}) {
  const r = rng(seed);
  const pick = (l) => l[Math.floor(r() * l.length)];
  // Words from syllables; some with accents (fold() and localeCompare() see them like real names)
  const SYL =
    "ka lo mi ra ne to sa vi da re lu mo an el or in ber ta ri go ste mar hel zu qui wen yo xa ju fe pa co di";
  const syl = SYL.split(" ");
  const word = (first) => {
    const w = (first || "") + Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(syl)).join(""),
      x = r();
    const acc = x < 0.05 ? w.replace("o", "ö") : x < 0.1 ? w.replace("e", "é") : w;
    return acc[0].toUpperCase() + acc.slice(1);
  };
  const vocab = Array.from({ length: 800 }, () => word());
  const words = (k) => Array.from({ length: k }, () => pick(vocab)).join(" ");
  // About 5 albums per artist; "Various" for compilations (their tracks carry other artists)
  const artists = [
    ...new Set(Array.from({ length: Math.max(10, Math.round(n / 5)) }, () => words(1 + Math.floor(r() * 2)))),
  ];
  // Genres: those of the recorded library, the first ones larger (like a real library)
  const gw = genres.map((g, i) => [g, 1 / (i + 1)]);
  const gsum = gw.reduce((s, x) => s + x[1], 0);
  const genre = () => {
    let x = r() * gsum;
    for (const [g, w] of gw) if ((x -= w) <= 0) return g;
    return gw[0]?.[0] || "Rock";
  };
  const wsum = Object.values(SECTION_WEIGHTS).reduce((s, x) => s + x, 0);
  const albums = [],
    ids = new Set();
  for (const sec of SECTIONS) {
    const count = Math.round((n * SECTION_WEIGHTS[sec]) / wsum);
    for (let i = 0; i < count && albums.length < n; i++) {
      const various = r() < 0.05,
        a = various ? "Various" : pick(artists);
      const first = sec === "#" ? String(1 + Math.floor(r() * 99)) : word(sec.toLowerCase()).slice(0, 12);
      let t = [first, words(Math.floor(r() * 3))].join(" ").trim();
      while (ids.has(t + "\n" + a)) t += " II";
      ids.add(t + "\n" + a);
      const q = r();
      albums.push({
        t,
        a,
        ta: various ? [pick(artists), pick(artists), pick(artists)] : [a],
        y: r() < 0.03 ? "" : String(1950 + Math.floor(Math.pow(r(), 0.7) * 76)),
        g: genre(),
        q: q < 0.05 ? "hr" : q < 0.95 ? "cd" : "mp3",
        n: 6 + Math.floor(r() * 14),
        fav: r() < 0.02,
        sec,
      });
    }
  }
  while (albums.length < n) albums.push({ ...albums[albums.length % 7], t: "Extra " + albums.length, sec: "E" });
  const sort = (l) => l.sort((x, y) => x.t.localeCompare(y.t));
  // Order of adding (New): random
  const added = albums
    .map((a, i) => [r(), i])
    .sort((x, y) => x[0] - y[0])
    .map((x) => albums[x[1]]);
  const bySection = (l) => SECTIONS.map((s) => [s, sort(l.filter((a) => a.sec === s))]).filter((x) => x[1].length);

  // ---------- answers ----------
  const HEAD = `<?xml version="1.0" encoding="UTF-8"?>\n<browse serviceIcon="/images/LibraryIcon.png" serviceName="Library" searchKey="${LIB}:Search"`;
  const q = (a) => `album=${fe(a.t)}&amp;artist=${fe(a.a)}`;
  // An album of a /Browse list (fixture 07)
  const item = (a) => {
    const k = q(a),
      fav = a.fav ? "&amp;isFavourite=1" : "";
    return (
      `\n  <item browseKey="${LIB}:MG/LocalMusic-Album?${k}" contextMenuKey="${LIB}:CM/LocalMusic-Album?${k}${fav}" ` +
      `playURL="/Add?playnow=1&amp;service=${LIB}&amp;${k}" text="${esc(a.t)}" text2="${esc(a.a)}" tracks="${a.n}"` +
      `${a.fav ? ' isFavourite="true"' : ""} image="/Artwork?service=${LIB}&amp;${k}" type="album">\n    <contextMenu>` +
      (a.fav
        ? `\n      <item actionURL="/DeleteFavourite?${k}&amp;service=${LIB}" text="Remove favourite" type="favourite-delete"></item>`
        : `\n      <item actionURL="/AddFavourite?${k}&amp;service=${LIB}" text="Favourite" type="favourite-add"></item>`) +
      `\n      <item actionURL="/Add?${k}&amp;clear=0&amp;playnow=1&amp;service=${LIB}&amp;shuffle=0&amp;where=nextAlbum" text="Play now" type="add-now"></item>` +
      `\n      <item actionURL="/Add?${k}&amp;playnow=1&amp;service=${LIB}&amp;shuffle=1&amp;where=nextAlbum" text="Shuffle" type="add-shuffle"></item>` +
      `\n      <item actionURL="/Add?${k}&amp;playnow=-1&amp;service=${LIB}&amp;where=nextAlbum" text="Add next" type="addAll-next"></item>` +
      `\n      <item actionURL="/Add?${k}&amp;playnow=-1&amp;service=${LIB}&amp;where=last" text="Add last" type="addAll-last"></item>` +
      `\n    </contextMenu>\n  </item>`
    );
  };
  const albumList = (l) => `${HEAD} type="albums">${l.map(item).join("")}\n</browse>`;
  // A sectioned /library/v1/Albums list (fixture 13), with the year like section=all (API test E34)
  const sectioned = (l, attrs) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<albums ${attrs}section="all" service="${LIB}">\n\t<sections>` +
    bySection(l)
      .map(
        ([s, x]) =>
          `\n\t\t<section name="${esc(s)}">` +
          x
            .map(
              (a) =>
                `\n\t\t\t<album tracks="${a.n}"${a.y ? ` date="${a.y}"` : ""}${a.fav ? ' isFavourite="1"' : ""}>` +
                `\n\t\t\t\t<title>${esc(a.t)}</title>\n\t\t\t\t<art>${esc(a.a)}</art>\n\t\t\t</album>`,
            )
            .join("") +
          "\n\t\t</section>",
      )
      .join("") +
    "\n\t</sections>\n</albums>";
  // A plain /library/v1/Albums list (fixtures 11, 12)
  const plain = (l, attrs, next) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<albums ${attrs}service="${LIB}">` +
    l
      .map(
        (a) =>
          `\n\t<album${a.fav ? ' isFavourite="1"' : ""}>\n\t\t<alb>${esc(a.t)}</alb>\n\t\t<art>${esc(a.a)}</art>\n\t</album>`,
      )
      .join("") +
    (next ? `\n\t<nextlink>${esc(next)}</nextlink>` : "") +
    "\n</albums>";
  const memo = new Map();
  const once = (k, f) => (memo.has(k) ? memo.get(k) : memo.set(k, f()).get(k));
  // Parameters of the /library/v1 request inside a browse key (after "%3F")
  const inner = (key) => new URLSearchParams(key.includes("%3F") ? key.slice(key.indexOf("%3F") + 3) : "");

  // /Browse answers of the library (key, q: search term), null = not the library's
  const browse = (key, term) => {
    if (!key || !key.startsWith(LIB + ":")) return null;
    if (key === LIB + ":GG/Genres")
      return once(key, () => {
        const names = [...new Set(albums.map((a) => a.g))].sort((x, y) => x.localeCompare(y));
        return `${HEAD} type="genres">${names.map((g) => `\n  <item browseKey="${LIB}:MG/Genres?genre=${fe(g)}" text="${esc(g)}" type="genre"></item>`).join("")}\n</browse>`;
      });
    if (/^LocalMusic:bySection:Album\/%2Flibrary%2Fv1%2FAlbums%3Fservice=LocalMusic$/.test(key))
      return once(key, () => {
        const its = SECTIONS.map((s) => {
          const c = albums.filter((a) => a.sec === s).length;
          return `\n  <item browseKey="${LIB}:S:Album/%2Flibrary%2Fv1%2FAlbums%3Fservice=${LIB}&amp;limit=50&amp;section=${encodeURIComponent(s)}" text="${s}" text2="${c}" type="section"></item>`;
        });
        return `${HEAD} type="sections">${its.join("")}\n</browse>`;
      });
    if (/^LocalMusic:S:Album\//.test(key)) {
      const p = inner(key);
      return once(key, () => albumList(sort(albums.filter((a) => a.sec === p.get("section")))));
    }
    if (key === LIB + ":Search")
      return (
        `${HEAD} type="menu">` +
        ["Artist", "Album", "Song", "Composer"]
          .map(
            (k) =>
              `\n  <item browseKey="${LIB}:${k}/%2Flibrary%2Fv1%2F${k}s%3Fexpr=${fe(term || "")}&amp;service=${LIB}" text="${k}s" type="link"></item>`,
          )
          .join("") +
        "\n</browse>"
      );
    // The player's search: album title or track artist at the start of a word, not the album artist (API test E40)
    if (/^LocalMusic:Album\/%2Flibrary%2Fv1%2FAlbums%3Fexpr=/.test(key)) {
      const v = inner(key).get("expr") || "";
      return albumList(sort(albums.filter((a) => atWordStart(a.t, v) || a.ta.some((x) => atWordStart(x, v)))));
    }
    // Albums of an artist: as album artist or track artist
    if (/^LocalMusic:Album\/%2Flibrary%2Fv1%2FAlbums%3Fartist=/.test(key)) {
      const v = inner(key).get("artist") || "";
      return albumList(sort(albums.filter((a) => a.a === v || a.ta.includes(v))));
    }
    return null;
  };
  // /library/v1/Albums answers of the library (q: URLSearchParams), null = not the library's
  const library = (p) => {
    if (p.get("service") !== LIB) return null;
    if (p.get("recent") === "1") {
      const s = +p.get("start") || 0,
        max = Math.min(1000, albums.length);
      const next = s + 50 < max ? `/library/v1/Albums?count=50&recent=1&service=${LIB}&start=${s + 50}` : "";
      return plain(added.slice(s, Math.min(s + 50, max)), 'recent="1" ', next);
    }
    if (p.get("start")) return plain([], "");
    if (p.get("category") === "FAVOURITES")
      return once("fav", () => plain(sort(albums.filter((a) => a.fav)), 'category="FAVOURITES" '));
    if (p.get("section") !== "all") return null;
    if (p.get("length") === "1" && p.get("sort") === "decade")
      return once("dec", () => {
        const c = {};
        albums.forEach((a) => a.y && (c[a.y.slice(0, 3) + "0"] = (c[a.y.slice(0, 3) + "0"] || 0) + 1));
        const secs = Object.keys(c)
          .sort()
          .map((k) => `<section name="${k}" length="${c[k]}"></section>`);
        return `<albums length="1" section="all" sort="decade" service="${LIB}"><sections>${secs.join("")}</sections></albums>`;
      });
    // Like the real player: MQA lists nothing (BluOS bug, docs/bluos-api.md)
    if (p.get("quality"))
      return once("q" + p.get("quality"), () =>
        sectioned(
          albums.filter((a) => a.q === p.get("quality")),
          `quality="${p.get("quality")}" `,
        ),
      );
    if (p.get("genre"))
      return once("g" + p.get("genre"), () =>
        sectioned(
          albums.filter((a) => a.g === p.get("genre")),
          "",
        ),
      );
    return once("all", () => sectioned(albums, ""));
  };
  return { albums, vocab, browse, library };
}

module.exports = { createLibrary };
