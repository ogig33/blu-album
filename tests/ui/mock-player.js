// Mock BluOS player for the UI tests.
// Answers every request of the app from the fixtures recorded with the Bruno collection
// (fixtures/NN-*.xml) and records all commands (play, add, favourites, save, delete ...).
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
// 1x1 PNG for all artwork requests
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const LIB = "LocalMusic",
  USB = "1A2B_3C4D";
const COMMANDS =
  /^\/(Add|Play|Pause|Skip|Back|Load|Save|Delete|AddFavourite|DeleteFavourite|Clear|Shuffle|Repeat|Volume\?)/;

function createPlayer(opts = {}) {
  const state = {
    commands: [], // every command URL the app sent, in order
    requests: [], // every request path
    usb: opts.usb !== false, // USB drive connected
    queueEmpty: false,
    shuffle: false,
    repeat: "2",
    songArtists: {}, // title -> artist, overrides the artist of single songs (compilation test)
    playing: opts.playing !== false,
    // Playlist id (<pid> in /Status, id of /Playlist). Like the real player (Bruno 2 Write), it changes
    // when the queue changes: add, remove, shuffle, clear, load. Loading a broken playlist keeps it.
    pid: 485,
    // Listening mode (/audioPreset, fixture 27). null = player without listening modes (answers 404).
    // Like the real player (Bruno S44), a change of the mode raises <syncStat> in /Status.
    listeningMode: opts.listeningModes === false ? null : "MUSIC",
    syncStat: 533,
  };
  const QUEUE_CHANGES = /^\/(Add|Delete\?id=|Shuffle|Clear)/;
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
        ? '<browse type="genres"><item browseKey="1A2B_3C4D:MG/Genres?genre=Soundtrack" text="Soundtrack" type="genre"></item></browse>'
        : fx("04");
    if (/MG\/Genres\?genre=/.test(key)) return fx("05");
    // Album sections (all albums, genre albums) and the stats lists. Like the real player, the USB drive
    // lists only the sections that contain albums (here: A and S).
    if (/bySection:Album/.test(key) && key.startsWith(USB))
      return fx("06").replace(/\s*<item[^>]*text="(?![AS]")[^"]*"[^>]*><\/item>/g, "");
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
        ? fx("08")
        : '<browse serviceIcon="/images/LibraryIcon.png" serviceName="Bibliothek" searchKey="LocalMusic:Search" type="menu"></browse>';
    if (/CM\/LocalMusic-Album/.test(key)) {
      // Library albums: favourite state follows the isFavourite flag of the key; USB albums: no favourites
      if (key.startsWith(USB)) return fx("09").replace(/\s*<item[^>]*favourite-delete[^>]*><\/item>/, "");
      return key.includes("isFavourite=1")
        ? fx("09")
        : fx("09")
            .replace("/DeleteFavourite", "/AddFavourite")
            .replace("favourite-delete", "favourite-add")
            .replace("Remove favourite", "Favourite");
    }
    if (key === "BluOS:") return fx("16");
    if (/:Search$/.test(key)) return fx("18");
    if (/Albums%3Fexpr=/.test(key)) return fx("07");
    return "<browse></browse>";
  };
  const library = (q) => {
    const svc = q.get("service");
    // Only the first page is recorded; further pages (nextlink with start=) are empty
    if (q.get("start")) return "<albums></albums>";
    if (q.get("recent") === "1") return svc === USB ? fx("14") : fx("11");
    if (q.get("category") === "FAVOURITES") return svc === USB ? '<albums category="FAVOURITES"></albums>' : fx("12");
    if (q.get("quality")) {
      if (svc === USB) return fx("15");
      return q.get("section") === "A" ? fx("13") : "<albums><sections></sections></albums>";
    }
    return "<albums></albums>";
  };
  const answer = (u, lang) => {
    const url = new URL(u),
      p = url.pathname,
      q = url.searchParams,
      pq = p + url.search;
    state.requests.push(pq);
    if (COMMANDS.test(pq) && !/^\/Volume$/.test(p)) state.commands.push(decodeURIComponent(pq));
    if (QUEUE_CHANGES.test(pq)) state.pid++;
    if (p === "/Artwork") return { type: "image/png", body: PNG };
    if (p === "/Browse") return browse(q.get("key"), lang);
    if (p === "/library/v1/Albums") return library(q);
    if (p === "/library/v1/Songs") {
      let x = q.get("service") === USB ? fx("26") : fx("25");
      for (const [t, ar] of Object.entries(state.songArtists))
        x = x.replace(
          new RegExp("<art>[^<]*</art>(\\s*<alb>[^<]*</alb>\\s*<title>" + t + "</title>)"),
          "<art>" + ar + "</art>$1",
        );
      return x;
    }
    if (p === "/Status")
      return state.playing
        ? fx("19")
            .replace(/<shuffle>\d<\/shuffle>/, "<shuffle>" + (state.shuffle ? 1 : 0) + "</shuffle>")
            .replace(/<repeat>\d<\/repeat>/, "<repeat>" + state.repeat + "</repeat>")
            .replace(/<pid>\d+<\/pid>/, "<pid>" + state.pid + "</pid>")
            .replace(/<syncStat>\d+<\/syncStat>/, "<syncStat>" + state.syncStat + "</syncStat>")
        : '<status etag="idle"><state>stop</state><syncStat>' +
            state.syncStat +
            "</syncStat><volume>19</volume></status>";
    if (p === "/Playlist")
      return state.queueEmpty
        ? `<playlist length="0" id="${state.pid}"></playlist>`
        : fx("20").replace(/ id="485">/, ` id="${state.pid}">`);
    if (p === "/Playlists") return fx("17");
    if (p === "/Settings") return fx("21");
    if (p === "/audioPreset")
      return state.listeningMode === null
        ? { status: 404, type: "text/plain", body: "" }
        : fx("27").replace(/(<setting [^>]*value=")[^"]*"/, "$1" + state.listeningMode + '"');
    if (p === "/Version") return '<?xml version="1.0" encoding="UTF-8"?>\n<version>v0.5.43</version>';
    if (p === "/GitVersion") return '<?xml version="1.0" encoding="UTF-8"?>\n<version>4.18.18</version>';
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
  };
  return { state, route };
}
module.exports = { createPlayer, LIB, USB };
