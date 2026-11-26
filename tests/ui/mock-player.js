// Players for the UI tests.
// createPlayer(): mock BluOS player. Answers every request of the app from the fixtures recorded with the
// Bruno collection (fixtures/NN-*.xml) and records all requests and commands (play, add, favourites ...).
// createRecorder(): the real player (run.js --player). Passes every request of the app through to the
// player and records it the same way.
// Both offer get(path): the answer of the player as text (null when unsuccessful); run.js builds its
// test data with it, so the expected values come from the player the tests run against.
const fs = require("fs"),
  path = require("path");

const FIX = path.join(__dirname, "fixtures");
const fx = (n) =>
  fs.readFileSync(
    path.join(
      FIX,
      fs.readdirSync(FIX).find((f) => f.startsWith(n + "-")),
    ),
    "utf8",
  );
// A recorded context menu with the favourite state fav, whatever state the recording had
const favMenu = (xml, fav) =>
  fav
    ? xml
        .replace("/AddFavourite", "/DeleteFavourite")
        .replace("favourite-add", "favourite-delete")
        .replace('text="Favourite"', 'text="Remove favourite"')
    : xml
        .replace("/DeleteFavourite", "/AddFavourite")
        .replace("favourite-delete", "favourite-add")
        .replace('text="Remove favourite"', 'text="Favourite"');
// 1x1 PNG for all artwork requests, the source icons and the listening mode icons
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const LIB = "LocalMusic",
  USB = "1A2B_3C4D";
// Data the mock adds to the fixtures (exported, so the tests derive their expected values from it):
// genres of the USB drive, the A-Z sections the USB drive lists, the albums with a year on the USB drive
// (section "S", a decade the library fixture does not have), player software versions.
const USB_GENRES = ["Soundtrack"];
const USB_SECTIONS = ["A", "S"];
const USB_YEARS = [{ t: "Soundtrack Classics", a: "Various", y: "1964" }];
const VERSIONS = { bluos: "4.18.26", api: "v0.5.51" };
// Tracks on the second page of a BluOS playlist (the first page is fixture 28 with 10 tracks)
const PL_PAGE2 = 3;
const COMMANDS =
  /^\/(Add|Play|Pause|Skip|Back|Load|Save|Delete|AddFavourite|DeleteFavourite|Clear|Shuffle|Repeat|Move|Volume\?)/;

function createPlayer(opts = {}) {
  const state = {
    commands: [], // every command URL the app sent, in order
    requests: [], // every request path
    usb: opts.usb !== false, // USB drive connected
    queueEmpty: false,
    // Order of the recorded queue after /Move (ids of fixture 20 in their new order), null = as recorded
    queueOrder: null,
    deletedPlaylists: [], // names of the BluOS playlists the app deleted (left out of the playlists list)
    shuffle: false,
    repeat: "2",
    songArtists: {}, // title -> artist, overrides the artist of single songs (compilation test)
    // Multi-disc album: disc number per recorded track of the library album (e.g. [1, 1, 2, 2]), null = as
    // recorded. Like the real player (Bruno E32), /library/v1/Songs gets <discno>, /Browse keeps the order
    // without a disc marker, and the track number starts again at 1 on every disc (discRunOn: runs on).
    discs: null,
    discRunOn: false,
    playing: opts.playing !== false,
    // Playlist id (<pid> in /Status, id of /Playlist). Like the real player (Bruno 2 Write), it changes
    // when the queue changes: add, remove, shuffle, clear, load. Loading a broken playlist keeps it.
    pid: 485,
    // Listening mode (/audioPreset, fixture 27). null = player without listening modes (answers 404).
    // Like the real player (Bruno S44), a change of the mode raises <syncStat> in /Status.
    listeningMode: opts.listeningModes === false ? null : "MUSIC",
    syncStat: 533,
    // Library version: root id of every /library/v1 answer of the library (USB: the recorded 1). Like the real player
    // (Bruno M39–M41), every favourite added or removed raises it by 65536; a test sets it for a rescan.
    libId: 458791,
    // Values that replace (or add) tags of the recorded /Status, e.g. { quality: "hd", canSeek: "0" }
    statusPatch: { ...(opts.statusPatch || {}) },
    // Generated queue of this many songs instead of fixture 20 (paging with start / end like the player)
    queueSize: 0,
    // Overrides for single tests, checked in this order against the request path (raw and decoded):
    // { match: RegExp, status, body, type } answers instead of the mock, { edit: (xml) => xml } changes
    // the mock's answer, { delay: ms } answers later; times = how often it applies (default: always).
    overrides: [...(opts.overrides || [])],
    times: [], // time (ms) of every request, same order as requests
    langs: [], // Accept-Language of every request, same order as requests
  };
  if (opts.mock) opts.mock(state);
  // First override that matches the request (and has uses left); counts its use.
  const override = (pq) => {
    let dec = pq;
    try {
      dec = decodeURIComponent(pq);
    } catch {
      // keep the raw path
    }
    const o = state.overrides.find(
      (x) => (x.times === undefined || x.times > 0) && (x.match.test(pq) || x.match.test(dec)),
    );
    if (o && o.times !== undefined) o.times--;
    if (o) o.hits = (o.hits || 0) + 1;
    return o;
  };
  // Holds back the answer to the next matching request: asked() waits for the request, release() sends the answer
  // and waits until it is sent. For late answers without fixed delays.
  state.hold = (match, status) => {
    const held = {};
    const asked = new Promise((z) => (held.arrived = z));
    const sent = new Promise((z) => (held.sent = z));
    held.released = new Promise((z) => (held.release = z));
    state.overrides.push({ match, status, times: 1, held });
    const within = (promise, what) => {
      let timer;
      const late = new Promise((_, no) => (timer = setTimeout(() => no(new Error(`${what}: ${match}`)), 10000)));
      return Promise.race([promise, late]).finally(() => clearTimeout(timer));
    };
    return {
      asked: () => within(asked, "no request"),
      release: () => {
        held.release();
        return within(sent, "answer not sent");
      },
    };
  };
  const QUEUE_CHANGES = /^\/(Add|Delete\?id=|Shuffle|Clear|Move)/;
  const browse = (key, lang) => {
    if (!key) {
      let top = fx("01");
      if (!state.usb) top = top.replace(/\s*<item browseKey="1A2B_3C4D:"[^>]*><\/item>/, "");
      return top;
    }
    if (key === LIB + ":") return fx("02");
    if (key === USB + ":") return fx("03");
    if (/GG\/Genres$/.test(key))
      return key.startsWith(USB)
        ? '<browse type="genres">' +
            USB_GENRES.map(
              (g) =>
                `<item browseKey="${USB}:MG/Genres?genre=${encodeURIComponent(g)}" text="${g}" type="genre"></item>`,
            ).join("") +
            "</browse>"
        : fx("04");
    if (/MG\/Genres\?genre=/.test(key)) return fx("05");
    // Album sections (all albums, genre albums) and the stats lists. Like the real player, the USB drive
    // lists only the sections that contain albums (here: A and S).
    if (/bySection:Album/.test(key) && key.startsWith(USB)) return usbSections();
    if (/bySection:(Album|Artist|Song|Composer)/.test(key)) return fx("06");
    // Section "#" carries the recorded albums, all other sections are empty
    if (/:S:Album\//.test(key)) return /section=%23/.test(key) ? fx("07") : '<browse type="albums"></browse>';
    // Artist menu -> link to the artist's albums (library: the recorded albums of that artist, USB: none)
    const art = (key.match(/(?:[?&]|%3F)artist=([^&]*)/) || [])[1];
    if (/MG\/LocalMusic-Artist\?/.test(key)) {
      const svc = key.split(":")[0];
      return (
        `<browse type="menu"><item browseKey="${svc}:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=${art}&amp;service=${svc}" text="Albums" type="link"></item>` +
        `<item browseKey="${svc}:Song/%2Flibrary%2Fv1%2FSongs%3Fartist=${art}&amp;service=${svc}" text="Songs" type="link"></item></browse>`
      );
    }
    if (/:Album\/%2Flibrary%2Fv1%2FAlbums%3Fartist=/.test(key)) {
      if (key.startsWith(USB)) return '<browse type="albums"></browse>';
      const name = decodeURIComponent(art.replace(/\+/g, " "));
      // Like the real player (Bruno E17), the artist list does not mark favourites: no isFavourite,
      // no &isFavourite=1 in the context menu key, favourite-add also for favourites.
      return fx("07").replace(/\s*<item [^>]*type="album">[\s\S]*?<\/contextMenu>\s*<\/item>/g, (it) =>
        (it.match(/ text2="([^"]*)"/) || [])[1]?.replace(/&amp;/g, "&") === name
          ? it
              .replace(/ isFavourite="true"/, "")
              .replace(/&amp;isFavourite=1/, "")
              .replace("/DeleteFavourite", "/AddFavourite")
              .replace("favourite-delete", "favourite-add")
              .replace("Remove favourite", "Favourite")
          : "",
      );
    }
    // Like the real player (Bruno E25 / E26): with a non-English Accept-Language (e.g. a German browser)
    // the track list of an album is an empty menu.
    if (/MG\/LocalMusic-Album/.test(key))
      return /^en\b/i.test(lang)
        ? discTracks(fx("08"))
        : '<browse serviceIcon="/images/LibraryIcon.png" serviceName="Bibliothek" searchKey="LocalMusic:Search" type="menu"></browse>';
    if (/CM\/LocalMusic-Album/.test(key)) {
      // Library albums: favourite state follows the isFavourite flag of the key, whatever state the fixture recorded;
      // USB albums: no favourites
      if (key.startsWith(USB)) return fx("09").replace(/\s*<item[^>]*favourite-(delete|add)[^>]*><\/item>/, "");
      return favMenu(fx("09"), key.includes("isFavourite=1"));
    }
    // Search: composers of the term (none here; tests override the list), a composer's browse menu with the
    // link to the albums with his songs (like the real player, Bruno E38) and that album list (library: the
    // recorded albums, USB: none)
    if (/:Composer\/%2Flibrary%2Fv1%2FComposers%3Fexpr=/.test(key)) return '<browse type="composers"></browse>';
    if (/MG\/LocalMusic-Composer\?/.test(key)) {
      const svc = key.split(":")[0],
        comp = (key.match(/[?&]composer=([^&]*)/) || [])[1];
      return (
        `<browse type="menu"><item browseKey="${svc}:Album/%2Flibrary%2Fv1%2FAlbums%3Fcomposer=${comp}&amp;service=${svc}" text="Albums" type="link"></item>` +
        `<item browseKey="${svc}:Song/%2Flibrary%2Fv1%2FSongs%3Fcomposer=${comp}&amp;service=${svc}" text="Songs" type="link"></item></browse>`
      );
    }
    if (/:Album\/%2Flibrary%2Fv1%2FAlbums%3Fcomposer=/.test(key))
      return key.startsWith(USB) ? '<browse type="albums"></browse>' : fx("07");
    if (key === "BluOS:")
      return fx("16").replace(
        /\s*<item browseKey="BluOS:MG[^>]* text="([^"]*)"[\s\S]*?<\/contextMenu>\s*<\/item>/g,
        (m, n) => (state.deletedPlaylists.includes(n.replace(/&amp;/g, "&")) ? "" : m),
      );
    // Track list of a BluOS playlist (Bruno A28): every playlist gets the recorded tracks under its own name.
    // Like the real player, 10 tracks per page with nextKey; page 2 (offset=10) holds PL_PAGE2 more tracks,
    // without autoplayURL, the playURL carries listindex (from 0 again) and offset.
    const pln = (key.match(/^BluOS:MG\/BluOS-Playlist\?playlist=(.*)$/) || [])[1];
    if (pln !== undefined) return fx("28").replace(/(playlist|name)=TTT\b/g, (_, p) => p + "=" + pln);
    const pl2 = (key.match(/^BluOS:Song\/%2FSongs%3Fplaylist=(.*)&offset=10$/) || [])[1];
    if (pl2 !== undefined) {
      const tracks = [...fx("28").matchAll(/<item [^>]*type="track"><\/item>/g)]
        .slice(0, PL_PAGE2)
        .map((m, i) =>
          m[0]
            .replace(/ autoplayURL="[^"]*"/, "")
            .replace(
              /( playURL="[^"]*)"/,
              `$1&amp;listindex=${i}&amp;nextlist=1&amp;where=last&amp;cursor=last&amp;playnow=1&amp;playlist=${pl2}&amp;offset=10"`,
            ),
        );
      return `<browse serviceIcon="/images/BluOSIcon.png" serviceName="BluOS" type="tracks" playURL="/Load?service=BluOS&amp;name=${pl2}">${tracks.join("")}</browse>`;
    }
    // Library playlists (Bruno A29 / A30): the library has the recorded ones, no favourite whatever the recording
    // had, the USB drive none (like the real player); the track list of every library playlist is the recorded
    // one, all tracks in one answer.
    if (/:Playlist\/%2Flibrary%2Fv1%2FPlaylists%3F/.test(key))
      return key.startsWith(USB)
        ? '<browse serviceIcon="/images/USBIcon.png" serviceName="USB" type="playlists"></browse>'
        : favMenu(fx("29"), false)
            .replace(/ isFavourite="true"/g, "")
            .replace(/\?isFavourite=1&amp;/g, "?");
    if (/MG\/LocalMusic-Playlist\?/.test(key)) return fx("30");
    // Context menu of a library playlist (Bruno W38): the recorded one, with the favourite state of the key's
    // isFavourite flag
    if (/CM\/LocalMusic-Playlist\?/.test(key)) {
      const menu = (fx("29").match(/<contextMenu>([\s\S]*?)<\/contextMenu>/) || [])[1] || "";
      return `<browse type="contextMenu">${favMenu(menu, /[?&]isFavourite=1(&|$)/.test(key))}</browse>`;
    }
    // Search menu: like the real player, the USB drive links to lists with its own keys
    if (/:Search$/.test(key)) return key.startsWith(USB) ? fx("18").replace(/LocalMusic/g, USB) : fx("18");
    if (/Albums%3Fexpr=/.test(key)) return fx("07");
    return "<browse></browse>";
  };
  // Track number of the recorded track i (0-based) on a multi-disc album (state.discs)
  const discTrack = (i) =>
    state.discRunOn ? i + 1 : state.discs.slice(0, i + 1).filter((d) => d === state.discs[i]).length;
  const discTracks = (x) => {
    if (!state.discs) return x;
    let i = 0;
    return x.replace(/ text="\d+\. /g, () => ` text="${discTrack(i++)}. `);
  };
  const discSongs = (x) => {
    if (!state.discs) return x;
    let i = 0;
    return x.replace(/<track>\d+<\/track>/g, () => {
      const t = `<track>${discTrack(i)}</track><discno>${state.discs[i]}</discno>`;
      i++;
      return t;
    });
  };
  const library = (q) => {
    const svc = q.get("service");
    // Only the first page is recorded; further pages (nextlink with start=) are empty
    if (q.get("start")) return "<albums></albums>";
    if (q.get("recent") === "1") return svc === USB ? fx("14") : fx("11");
    if (q.get("category") === "FAVOURITES") return svc === USB ? '<albums category="FAVOURITES"></albums>' : fx("12");
    if (q.get("genre")) return q.get("section") === "all" ? genreSection(svc) : "<albums></albums>";
    if (q.get("quality")) {
      if (svc === USB) return fx("15");
      return ["A", "all"].includes(q.get("section")) ? fx("13") : "<albums><sections></sections></albums>";
    }
    if (q.get("section") === "all" && q.get("length") === "1" && q.get("sort") === "decade") return decadeIndex(svc);
    if (q.get("section")) return yearSection(svc, q.get("section"));
    return "<albums></albums>";
  };
  // Albums of a genre (genre= with section=all, Bruno E44): the same albums as the genre's /Browse lists of the
  // mock, i.e. fixture 07 for the library and none for the USB drive.
  const genreSection = (svc) => {
    if (svc === USB) return "<albums><sections></sections></albums>";
    const albums = [...fx("07").matchAll(/<item [^>]*type="album">/g)].map(([it]) => {
      const val = (n) => (it.match(new RegExp(` ${n}="([^"]*)"`)) || [])[1] || "";
      const fav = val("isFavourite") ? ' isFavourite="1"' : "";
      return `<album tracks="${val("tracks")}"${fav}><title>${val("text")}</title><art>${val("text2")}</art></album>`;
    });
    const list = `<section name="#">${albums.join("")}</section>`;
    return `<albums section="all" service="${svc}"><sections>${list}</sections></albums>`;
  };
  // A section without a filter: like the real player (Bruno E34) every album with a year tag has date="<year>".
  // Library: the albums of fixture 13 in section A; USB: USB_YEARS in section S; all other sections are empty.
  // section=all answers every section at once (Bruno E43).
  const yearSection = (svc, sec) => {
    if (svc !== USB) {
      const filled = sec === "A" || sec === "all";
      return filled ? fx("13").replace(/ quality="cd"/, "") : "<albums><sections></sections></albums>";
    }
    const albums = USB_YEARS.map(
      (x) => `<album tracks="12" date="${x.y}"><title>${x.t}</title><art>${x.a}</art></album>`,
    );
    const list = sec === "S" || sec === "all" ? `<section name="S">${albums.join("")}</section>` : "";
    return `<albums limit="500" section="${sec}" service="${USB}"><sections>${list}</sections></albums>`;
  };
  // Decade index of a source (section=all&length=1&sort=decade, Bruno E41 / E42): no albums, one section per
  // decade counted from the years of yearSection(); albums without a year are left out.
  const decadeIndex = (svc) => {
    const counts = {};
    for (const m of yearSection(svc, svc === USB ? "S" : "A").matchAll(/<album [^>]*date="(\d{4})"/g)) {
      const k = m[1].slice(0, 3) + "0";
      counts[k] = (counts[k] || 0) + 1;
    }
    const decades = Object.keys(counts).sort();
    const secs = decades.map((k) => `<section name="${k}" length="${counts[k]}"></section>`).join("");
    return `<albums length="1" section="all" sort="decade" service="${svc}"><sections>${secs}</sections></albums>`;
  };
  // Like the real player, the root of every library answer carries the service and the library version (state.libId)
  const libVersion = (x, q) =>
    q.get("service") === USB
      ? x
      : x.replace(/<(albums|songs)\b([^>]*)>/, (m, tag, at) => {
          const rest = at.replace(/ (id|service)="[^"]*"/g, "");
          return `<${tag}${rest} id="${state.libId}" service="${LIB}">`;
        });
  // Generated queue (state.queueSize songs), the part start..end as the player pages it
  const genQueue = (q) => {
    const n = state.queueSize,
      s = +q.get("start") || 0,
      e = Math.min(n - 1, q.has("end") ? +q.get("end") : n - 1);
    let x = `<playlist length="${n}" id="${state.pid}">`;
    for (let i = s; i <= e; i++)
      x += `<song service="LocalMusic" id="${i}"><art>Artist ${i}</art><alb>Album ${i}</alb><title>Song ${i}</title><time>60</time></song>`;
    return x + "</playlist>";
  };
  const answer = (u, lang) => {
    const url = new URL(u),
      p = url.pathname,
      q = url.searchParams,
      pq = p + url.search;
    state.requests.push(pq);
    state.times.push(Date.now());
    state.langs.push(lang);
    if (COMMANDS.test(pq) && !/^\/Volume$/.test(pq)) state.commands.push(decodeURIComponent(pq));
    if (QUEUE_CHANGES.test(pq)) state.pid++;
    const o = override(pq);
    if (o && (o.status || o.body !== undefined))
      return { status: o.status || 200, type: o.type || "text/xml", body: o.body || "", delay: o.delay, held: o.held };
    if (/^\/(Add|Delete)Favourite\?/.test(pq)) state.libId += 65536;
    let a = mockAnswer(p, q, lang);
    if (o && o.edit && typeof a === "string") a = o.edit(a);
    if (o && (o.delay || o.held))
      a = { ...(typeof a === "string" ? { type: "text/xml", body: a } : a), delay: o.delay, held: o.held };
    return a;
  };
  const mockAnswer = (p, q, lang) => {
    if (p === "/Artwork") return { type: "image/png", body: PNG };
    if (/^\/images\/((USB|Library)Icon|settings\/icon_[a-z]+-mode-active)\.png$/.test(p))
      return { type: "image/png", body: PNG };
    if (p === "/Browse") return browse(q.get("key"), lang);
    if (p === "/library/v1/Albums") return libVersion(library(q), q);
    if (p === "/library/v1/Songs") {
      let x = q.get("service") === USB ? fx("26") : discSongs(fx("25"));
      for (const [t, ar] of Object.entries(state.songArtists))
        x = x.replace(
          new RegExp("<art>[^<]*</art>(\\s*<alb>[^<]*</alb>\\s*<title>" + t + "</title>)"),
          "<art>" + ar + "</art>$1",
        );
      return libVersion(x, q);
    }
    if (p === "/Status") {
      let x = state.playing
        ? fx("19")
            .replace(/<shuffle>\d<\/shuffle>/, "<shuffle>" + (state.shuffle ? 1 : 0) + "</shuffle>")
            .replace(/<repeat>\d<\/repeat>/, "<repeat>" + state.repeat + "</repeat>")
            .replace(/<pid>\d+<\/pid>/, "<pid>" + state.pid + "</pid>")
            .replace(/<syncStat>\d+<\/syncStat>/, "<syncStat>" + state.syncStat + "</syncStat>")
        : '<status etag="idle"><state>stop</state><syncStat>' +
          state.syncStat +
          "</syncStat><volume>19</volume></status>";
      // <mid> is the library version, also when nothing plays (Bruno W39, M41)
      x = /<mid>/.test(x)
        ? x.replace(/<mid>\d*<\/mid>/, `<mid>${state.libId}</mid>`)
        : x.replace("</status>", `<mid>${state.libId}</mid></status>`);
      // After /Move the playing entry is at its new position, like the real player (Bruno W34–W37)
      if (state.queueOrder)
        x = x.replace(/<song>(\d+)<\/song>/, (m, s) => `<song>${state.queueOrder.indexOf(s)}</song>`);
      for (const [tag, v] of Object.entries(state.statusPatch)) {
        const re = new RegExp("<" + tag + ">[^<]*</" + tag + ">");
        x = re.test(x)
          ? x.replace(re, `<${tag}>${v}</${tag}>`)
          : x.replace("</status>", `<${tag}>${v}</${tag}></status>`);
      }
      return x;
    }
    if (p === "/Playlist") {
      if (state.queueSize) return genQueue(q);
      if (state.queueEmpty) return `<playlist length="0" id="${state.pid}"></playlist>`;
      // Only the songs start..end, like the real player (Bruno A20, E33)
      const s = +q.get("start") || 0,
        e = q.has("end") ? +q.get("end") : Infinity;
      let x = fx("20");
      if (state.queueOrder) {
        // Songs in the moved order, numbered again from 0 like the real player
        const songs = {};
        for (const m of x.matchAll(/\s*<song [^>]*id="(\d+)">[\s\S]*?<\/song>/g)) songs[m[1]] = m[0];
        const moved = state.queueOrder.map((id, i) => songs[id].replace(/ id="\d+">/, ` id="${i}">`)).join("");
        x = x.replace(/\s*<song [\s\S]*<\/song>/, moved);
      }
      return x
        .replace(/ id="485">/, ` id="${state.pid}">`)
        .replace(/\s*<song [^>]*id="(\d+)">[\s\S]*?<\/song>/g, (m, id) => (+id >= s && +id <= e ? m : ""));
    }
    if (p === "/Playlists") return fx("17");
    if (p === "/Settings") return fx("21");
    if (p === "/audioPreset")
      return state.listeningMode === null
        ? { status: 404, type: "text/plain", body: "" }
        : fx("27").replace(/(<setting [^>]*value=")[^"]*"/, "$1" + state.listeningMode + '"');
    if (p === "/Version") return `<?xml version="1.0" encoding="UTF-8"?>\n<version>${VERSIONS.api}</version>`;
    if (p === "/GitVersion") return `<?xml version="1.0" encoding="UTF-8"?>\n<version>${VERSIONS.bluos}</version>`;
    if (p === "/Volume") return fx("22");
    if (p === "/Shuffle") {
      state.shuffle = q.get("state") === "1";
      return '<playlist modified="1" length="12" id="486"/>';
    }
    if (p === "/Repeat") {
      state.repeat = q.get("state");
      return "<repeat>" + state.repeat + "</repeat>";
    }
    if (p === "/Save") return "<saved><entries>12</entries></saved>";
    // Moving a queue entry: like the real player (Bruno W34–W37) the entry is taken out of the queue and
    // inserted at position `new`
    if (p === "/Move") {
      const ids = state.queueOrder || [...fx("20").matchAll(/<song [^>]*id="(\d+)">/g)].map((m) => m[1]);
      ids.splice(+q.get("new"), 0, ...ids.splice(+q.get("old"), 1));
      state.queueOrder = ids;
      return '<?xml version="1.0" encoding="UTF-8"?>\n<moved>moved</moved>';
    }
    // Deleting a BluOS playlist: gone from the playlists list (the answer as for every other command)
    if (p === "/Delete" && q.get("service") === "BluOS") state.deletedPlaylists.push(q.get("name"));
    if (p === "/Load") {
      state.queueEmpty = true; // the recorded playlists behave like the broken ones: empty queue
      return "<loaded/>";
    }
    return "<ok/>";
  };
  // Playwright route handler for http://<ip>:11000/**
  const route = async (r) => {
    const a = answer(r.request().url(), r.request().headers()["accept-language"] || "");
    const res = typeof a === "string" ? { type: "text/xml", body: a } : a;
    if (res.delay) await new Promise((z) => setTimeout(z, res.delay));
    if (res.held) {
      res.held.arrived();
      await res.held.released;
    }
    // /Status long polling: answer the follow-up requests (with etag) slowly, like a real player
    if (/\/Status\?.*etag=/.test(r.request().url())) await new Promise((z) => setTimeout(z, 1500));
    await r
      .fulfill({
        status: res.status || 200,
        contentType: res.type,
        headers: { "access-control-allow-origin": "*" },
        body: res.body,
      })
      .catch(() => {});
    if (res.held) res.held.sent();
  };
  // Answer of the mock as text (same as the app would get with Accept-Language: en); not recorded
  const get = async (pth) => {
    const url = new URL("http://mock" + pth);
    const a = mockAnswer(url.pathname, url.searchParams, "en");
    if (typeof a === "string") return a;
    return (a.status || 200) === 200 && typeof a.body === "string" ? a.body : null;
  };
  return { state, route, get };
}
// Real player at `base` (http://<ip>:11000): every request of the app goes through to the player and is
// recorded like in the mock (requests, times, Accept-Language, commands). Overrides do not apply.
function createRecorder(base) {
  const state = { commands: [], requests: [], times: [], langs: [], overrides: [] };
  const route = async (r) => {
    const url = new URL(r.request().url()),
      pq = url.pathname + url.search;
    state.requests.push(pq);
    state.times.push(Date.now());
    state.langs.push(r.request().headers()["accept-language"] || "");
    if (COMMANDS.test(pq) && !/^\/Volume$/.test(pq)) state.commands.push(decodeURIComponent(pq));
    await r.continue().catch(() => {});
  };
  const get = async (pth) => {
    try {
      const r = await fetch(base + pth, { headers: { "Accept-Language": "en" } });
      return r.ok ? await r.text() : null;
    } catch {
      return null;
    }
  };
  return { state, route, get };
}
// Album sections of the USB drive: like the real player, only the sections that contain albums
// (here USB_SECTIONS) of the recorded library sections.
const usbSections = () =>
  fx("06").replace(/\s*<item[^>]*text="([^"]*)"[^>]*><\/item>/g, (it, name) => (USB_SECTIONS.includes(name) ? it : ""));
module.exports = {
  createPlayer,
  createRecorder,
  fx,
  LIB,
  USB,
  USB_GENRES,
  USB_SECTIONS,
  USB_YEARS,
  VERSIONS,
  usbSections,
};
