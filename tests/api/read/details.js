// 1 Read (safe): 48 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("E01 Album tracks (first track file)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }

    req.url = H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-01-album-tracks.xml");
    console.log(body);

    const t = items("track")[0] || "";
    vars.trackFile = (attr(t, "playURL").match(/[?&]file=([^&]+)/) || [])[1] || "";
    vars.trackCm = attr(t, "contextMenuKey");
    vars.trackTitle = (attr(t, "contextMenuKey").match(/[?&]title=([^&]+)/) || [])[1] || "";
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E02 Album from library (Go to album)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    const svc = key.split(":")[0],
      q = key.split("?")[1] || "";

    req.url = H + "/library/v1/Albums?service=" + svc + "&" + q;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-02-library-album.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E03 Songs of the album (library)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    const svc = key.split(":")[0],
      q = key.split("?")[1] || "";

    req.url = H + "/library/v1/Songs?service=" + svc + "&" + q;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-03-library-songs.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E04 Track context menu", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const cm = vars.trackCm;
    if (!cm) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?key=" + encodeURIComponent(cm);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-04-track-context-menu.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E05 Technical info of the first track", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    const svc = key.split(":")[0];

    const f = vars.trackFile;
    if (!f) {
      req.skip();
      return;
    }
    req.url = H + "/Info?category=technical&filename=" + f + "&service=" + svc;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-05-technical-info.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E06 Track info", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    const svc = key.split(":")[0],
      q = key.split("?")[1] || "";

    req.url = H + "/Info?service=" + svc + "&" + q + "&title=" + (vars.trackTitle || "");
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-06-track-info.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E07 USB - first new album", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const svc = vars.usbSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url = H + "/library/v1/Albums?service=" + svc + "&recent=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-07-usb-new-albums.xml");
    console.log(body);

    const a = (body.match(/<album\b[\s\S]*?<\/album>/) || [""])[0];
    const tx = (t) => dec((a.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "");
    vars.usbAlb = tx("alb") || tx("title");
    vars.usbArt = tx("art");
    console.log("USB album: " + vars.usbAlb + " / " + vars.usbArt);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E08 USB - songs of the album (library)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const svc = vars.usbSvc,
      alb = vars.usbAlb,
      art = vars.usbArt;
    if (!svc || !alb) {
      req.skip();
      return;
    }
    const enc = (v) => encodeURIComponent(v).replace(/%20/g, "+");
    req.url = H + "/library/v1/Songs?service=" + svc + "&album=" + enc(alb) + "&artist=" + enc(art);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-08-usb-songs.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E09 Album tracks without context menus", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Album popup: the track list is read without the per-song context menus (not used by the app,
    // about 60 % of the answer). Play URLs and durations must still be there.
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }

    req.url = H + "/Browse?withContextMenuItems=0&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-09-album-tracks-no-cm.xml");
    console.log(body.length + " bytes");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const tracks = tags("item").filter((t) => attr(t, "type") === "track");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("album has tracks", () => expect(tracks.length).to.be.above(0));
    test("tracks have text, duration and a play URL", () =>
      expect(
        tracks.every((t) => attr(t, "text") && attr(t, "duration") && (attr(t, "autoplayURL") || attr(t, "playURL"))),
      ).to.equal(true));
    test("no context menus", () => expect(/<contextMenu\b/.test(body)).to.equal(false));
  },
});

request("E10 Artist menu (library)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Artist click in the app: the artist's browse menu (key <svc>:MG/LocalMusic-Artist?artist=...)
    // links to the albums of the artist (E11), with the player's play URLs and context menus.
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    const svc = key.split(":")[0],
      artist = (key.match(/[?&]artist=([^&]*)/) || [])[1] || "";
    req.url =
      H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(svc + ":MG/LocalMusic-Artist?artist=" + artist);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const link = tags("item").find((t) => attr(t, "type") === "link" && /:Album\//.test(attr(t, "browseKey")));
    vars.artistAlbumsKey = link ? attr(link, "browseKey") : "";
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("menu with an Albums link (key contains :Album/)", () =>
      expect(tags("item").some((t) => attr(t, "type") === "link" && /:Album\//.test(attr(t, "browseKey")))).to.equal(
        true,
      ));
  },
});

request("E11 Albums of the artist (library)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Follows the Albums link of the artist menu (E10): all albums of the artist in one list.
    const H = "http://" + env.host + ":11000";

    const key = vars.artistAlbumsKey || "";
    if (!key) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-11-artist-albums.xml");
    console.log(body.length + " bytes");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const album = (vars.albumKey.match(/[?&]album=([^&]*)/) || [])[1] || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list of albums, no further pages", () => {
      expect(albums.length).to.be.above(0);
      expect(/nextKey=/.test(body)).to.equal(false);
    });
    test("albums have browseKey, playURL, contextMenuKey, image", () =>
      expect(
        albums.every(
          (t) => attr(t, "browseKey") && attr(t, "playURL") && attr(t, "contextMenuKey") && attr(t, "image"),
        ),
      ).to.equal(true));
    test("context menus with add-last action", () => expect(/type="addAll-last"/.test(body)).to.equal(true));
    test("contains the album the artist came from", () =>
      expect(albums.some((t) => attr(t, "browseKey").includes("album=" + album + "&"))).to.equal(true));
  },
});

request("E12 USB - artist menu", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Like E10 for the artist of the first new USB album (skipped without a USB drive).
    const H = "http://" + env.host + ":11000";

    const svc = vars.usbSvc,
      art = vars.usbNewArt;
    if (!svc || !art) {
      req.skip();
      return;
    }
    const form = (v) =>
      encodeURIComponent(v)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, "+");
    req.url =
      H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(svc + ":MG/LocalMusic-Artist?artist=" + form(art));
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const link = tags("item").find((t) => attr(t, "type") === "link" && /:Album\//.test(attr(t, "browseKey")));
    vars.usbArtistAlbumsKey = link ? attr(link, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("menu with an Albums link (key contains :Album/)", () =>
      expect(tags("item").some((t) => attr(t, "type") === "link" && /:Album\//.test(attr(t, "browseKey")))).to.equal(
        true,
      ));
  },
});

request("E13 USB - albums of the artist", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Follows the Albums link of the USB artist menu (E12).
    const H = "http://" + env.host + ":11000";

    const key = vars.usbArtistAlbumsKey || "";
    if (!key) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list of albums with playURL", () => {
      expect(albums.length).to.be.above(0);
      expect(albums.every((t) => attr(t, "playURL") && attr(t, "browseKey"))).to.equal(true);
    });
    test("no favourite actions on USB", () => expect(/favourite-(add|delete)/.test(body)).to.equal(false));
  },
});

request("E14 Genre albums in one list (library)", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Candidate for the genre chip and a genre map for the album popup: the albums of a genre without
    // sections. Tried 2026-11-15 and answered empty: the browse key
    // <svc>:Album/%2Flibrary%2Fv1%2FAlbums%3Fgenre=…&service=<svc> (also with &offset=0) and
    // /library/v1/Albums?genre=… without section (with limit=500 or offset=0).
    // The BluOS app lists them with this exact request (capture 2026-11-14): /ui/browseGrouped with the
    // genre album list as url. It answers a letter index (offset, length), the total and one page.
    const H = "http://" + env.host + ":11000";

    const svc = vars.libSvc,
      gk = vars.genreKey || "";
    const genre = (gk.match(/[?&]genre=([^&]*)/) || [])[1] || "";
    if (!svc || !genre) {
      req.skip();
      return;
    }
    vars.libGenre = genre;
    req.url =
      H +
      "/ui/browseGrouped?browseIndex=2&menuGroupId=Genres&service=" +
      svc +
      "&title=Albums&type=Album&url=" +
      encodeURIComponent("/library/v1/Albums?genre=" + genre + "&service=" + svc);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-14-genre-albums-grouped.xml");

    const list = (body.match(/<list\b[^>]*>/) || [""])[0];
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    console.log(
      decodeURIComponent(vars.libGenre.replace(/\+/g, " ")) +
        ": " +
        list +
        ", " +
        entries.length +
        " entries on this page, " +
        body.length +
        " bytes",
    );
    console.log(entries[0] || "(no entry)");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const list = (body.match(/<list\b[^>]*>/) || [""])[0];
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list with a total", () => expect(+((list.match(/\btotal="(\d+)"/) || [])[1] || 0)).to.be.above(0));
    test("entries with title (album) and subTitle (artist)", () => {
      expect(entries.length).to.be.above(0);
      expect(entries.every((e) => /\bsubTitle="[^"]+"/.test(e))).to.equal(true);
    });
  },
});

request("E15 USB - genres", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Genre list of the USB drive (key from A03), for E16 (skipped without a USB drive).
    const H = "http://" + env.host + ":11000";

    const key = vars.usbGenresKey || "";
    if (!key) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const g = tags("item").find((t) => attr(t, "type") === "genre");
    vars.usbGenre = g ? (attr(g, "browseKey").match(/[?&]genre=([^&]*)/) || [])[1] || "" : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const genres = tags("item").filter((t) => attr(t, "type") === "genre");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("genres with a genre= key", () => {
      expect(genres.length).to.be.above(0);
      expect(genres.every((t) => /[?&]genre=/.test(attr(t, "browseKey")))).to.equal(true);
    });
  },
});

request("E16 USB - genre albums in one list", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Like E14 for the first genre of the USB drive (E15; skipped without a USB drive).
    const H = "http://" + env.host + ":11000";

    const svc = vars.usbSvc,
      genre = vars.usbGenre;
    if (!svc || !genre) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/ui/browseGrouped?browseIndex=2&menuGroupId=Genres&service=" +
      svc +
      "&title=Albums&type=Album&url=" +
      encodeURIComponent("/library/v1/Albums?genre=" + genre + "&service=" + svc);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const list = (body.match(/<list\b[^>]*>/) || [""])[0];
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    console.log(
      decodeURIComponent(vars.usbGenre.replace(/\+/g, " ")) +
        ": " +
        list +
        ", " +
        entries.length +
        " entries on this page, " +
        body.length +
        " bytes",
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const list = (body.match(/<list\b[^>]*>/) || [""])[0];
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list with a total", () => expect(+((list.match(/\btotal="(\d+)"/) || [])[1] || 0)).to.be.above(0));
    test("entries with title and subTitle", () => {
      expect(entries.length).to.be.above(0);
      expect(entries.every((e) => /\bsubTitle="[^"]+"/.test(e))).to.equal(true);
    });
  },
});

request("E17 Albums of a favourite's artist", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // The app's artist view (E10 / E11) for the artist of the first favourite (A12).
    // Verified 2026-11-15: the artist list does NOT mark favourites – no isFavourite, no
    // &isFavourite=1 in the contextMenuKey, and the context menu offers favourite-add.
    // The tests check this known behaviour, so a firmware that changes it shows up here.
    const H = "http://" + env.host + ":11000";

    const svc = vars.libSvc,
      art = vars.favArtist || "";
    if (!svc || !art) {
      req.skip();
      return;
    }
    const form = (v) =>
      encodeURIComponent(v)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, "+");
    req.url =
      H +
      "/Browse?withContextMenuItems=1&key=" +
      encodeURIComponent(svc + ":Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=" + form(art) + "&service=" + svc);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-17-favourite-artist-albums.xml");
    console.log(vars.favArtist + " / " + vars.favAlbum + ": " + body.length + " bytes");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const blocks =
      body.match(/<item\b[^>]*type="album"[^>]*>[\s\S]*?<\/item>\s*(?=<item\b[^>]*type="album"|<\/browse>)/g) || [];
    const fav = blocks.find((b) => attr(b.match(/<item\b[^>]*>/)[0], "text") === vars.favAlbum);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list contains the favourite album", () => expect(!!fav).to.equal(true));
    test("known: favourite album is not marked (no isFavourite=1 in the contextMenuKey)", () =>
      expect(/[?&]isFavourite=1/.test(attr(fav.match(/<item\b[^>]*>/)[0], "contextMenuKey"))).to.equal(false));
    test("known: favourite album offers favourite-add instead of favourite-delete", () =>
      expect(/type="favourite-add"/.test(fav) && !/type="favourite-delete"/.test(fav)).to.equal(true));
  },
});

request("E18 Album list without context menus", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Candidate for All, genre and search lists: albums without the inline context menus (about a
    // third of the data). The grid needs playURL (play), browseKey (popup), contextMenuKey (menu on
    // demand for add to queue / favourite) and the favourite state for the heart.
    // List: the album section of the first favourite (A12); its key is the first section key of A06
    // with the section letter of the favourite (section lists mark favourites, see E21).
    const H = "http://" + env.host + ":11000";

    const key = vars.sectionKey || "",
      t = vars.favAlbum || "";
    if (!key || !t) {
      req.skip();
      return;
    }
    const c = t.charAt(0).toUpperCase(),
      letter = /[A-Z]/.test(c) ? c : "%23";
    req.url =
      H + "/Browse?withContextMenuItems=0&key=" + encodeURIComponent(key.replace(/section=[^&]*/, "section=" + letter));
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-18-album-list-no-cm.xml");

    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const favs = albums.filter((t) => /[?&]isFavourite=1/.test(attr(t, "contextMenuKey")));
    console.log(
      "section of " +
        vars.favAlbum +
        ": " +
        albums.length +
        " albums, " +
        favs.length +
        " favourites, " +
        body.length +
        " bytes",
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const favKey = (t) => /[?&]isFavourite=1/.test(attr(t, "contextMenuKey"));
    const fav = albums.find((t) => attr(t, "text") === vars.favAlbum);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("albums have browseKey, playURL, contextMenuKey, image", () => {
      expect(albums.length).to.be.above(0);
      expect(
        albums.every(
          (t) => attr(t, "browseKey") && attr(t, "playURL") && attr(t, "contextMenuKey") && attr(t, "image"),
        ),
      ).to.equal(true);
    });
    test("no context menus", () => expect(/<contextMenu\b/.test(body)).to.equal(false));
    test("section contains the favourite album", () => expect(!!fav).to.equal(true));
    test("favourite stays marked without context menus", () =>
      expect(favKey(fav) && attr(fav, "isFavourite") === "true").to.equal(true));
    test("isFavourite attribute matches the context menu key", () =>
      expect(albums.every((t) => (attr(t, "isFavourite") === "true") === favKey(t))).to.equal(true));
  },
});

request("E19 New albums as browse list", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Candidate for the New chip with the player's URLs (instead of the fixed pattern of libAlbum()):
    // the /library/v1 request recent=1 wrapped in a browse key like the artist albums key.
    const H = "http://" + env.host + ":11000";

    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/Browse?withContextMenuItems=1&key=" +
      encodeURIComponent(svc + ":Album/%2Flibrary%2Fv1%2FAlbums%3Frecent=1&service=" + svc);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-19-new-albums-browse.xml");

    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const next = (body.match(/nextKey="([^"]*)"/) || [])[1] || "";
    console.log(
      albums.length +
        " albums, " +
        body.length +
        " bytes, " +
        (next ? "nextKey: " + dec(next) : "no further pages") +
        "; first: " +
        (albums[0] ? attr(albums[0], "text") + " / " + attr(albums[0], "text2") : "-"),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list of albums with browseKey, playURL, contextMenuKey", () => {
      expect(albums.length).to.be.above(0);
      expect(albums.every((t) => attr(t, "browseKey") && attr(t, "playURL") && attr(t, "contextMenuKey"))).to.equal(
        true,
      );
    });
    test("context menus with add-last action", () => expect(/type="addAll-last"/.test(body)).to.equal(true));
  },
});

request("E20 Favourite albums as browse list", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Candidate for the Favourites chip with the player's URLs (instead of libAlbum()):
    // the /library/v1 request category=FAVOURITES wrapped in a browse key.
    const H = "http://" + env.host + ":11000";

    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/Browse?withContextMenuItems=1&key=" +
      encodeURIComponent(svc + ":Album/%2Flibrary%2Fv1%2FAlbums%3Fcategory=FAVOURITES&service=" + svc);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-20-favourite-albums-browse.xml");

    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const next = (body.match(/nextKey="([^"]*)"/) || [])[1] || "";
    console.log(
      albums.length +
        " albums, " +
        body.length +
        " bytes, " +
        (next ? "nextKey: " + dec(next) : "no further pages") +
        " (compare with fixtures/12-library-favourites.xml)",
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list of albums with browseKey, playURL, contextMenuKey", () => {
      expect(albums.length).to.be.above(0);
      expect(albums.every((t) => attr(t, "browseKey") && attr(t, "playURL") && attr(t, "contextMenuKey"))).to.equal(
        true,
      );
    });
    test("every album is a favourite (context menu key with isFavourite=1)", () =>
      expect(albums.every((t) => /[?&]isFavourite=1/.test(attr(t, "contextMenuKey")))).to.equal(true));
    test("context menus offer favourite-delete", () => expect(/type="favourite-delete"/.test(body)).to.equal(true));
  },
});

request("E21 Quality albums of a section as browse list", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Candidate for the quality chips with the player's URLs (instead of libAlbum()): the request of
    // A13 (quality=cd, section A) wrapped in a section key like those of the album section list
    // (<svc>:S:Album/%2Flibrary%2Fv1%2FAlbums%3Fservice=…&limit=50&section=A).
    const H = "http://" + env.host + ":11000";

    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/Browse?withContextMenuItems=1&key=" +
      encodeURIComponent(svc + ":S:Album/%2Flibrary%2Fv1%2FAlbums%3Fquality=cd&service=" + svc + "&limit=50&section=A");
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-21-quality-cd-A-browse.xml");

    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    const next = (body.match(/nextKey="([^"]*)"/) || [])[1] || "";
    console.log(
      albums.length +
        " albums, " +
        body.length +
        " bytes, " +
        (next ? "nextKey: " + dec(next) : "no further pages") +
        " (compare with fixtures/13-library-quality-cd-A.xml and 07-albums-section.xml)",
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const albums = tags("item").filter((t) => attr(t, "type") === "album");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list of albums with browseKey, playURL, contextMenuKey", () => {
      expect(albums.length).to.be.above(0);
      expect(albums.every((t) => attr(t, "browseKey") && attr(t, "playURL") && attr(t, "contextMenuKey"))).to.equal(
        true,
      );
    });
    test("context menus with add-last action", () => expect(/type="addAll-last"/.test(body)).to.equal(true));
  },
});

request("E23 Status - does it carry the listening mode", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    // Does /Status (long polling, used by the app) name the current listening mode of A27?
    if (!vars.lmValue) {
      req.skip();
      return;
    }
    req.url = H + "/Status";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("explore-23-status.xml");
    const v = vars.lmValue,
      l = vars.lmLabel;
    const hits = (body.match(/<([A-Za-z]+)[^>]*>[^<]*<\/\1>/g) || []).filter(
      (t) => new RegExp(">(" + v + "|" + l + ")<", "i").test(t) || /preset|listen|alsa|audio/i.test(t),
    );
    const attrHits = (body.match(/\s[A-Za-z]+="[^"]*"/g) || []).filter(
      (a) => /preset|listen|alsa|audio/i.test(a) || new RegExp('="(' + v + "|" + l + ')"', "i").test(a),
    );
    console.log(
      "listening mode " +
        v +
        " (" +
        l +
        ") in /Status: " +
        (hits.length || attrHits.length ? hits.concat(attrHits).join(" ") : "not found") +
        "\n" +
        body.slice(0, 3000),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("status answer", () => expect(/<status/.test(body)).to.equal(true));
  },
});

request("E24 Artwork - CORS header for fetch", {
  url: `http://${env.host}:11000/Artwork`,
  headers: { Origin: "null" },
  async pre(req) {
    // Firefox upgrades <img src="http://…"> on a file:// page to https (mixed content), so the covers
    // would have to be read with fetch() like the XML answers. fetch() from a file:// page (Origin: null)
    // only works if the player allows it with an Access-Control-Allow-Origin header on the image too.
    const img = vars.albumImage;
    if (!img) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + img + "&followRedirects=1";
  },
  async post(req, res) {
    console.log("Access-Control-Allow-Origin: " + res.header("access-control-allow-origin"));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("returns an image", () => expect(String(res.header("content-type"))).to.match(/^image\//));
    test("allows fetch() from any origin", () =>
      expect(String(res.header("access-control-allow-origin"))).to.equal("*"));
  },
});

request("E25 Album tracks with a German browser language", {
  url: `http://${env.host}:11000/`,
  headers: { "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" },
  async pre(req) {
    // Browsers send Accept-Language with every request (the system language); the API tests send "en" unless a request sets its own.
    // With a German Accept-Language the player answers the track list of some albums with an empty
    // <browse type="menu"/> (seen for one album of the test library; others answer normally). Which albums
    // are hit differs, so this request only records the answer for the first favourite (track count in the console).
    // Album: the first favourite (A12), key in the player's form encoding like in its own lists.
    const album = vars.favAlbum || "",
      artist = vars.favArtist || "";
    if (!album) {
      req.skip();
      return;
    }
    const enc = (v) =>
      encodeURIComponent(v)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, "+");
    const key = "LocalMusic:MG/LocalMusic-Album?album=" + enc(album) + "&artist=" + enc(artist);
    req.url = "http://" + env.host + ":11000/Browse?withContextMenuItems=0&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const n = (body.match(/<item\b[^>]*\stype="track"/g) || []).length;
    console.log("German answer: " + n + " tracks, " + body.length + " bytes: " + body.slice(0, 300));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("E26 Album tracks with Accept-Language en", {
  url: `http://${env.host}:11000/`,
  headers: { "Accept-Language": "en" },
  async pre(req) {
    // Browsers send Accept-Language with every request (the system language); the API tests send "en" unless a request sets its own.
    // The app asks the player in English (UI language), so the album answers the tracks (see E25).
    // Album: the first favourite (A12), key in the player's form encoding like in its own lists.
    const album = vars.favAlbum || "",
      artist = vars.favArtist || "";
    if (!album) {
      req.skip();
      return;
    }
    const enc = (v) =>
      encodeURIComponent(v)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, "+");
    const key = "LocalMusic:MG/LocalMusic-Album?album=" + enc(album) + "&artist=" + enc(artist);
    req.url = "http://" + env.host + ":11000/Browse?withContextMenuItems=0&key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    console.log(body.length + " bytes: " + body.slice(0, 300));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tracks = (body.match(/<item\b[^>]*>/g) || []).filter((t) => /\stype="track"/.test(t));
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("album has tracks", () => expect(tracks.length).to.be.above(0));
  },
});

request("E27 Albums with songs of a composer", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const c = String(
      (
        await http.get(H + "/library/v1/Composers?service=LocalMusic", {
          responseType: "text",
          transformResponse: (x) => x,
        })
      ).data || "",
    );
    const comp = ((c.match(/<composer>([^<]+)<\/composer>/) || [])[1] || "").replace(/&amp;/g, "&");
    if (!comp) {
      req.skip();
      return;
    }
    vars.eComposer = comp;
    req.url = H + "/library/v1/Albums?service=LocalMusic&composer=" + encodeURIComponent(comp);
  },
  async post(req, res) {
    // Which tags does /library/v1/Songs give for classical music? Step 1: the first composer, then the albums with his songs. Read only.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-27-composer-albums.xml");
    console.log(body.slice(0, 4000));
    const first = (xml) => {
      const a = (xml.match(/<album\b[^>]*>([\s\S]*?)<\/album>/) || [])[1] || "";
      const pick = (t) => {
        const m = a.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
        return m ? m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'") : "";
      };
      return { album: pick("title") || pick("alb"), artist: pick("art") };
    };
    const f = first(body);
    vars.eCompAlbum = f.album;
    vars.eCompArtist = f.artist;
    console.log("composer: " + vars.eComposer + ", album: " + f.album + " / " + f.artist);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has a root element, no error", () => {
      expect(/<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
    test("at least one album", () => expect(/<album\b/.test(body)).to.equal(true));
  },
});

request("E28 Songs of the composer's album (tags)", {
  url: `http://${env.host}:11000/library/v1/Songs`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const al = vars.eCompAlbum,
      ar = vars.eCompArtist;
    if (!al) {
      req.skip();
      return;
    }
    req.url =
      H + "/library/v1/Songs?service=LocalMusic&album=" + encodeURIComponent(al) + "&artist=" + encodeURIComponent(ar);
  },
  async post(req, res) {
    // Songs of the album from E27: does each song carry composer, discno, albumartist, compilation? Read only.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-28-composer-album-songs.xml");
    console.log(body.slice(0, 4000));
    const tags = [
      ...new Set(
        [...body.matchAll(/<song\b[\s\S]*?<\/song>/g)].flatMap((m) =>
          [...m[0].matchAll(/<([a-zA-Z]+)>/g)].map((x) => x[1]),
        ),
      ),
    ];
    console.log("elements per song: " + tags.join(", "));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has a root element, no error", () => {
      expect(/<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
    test("has songs", () => expect(/<song\b/.test(body)).to.equal(true));
  },
});

request("E29 Albums of the artist Various (sampler)", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&artist=Various`,
  async post(req, res) {
    // A sampler: albums whose album artist is "Various" (skipped tests when the library has none). Read only.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-29-various-albums.xml");
    console.log(body.slice(0, 4000));
    const m = body.match(/<album\b[^>]*>([^<]+)<\/album>/);
    vars.eVarAlbum = m ? m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'") : "";
    console.log("sampler: " + vars.eVarAlbum);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has a root element, no error", () => {
      expect(/<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
  },
});

request("E30 Songs of the sampler (tags)", {
  url: `http://${env.host}:11000/library/v1/Songs`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const al = vars.eVarAlbum;
    if (!al) {
      req.skip();
      return;
    }
    req.url = H + "/library/v1/Songs?service=LocalMusic&album=" + encodeURIComponent(al) + "&artist=Various";
  },
  async post(req, res) {
    // Songs of the sampler from E29: track artists differ from the album artist – does the answer carry albumartist or compilation? Read only.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-30-various-album-songs.xml");
    console.log(body.slice(0, 4000));
    const tags = [
      ...new Set(
        [...body.matchAll(/<song\b[\s\S]*?<\/song>/g)].flatMap((m) =>
          [...m[0].matchAll(/<([a-zA-Z]+)>/g)].map((x) => x[1]),
        ),
      ),
    ];
    console.log("elements per song: " + tags.join(", "));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has a root element, no error", () => {
      expect(/<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
    test("has songs", () => expect(/<song\b/.test(body)).to.equal(true));
  },
});

request("E31 Artwork - full size with width and height", {
  url: `http://${env.host}:11000/Artwork`,
  headers: { Origin: "null" },
  async pre(req) {
    // The album popup and the full-screen view ask the cover with width and height 3000: the player
    // answers its stored image scaled to that size, but never larger than the original. Without them it
    // answers at most 600 px. Full-size covers need "Optimize Artwork" off and a rebuilt index; with it on
    // the stored cover has 600 px (see docs/blu-album-library-guidance.md).
    const img = vars.albumImage;
    if (!img) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + img + "&width=3000&height=3000&followRedirects=1";
  },
  async post(req, res) {
    // The player sends the image chunked (no Content-Length); this request does not decode it (res.buffer), so the
    // pixel and byte size cannot be read here; check them with the saved response or curl. A cover file
    // larger than 600 KB gives the player's grey placeholder (494 x 494 px, 17829 bytes) instead of the cover.
    console.log("Cover with width/height 3000: " + res.header("content-type"));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("returns an image", () => expect(String(res.header("content-type"))).to.match(/^image\//));
    test("allows fetch() from any origin", () =>
      expect(String(res.header("access-control-allow-origin"))).to.equal("*"));
  },
});

request("E32 Album tracks of a multi-disc album", {
  url: `http://${env.host}:11000/`,
  async pre(req) {
    // Album popup with disc headers: how does /Browse list the tracks of an album with several discs?
    // Finds the first song with discno >= 2 in the library search, reads the songs of its album
    // (/library/v1/Songs, discno per song) and asks the album track list as the app does. Read only.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const pick = (s, t) => {
      const m = s.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    let album = "",
      artist = "";
    for (const e of ["a", "e", "i", "o"]) {
      const s = await get("/library/v1/Search?service=LocalMusic&expr=" + e);
      const hit = [...s.matchAll(/<song>([\s\S]*?)<\/song>/g)].map((m) => m[1]).find((x) => +pick(x, "discno") >= 2);
      if (hit) {
        album = pick(hit, "alb");
        artist = pick(hit, "albumartist") || pick(hit, "art");
        break;
      }
    }
    if (!album) {
      console.log("No song with discno >= 2 found in the search");
      req.skip();
      return;
    }
    const q = "album=" + encodeURIComponent(album) + "&artist=" + encodeURIComponent(artist);
    const songs = await get("/library/v1/Songs?service=LocalMusic&" + q);
    vars.eDiscSongs = JSON.stringify(
      [...songs.matchAll(/<song\b[\s\S]*?<\/song>/g)].map((m) => ({
        title: pick(m[0], "title"),
        track: +pick(m[0], "track"),
        disc: +pick(m[0], "discno") || 0,
      })),
    );
    vars.eDiscAlbum = album + " / " + artist;
    req.url =
      H +
      "/Browse?withContextMenuItems=0&key=" +
      encodeURIComponent("LocalMusic:MG/LocalMusic-Album?" + q.replace(/%20/g, "+"));
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-32-multi-disc-album-tracks.xml");
    const songs = JSON.parse(vars.eDiscSongs || "[]");
    const texts = [...body.matchAll(/<item\b[^>]*\stype="track"[^>]*>/g)].map(
      (m) => (m[0].match(/\stext="([^"]*)"/) || [])[1] || "",
    );
    console.log("album: " + vars.eDiscAlbum + ", " + texts.length + " tracks, " + songs.length + " songs");
    texts.forEach((t, i) =>
      console.log((songs[i] ? "disc " + songs[i].disc + " track " + songs[i].track : "-") + " | " + t),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const songs = JSON.parse(vars.eDiscSongs || "[]");
    const tracks = [...body.matchAll(/<item\b[^>]*\stype="track"[^>]*>/g)].map((m) =>
      dec((m[0].match(/\stext="([^"]*)"/) || [])[1] || ""),
    );
    const num = (t) => +((t.match(/^(\d+)\.\s/) || [])[1] || 0);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("songs span several discs", () => expect(new Set(songs.map((s) => s.disc)).size).to.be.above(1));
    test("songs are sorted by disc and track", () =>
      expect(
        songs.every(
          (s, i) => !i || s.disc > songs[i - 1].disc || (s.disc === songs[i - 1].disc && s.track > songs[i - 1].track),
        ),
      ).to.equal(true));
    test("one track per song", () => expect(tracks.length).to.equal(songs.length));
    // The disc of a track is the discno of the song at the same position. The track number does not
    // mark the disc: it starts again at 1 on most albums, but runs on across the discs when tagged so.
    test("tracks in the order of the songs: number and title match by position", () =>
      expect(
        tracks.every((t, i) => num(t) === songs[i].track && t.replace(/^\d+\.\s*/, "") === songs[i].title),
      ).to.equal(true));
  },
});

request("E33 Queue entry of the playing song (year)", {
  url: `http://${env.host}:11000/Playlist`,
  async pre(req) {
    // Full-screen player with the year next to the album: /Status has no year. Does the queue entry of the
    // playing song (/Playlist?start=<song>&end=<song>, song of /Status) carry it as <date>? Read only.
    const H = "http://" + env.host + ":11000";
    const status = String(
      (
        await http.get(H + "/Status", {
          responseType: "text",
          transformResponse: (x) => x,
          headers: { "Accept-Language": "en" },
        })
      ).data || "",
    );
    const pick = (t) => {
      const m = status.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? m[1] : "";
    };
    const song = pick("song");
    if (song === "" || pick("streamUrl") || !pick("title1")) {
      console.log("Nothing playing from the queue");
      req.skip();
      return;
    }
    vars.eYearSong = song;
    vars.eYearTitle = pick("title1");
    vars.eYearAlbum = pick("title3");
    req.url = H + "/Playlist?start=" + song + "&end=" + song;
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-33-queue-entry-playing.xml");
    console.log("song " + vars.eYearSong + " (" + vars.eYearTitle + " / " + vars.eYearAlbum + "):\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    const songs = body.match(/<song\b[^>]*>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("exactly one song, the playing one", () => {
      expect(songs.length).to.equal(1);
      expect((songs[0].match(/\sid="(\d+)"/) || [])[1]).to.equal(vars.eYearSong);
    });
    test("same title as /Status title1", () => expect(val("title")).to.equal(dec(vars.eYearTitle || "")));
    test("<date> is a year", () => expect(val("date")).to.match(/^\d{4}/));
  },
});

request("E34 Albums of a section with year (library)", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Candidate for a decade filter: /Browse album lists carry no year, the sectioned /library/v1/Albums
    // list (as for the quality chips, here without a filter) has date="<year>" on every album with a year tag.
    // Albums without a year tag have no date attribute. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url =
      "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc) + "&limit=500&section=A";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-34-section-albums-with-year.xml");
    const albums = body.match(/<album\b[^>]*>/g) || [];
    const decades = {};
    let none = 0;
    albums.forEach((t) => {
      const y = (t.match(/\sdate="(\d{4})"/) || [])[1];
      if (!y) {
        none++;
        return;
      }
      const d = y.slice(0, 3) + "0s";
      decades[d] = (decades[d] || 0) + 1;
    });
    console.log(
      "section A: " +
        albums.length +
        " albums, " +
        body.length +
        " bytes, without year: " +
        none +
        ", per decade: " +
        JSON.stringify(decades),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const albums = body.match(/<album\b[^>]*>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("sectioned answer with albums", () => {
      expect(/<sections\b/.test(body)).to.equal(true);
      expect(albums.length).to.be.above(0);
    });
    test("date (if present) is a four-digit year", () => {
      albums.forEach((t) => {
        const m = t.match(/\sdate="([^"]*)"/);
        if (m) expect(m[1]).to.match(/^\d{4}$/);
      });
    });
    test("most albums have a year", () =>
      expect(albums.filter((t) => /\sdate="/.test(t)).length).to.be.above(albums.length / 2));
  },
});

request("E35 Album decade index (library)", {
  url: `http://${env.host}:11000/ui/browseGrouped`,
  async pre(req) {
    // Candidate for a decade filter: the album list of the BluOS app sorted by decade (sort menu "Decade",
    // &sort=decade inside the url parameter). The index gives one entry per decade (key "1970", offset,
    // length) instead of letters; albums without a year tag are not in the list. One page of 30. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    req.url =
      "http://" +
      env.host +
      ":11000/ui/browseGrouped?browseIndex=1&menuGroupId=" +
      svc +
      "&service=" +
      svc +
      "&title=Albums&type=Album&url=" +
      encodeURIComponent("/library/v1/Albums?service=" + svc + "&sort=decade");
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-35-album-decade-index.xml");
    const idx = [...body.matchAll(/<item key="([^"]*)" offset="(\d+)" length="(\d+)"/g)].map((m) => ({
      key: m[1],
      offset: +m[2],
      length: +m[3],
    }));
    // E36 jumps to the last decade
    const last = idx[idx.length - 1];
    vars.decadeKey = last ? last.key : "";
    vars.decadeOffset = last ? String(last.offset) : "";
    console.log(
      (body.match(/<list\b[^>]*>/) || [""])[0] +
        ", " +
        body.length +
        " bytes\n" +
        idx.map((i) => i.key + "s: " + i.length + " (offset " + i.offset + ")").join("\n"),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const total = +((body.match(/<list\b[^>]*\btotal="(\d+)"/) || [])[1] || 0);
    const idx = [...body.matchAll(/<item key="([^"]*)" offset="(\d+)" length="(\d+)"/g)].map((m) => ({
      key: m[1],
      offset: +m[2],
      length: +m[3],
    }));
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("sort menu: Decade selected", () => expect(/<item text="Decade" selected="true">/.test(body)).to.equal(true));
    test("index keys are decades (four digits ending in 0)", () => {
      expect(idx.length).to.be.above(0);
      idx.forEach((i) => expect(i.key).to.match(/^\d{3}0$/));
    });
    test("index is contiguous and adds up to the total", () => {
      let o = 0;
      idx.forEach((i) => {
        expect(i.offset).to.equal(o);
        o += i.length;
      });
      expect(o).to.equal(total);
    });
    test("first page: at most 30 entries with album, artist and play action", () => {
      expect(entries.length).to.be.above(0);
      expect(entries.length).to.be.at.most(30);
      entries.forEach((e) => {
        expect(e).to.match(/\bsubTitle="[^"]+"/);
        expect(e).to.match(/<playAction\b[^>]*URI="\/Add\?playnow=1/);
      });
    });
    test("next page via listContinuation", () => {
      if (total > entries.length) expect(body).to.match(/<nextLink>[^<]*listContinuation=30/);
    });
  },
});

request("E36 Albums of one decade (library)", {
  url: `http://${env.host}:11000/ui/browseGrouped`,
  async pre(req) {
    // Jumps straight to the last decade of E35 with listContinuation=<offset of the decade>: a decade can be
    // loaded without the pages before it. The page size stays 30 (limit / count in either place are ignored).
    // Read only.
    const svc = vars.libSvc,
      offset = vars.decadeOffset;
    if (!svc || !offset) {
      req.skip();
      return;
    }
    req.url =
      "http://" +
      env.host +
      ":11000/ui/browseGrouped?browseIndex=1&listContinuation=" +
      offset +
      "&menuGroupId=" +
      svc +
      "&service=" +
      svc +
      "&title=Albums&type=Album&url=" +
      encodeURIComponent("/library/v1/Albums?service=" + svc + "&sort=decade");
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-36-albums-of-one-decade.xml");
    const entries = [...body.matchAll(/<item\b[^>]*\btitle="([^"]*)" subTitle="([^"]*)"/g)].map(
      (m) => m[1] + " / " + m[2],
    );
    console.log(vars.decadeKey + "s: " + (body.match(/<list\b[^>]*>/) || [""])[0] + "\n" + entries.join("\n"));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const entries = body.match(/<item\b[^>]*\btitle="[^"]*"[^>]*>[\s\S]*?<\/item>/g) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("list starts at the offset of the decade", () =>
      expect((body.match(/<list\b[^>]*\boffset="(\d+)"/) || [])[1]).to.equal(vars.decadeOffset));
    test("1 to 30 entries with album and artist", () => {
      expect(entries.length).to.be.above(0);
      expect(entries.length).to.be.at.most(30);
      entries.forEach((e) => expect(e).to.match(/\bsubTitle="[^"]+"/));
    });
  },
});

request("E37 Search - which tags find an album", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Which tags does the albums list of the player's search (/Browse searchKey + q, link "Albums") match?
    // Album of the first composer; one search each for a song title, a composer and a track artist of that album.
    // A term is only used when it does not occur in the album title, the album artist or any track artist of the album. Read only.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const pick = (x, t) => {
      const m = x.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };

    const c = await get("/library/v1/Composers?service=LocalMusic");
    const comp = dec((c.match(/<composer>([^<]+)<\/composer>/) || [])[1] || "");
    if (!comp) {
      req.skip();
      return;
    }
    const a = (await get("/library/v1/Albums?service=LocalMusic&composer=" + encodeURIComponent(comp))).match(
      /<album\b[^>]*>([\s\S]*?)<\/album>/,
    );
    if (!a) {
      req.skip();
      return;
    }
    const album = pick(a[1], "title"),
      albumArtist = pick(a[1], "art");
    const songs = [
      ...(
        await get(
          "/library/v1/Songs?service=LocalMusic&album=" +
            encodeURIComponent(album) +
            "&artist=" +
            encodeURIComponent(albumArtist),
        )
      ).matchAll(/<song\b[\s\S]*?<\/song>/g),
    ].map((m) => ({ title: pick(m[0], "title"), art: pick(m[0], "art"), composer: pick(m[0], "composer") }));
    const low = (s) => s.toLowerCase();
    const albumTexts = [album, albumArtist, ...songs.map((s) => s.art)].map(low);
    const free = (t) => t.length >= 3 && !albumTexts.some((x) => x.includes(low(t)));
    const term = {
      title: (songs.find((s) => free(s.title)) || {}).title || "",
      composer:
        (
          songs.find(
            (s) => s.composer && free(s.composer) && !songs.some((o) => low(o.title).includes(low(s.composer))),
          ) || {}
        ).composer || "",
      trackArtist:
        (songs.find((s) => s.art && !low(album).includes(low(s.art)) && !low(albumArtist).includes(low(s.art))) || {})
          .art || "",
    };

    // Albums of the search's "Albums" link (all sections), as the app reads them
    const albumsLink = async (q) => {
      const menu = await get("/Browse?key=" + encodeURIComponent("LocalMusic:Search") + "&q=" + encodeURIComponent(q));
      const link = (menu.match(/<item\b[^>]*>/g) || []).find((t) => attr(t, "text") === "Albums");
      return link ? attr(link, "browseKey") : "";
    };
    const albumsOf = async (key) => {
      const its = (await get("/Browse?key=" + encodeURIComponent(key))).match(/<item\b[^>]*>/g) || [];
      const secs = its.filter((t) => attr(t, "type") === "section" && attr(t, "text2") !== "0");
      if (!secs.length)
        return its.filter((t) => attr(t, "type") === "album").map((t) => attr(t, "text") + " / " + attr(t, "text2"));
      const out = [];
      for (const s of secs) out.push(...(await albumsOf(attr(s, "browseKey"))));
      return out;
    };
    const target = album + " / " + albumArtist;
    const found = {};
    for (const k of ["title", "composer"])
      found[k] = term[k] ? (await albumsOf(await albumsLink(term[k]))).includes(target) : null;
    console.log(
      "album: " +
        target +
        " | song title: " +
        term.title +
        " → " +
        found.title +
        " | composer: " +
        term.composer +
        " → " +
        found.composer +
        " | track artist: " +
        term.trackArtist,
    );
    vars.eSearchTarget = target;
    vars.eSearchFound = JSON.stringify(found);
    if (!term.trackArtist) {
      req.skip();
      return;
    }
    const key = await albumsLink(term.trackArtist);
    if (!key) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?key=" + encodeURIComponent(key);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-37-search-track-artist-albums.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const albums = (body.match(/<item\b[^>]*>/g) || [])
      .filter((t) => attr(t, "type") === "album")
      .map((t) => attr(t, "text") + " / " + attr(t, "text2"));
    const found = JSON.parse(vars.eSearchFound || "{}");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("a track artist finds the album", () => expect(albums).to.include(vars.eSearchTarget));
    test("a song title does not find the album", () => {
      if (found.title !== null) expect(found.title).to.equal(false);
    });
    test("a composer does not find the album", () => {
      if (found.composer !== null) expect(found.composer).to.equal(false);
    });
  },
});

request("E38 Search - albums of a found composer", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Albums of a composer found by the player's search: search (/Browse searchKey + q) -> link "Composers" ->
    // the composer's browse menu -> its link "Albums". Term: the first composer of the library. Read only.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const items = (x) => x.match(/<item\b[^>]*>/g) || [];
    const browse = (key, q) =>
      get("/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key) + (q ? "&q=" + encodeURIComponent(q) : ""));

    const comp = dec(
      ((await get("/library/v1/Composers?service=LocalMusic")).match(/<composer>([^<]+)<\/composer>/) || [])[1] || "",
    );
    if (!comp) {
      req.skip();
      return;
    }
    const link = items(await browse("LocalMusic:Search", comp)).find((t) => attr(t, "text") === "Composers");
    const list = link ? await browse(attr(link, "browseKey")) : "";
    const hit = items(list).find((t) => attr(t, "type") === "composer" && attr(t, "text") === comp);
    const menu = hit ? items(await browse(attr(hit, "browseKey"))) : [];
    const albums = menu.find((t) => attr(t, "type") === "link" && /:Album\//.test(attr(t, "browseKey")));
    const a = (await get("/library/v1/Albums?service=LocalMusic&composer=" + encodeURIComponent(comp))).match(
      /<album\b[^>]*>([\s\S]*?)<\/album>/,
    );
    const pick = (t) => {
      const m = a ? a[1].match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) : null;
      return m ? dec(m[1]) : "";
    };
    vars.eCompSearch = JSON.stringify({
      composer: comp,
      link: !!link,
      hit: hit ? { key: attr(hit, "browseKey"), type: attr(hit, "type") } : null,
      menu: menu.map((t) => attr(t, "text") + " " + attr(t, "browseKey")),
      target: pick("title") + " / " + pick("art"),
    });
    console.log("composer: " + comp + " | composer menu: " + menu.map((t) => attr(t, "text")).join(", "));
    if (!albums) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?withContextMenuItems=1&key=" + encodeURIComponent(attr(albums, "browseKey"));
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-38-search-composer-albums.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const albums = (body.match(/<item\b[^>]*>/g) || []).filter((t) => attr(t, "type") === "album");
    const s = JSON.parse(vars.eCompSearch || "{}");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the search menu has a link Composers", () => expect(s.link).to.equal(true));
    test("the composers list has the composer with a browse key", () => {
      expect(s.hit.type).to.equal("composer");
      expect(s.hit.key).to.match(/:MG\/LocalMusic-Composer\?composer=/);
    });
    test("the composer menu links to Albums", () =>
      expect(s.menu.some((m) => /^Albums .*:Album\//.test(m))).to.equal(true));
    test("albums list with play URLs and context menus", () => {
      expect(/<browse\b[^>]*type="albums"/.test(body)).to.equal(true);
      expect(albums.length).to.be.above(0);
      albums.forEach((t) => {
        expect(attr(t, "browseKey")).to.not.equal("");
        expect(attr(t, "playURL")).to.not.equal("");
        expect(attr(t, "contextMenuKey")).to.not.equal("");
      });
    });
    test("contains the first album of /library/v1/Albums?composer=", () =>
      expect(albums.map((t) => attr(t, "text") + " / " + attr(t, "text2"))).to.include(s.target));
  },
});

request("E39 Search - songs list and song context menu", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Does a song of the player's search lead to its album? Search (/Browse searchKey + q) -> link "Songs" ->
    // first song -> its context menu. Term: the first word of 3 or more letters in the title of the first song. Read only.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const items = (x) => x.match(/<item\b[^>]*>/g) || [];

    const first = dec(
      ((await get("/library/v1/Songs?service=LocalMusic&end=1")).match(/<title>([^<]+)<\/title>/) || [])[1] || "",
    );
    const term = (first.match(/[\p{L}\p{N}]{3,}/u) || [])[0];
    if (!term) {
      req.skip();
      return;
    }
    const link = items(
      await get("/Browse?key=" + encodeURIComponent("LocalMusic:Search") + "&q=" + encodeURIComponent(term)),
    ).find((t) => attr(t, "text") === "Songs");
    const list = link ? await get("/Browse?key=" + encodeURIComponent(attr(link, "browseKey"))) : "";
    const song = items(list).find((t) => attr(t, "type") === "track");
    vars.eSongSearch = JSON.stringify({
      term,
      link: !!link,
      listType: attr((list.match(/<browse\b[^>]*>/) || [""])[0], "type"),
      song: song
        ? {
            browseKey: attr(song, "browseKey"),
            cm: attr(song, "contextMenuKey"),
            text2: attr(song, "text2"),
            playURL: attr(song, "playURL"),
          }
        : null,
    });
    console.log(
      "term: " + term + " | first song: " + (song ? attr(song, "text") + " / " + attr(song, "text2") : "none"),
    );
    if (!song || !attr(song, "contextMenuKey")) {
      req.skip();
      return;
    }
    req.url = H + "/Browse?key=" + encodeURIComponent(attr(song, "contextMenuKey"));
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-39-search-song-context-menu.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const its = body.match(/<item\b[^>]*>/g) || [];
    const s = JSON.parse(vars.eSongSearch || "{}");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the search menu has a link Songs", () => expect(s.link).to.equal(true));
    test("songs list of type tracks", () => expect(s.listType).to.equal("tracks"));
    test("a song has no browse key, but a context menu key with album and artist", () => {
      expect(s.song.browseKey).to.equal("");
      expect(s.song.cm).to.match(/:CM\/LocalMusic-Song\?album=.*&artist=/);
    });
    test("a song's text2 is 'artist • album'", () => expect(s.song.text2).to.match(/ • /));
    test("a song plays by its file", () => expect(s.song.playURL).to.match(/[?&]file=/));
    test("the song context menu has no link to the album", () => {
      expect(its.length).to.be.above(0);
      its.forEach((t) => {
        expect(attr(t, "browseKey")).to.equal("");
        expect(attr(t, "text")).to.not.match(/album/i);
      });
    });
  },
});

request("E40 Search - album artist does not find an album", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Does the albums list of the player's search (/Browse searchKey + q, link "Albums") match the album artist?
    // Album artists come from the sectioned artists list of the library; the first album artist with an album whose
    // title and track artists do not contain the name is searched for. Read only.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const items = (x) => x.match(/<item\b[^>]*>/g) || [];
    const low = (s) => s.toLowerCase();

    // Sectioned artists list of the library menu (link "Artists"): its sections, then the artists of each section
    const menu = await get("/Browse?key=" + encodeURIComponent("LocalMusic:"));
    const artLink = items(menu).find((t) => attr(t, "text") === "Artists");
    if (!artLink) {
      req.skip();
      return;
    }
    const secs = items(await get("/Browse?key=" + encodeURIComponent(attr(artLink, "browseKey")))).filter(
      (t) => attr(t, "type") === "section",
    );
    // An album of `name` whose title and track artists do not contain the name (first 10 albums), or null
    const albumOf = async (name) => {
      // With artist= the album title is the text of <album> (inside <artist name="…">)
      const list = [
        ...(await get("/library/v1/Albums?service=LocalMusic&artist=" + encodeURIComponent(name))).matchAll(
          /<album\b[^>]*>([^<]*)<\/album>/g,
        ),
      ].slice(0, 10);
      for (const a of list) {
        const album = dec(a[1]);
        const arts = [
          ...(
            await get(
              "/library/v1/Songs?service=LocalMusic&album=" +
                encodeURIComponent(album) +
                "&artist=" +
                encodeURIComponent(name),
            )
          ).matchAll(/<art>([^<]*)<\/art>/g),
        ].map((m) => low(dec(m[1])));
        if (arts.length && !low(album).includes(low(name)) && !arts.some((x) => x.includes(low(name))))
          return { name, album };
      }
      return null;
    };
    // Album artists of the sectioned list; "Various" (samplers, see E29) first, as its tracks rarely carry the name
    const names = [];
    for (const s of secs) {
      const sec = (attr(s, "browseKey").match(/section=([^&]+)/) || [])[1];
      names.push(
        ...[
          ...(await get("/library/v1/Artists?service=LocalMusic&section=" + sec)).matchAll(/<art>([^<]+)<\/art>/g),
        ].map((m) => dec(m[1])),
      );
    }
    let target = null,
      checked = 0;
    for (const name of [...names.filter((n) => /^various/i.test(n)), ...names.filter((n) => n.length >= 4)]) {
      if (++checked > 30 || (target = await albumOf(name))) break;
    }
    console.log(
      "album artists checked: " + checked + " | target: " + (target ? target.album + " / " + target.name : "none"),
    );
    if (!target) {
      req.skip();
      return;
    }
    // Albums of the search's "Albums" link (all sections), as the app reads them
    const albumsOf = async (key) => {
      const its = items(await get("/Browse?key=" + encodeURIComponent(key)));
      const s = its.filter((t) => attr(t, "type") === "section" && attr(t, "text2") !== "0");
      if (!s.length)
        return its.filter((t) => attr(t, "type") === "album").map((t) => attr(t, "text") + " / " + attr(t, "text2"));
      const out = [];
      for (const x of s) out.push(...(await albumsOf(attr(x, "browseKey"))));
      return out;
    };
    const search = await get(
      "/Browse?key=" + encodeURIComponent("LocalMusic:Search") + "&q=" + encodeURIComponent(target.name),
    );
    const link = items(search).find((t) => attr(t, "text") === "Albums");
    const found = link ? await albumsOf(attr(link, "browseKey")) : [];
    const all =
      (await get("/library/v1/Albums?service=LocalMusic&artist=" + encodeURIComponent(target.name))).match(
        /<album\b/g,
      ) || [];
    console.log(
      "albums of the album artist: " +
        all.length +
        " | albums of the search with this album artist: " +
        found.filter((x) => x.endsWith(" / " + target.name)).length,
    );
    vars.eAlbumArtistTarget = target.album + " / " + target.name;
    vars.eAlbumArtistFound = JSON.stringify(found);
    // The request itself: the albums of the album artist through its browse menu (sectioned artists list), as a contrast
    req.url =
      H +
      "/Browse?key=" +
      encodeURIComponent(
        "LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=" +
          encodeURIComponent(target.name).replace(/%20/g, "+") +
          "&service=LocalMusic",
      );
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-40-search-album-artist.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const albums = (body.match(/<item\b[^>]*>/g) || [])
      .filter((t) => attr(t, "type") === "album")
      .map((t) => attr(t, "text") + " / " + attr(t, "text2"));
    const target = vars.eAlbumArtistTarget;
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the albums of the album artist contain the album", () => expect(albums).to.include(target));
    test("a search for the album artist does not find the album", () =>
      expect(JSON.parse(vars.eAlbumArtistFound || "[]")).to.not.include(target));
  },
});

request("E41 Decade index without ui (library)", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Decade index of the decade chips: section=all&length=1 answers only the sections with their album counts
    // (no albums), with sort=decade one section per decade. It must count the same as the years (date) of the
    // A-Z sections, which the app reads when a decade is clicked; albums without a year are in no decade. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const base = "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc);
    const get = async (q) =>
      String(
        (
          await http.get(base + q, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    const sections = [...(await get("&section=all&length=1")).matchAll(/<section name="([^"]*)" length="(\d+)"/g)];
    const counts = {};
    for (const s of sections) {
      for (const m of (await get("&limit=500&section=" + encodeURIComponent(dec(s[1])))).matchAll(
        /<album\b[^>]*\sdate="(\d{4})"/g,
      )) {
        const d = m[1].slice(0, 3) + "0";
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    vars.e41Years = JSON.stringify(
      Object.keys(counts)
        .sort()
        .map((d) => [d, counts[d]]),
    );
    req.url = base + "&section=all&length=1&sort=decade";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-41-decade-index-library.xml");
    console.log(
      body.length +
        " bytes: " +
        [...body.matchAll(/<section name="([^"]*)" length="(\d+)"/g)].map((m) => m[1] + "s " + m[2]).join(", "),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const idx = [...body.matchAll(/<section name="([^"]*)" length="(\d+)"/g)].map((m) => [m[1], +m[2]]);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("only the index, no albums", () => {
      expect(/<albums\b/.test(body)).to.equal(true);
      expect(/<album[\s>]/.test(body)).to.equal(false);
    });
    test("section names are decades (four digits ending in 0)", () =>
      idx.forEach((i) => expect(i[0]).to.match(/^\d{3}0$/)));
    test("decades and counts = the years of the A-Z sections", () =>
      expect(idx).to.deep.equal(JSON.parse(vars.e41Years)));
  },
});

request("E42 Decade index without ui (USB)", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Decade index of the decade chips: section=all&length=1 answers only the sections with their album counts
    // (no albums), with sort=decade one section per decade. It must count the same as the years (date) of the
    // A-Z sections, which the app reads when a decade is clicked; albums without a year are in no decade. Read only.
    const svc = vars.usbSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const base = "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc);
    const get = async (q) =>
      String(
        (
          await http.get(base + q, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    const sections = [...(await get("&section=all&length=1")).matchAll(/<section name="([^"]*)" length="(\d+)"/g)];
    const counts = {};
    for (const s of sections) {
      for (const m of (await get("&limit=500&section=" + encodeURIComponent(dec(s[1])))).matchAll(
        /<album\b[^>]*\sdate="(\d{4})"/g,
      )) {
        const d = m[1].slice(0, 3) + "0";
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    vars.e42Years = JSON.stringify(
      Object.keys(counts)
        .sort()
        .map((d) => [d, counts[d]]),
    );
    req.url = base + "&section=all&length=1&sort=decade";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-42-decade-index-usb.xml");
    console.log(
      body.length +
        " bytes: " +
        [...body.matchAll(/<section name="([^"]*)" length="(\d+)"/g)].map((m) => m[1] + "s " + m[2]).join(", "),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const idx = [...body.matchAll(/<section name="([^"]*)" length="(\d+)"/g)].map((m) => [m[1], +m[2]]);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("only the index, no albums", () => {
      expect(/<albums\b/.test(body)).to.equal(true);
      expect(/<album[\s>]/.test(body)).to.equal(false);
    });
    test("section names are decades (four digits ending in 0)", () =>
      idx.forEach((i) => expect(i[0]).to.match(/^\d{3}0$/)));
    test("decades and counts = the years of the A-Z sections", () =>
      expect(idx).to.deep.equal(JSON.parse(vars.e42Years)));
  },
});

request("E43 All albums and quality in one request", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Quality chips and years of the decade chips: section=all without length answers every A-Z section in one
    // answer. It must hold the same albums (order, attributes, favourites) as the requests per section, and as
    // many as the index counts (no cut-off in a large library). Library and USB. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const list = (s, ep) => "/library/v1/" + ep + "?service=" + encodeURIComponent(s);
    const index = async (s, ep, q) =>
      [...(await get(list(s, ep) + q + "&section=all&length=1")).matchAll(/<section name="([^"]*)"([^>]*)>/g)]
        .map((m) => ({ name: dec(m[1]), n: +((m[2].match(/\slength="(\d+)"/) || [])[1] || 0) }))
        .filter((x) => x.n);
    const albums = (x) => (x.match(/<album\b[\s\S]*?<\/album>/g) || []).map((a) => a.replace(/\s+/g, " "));
    const out = [];
    for (const s of [svc, vars.usbSvc].filter(Boolean)) {
      for (const f of ["", "&quality=hr", "&quality=cd", "&quality=mqa"]) {
        const idx = await index(s, "Albums", f),
          per = [];
        for (const x of idx)
          per.push(...albums(await get(list(s, "Albums") + f + "&limit=500&section=" + encodeURIComponent(x.name))));
        const all = albums(await get(list(s, "Albums") + f + "&section=all"));
        out.push({
          what: (s === svc ? "library" : "USB") + (f || " all"),
          albums: all.length,
          counted: idx.reduce((n, x) => n + x.n, 0),
          same: JSON.stringify(all) === JSON.stringify(per),
        });
      }
    }
    vars.e43 = JSON.stringify(out);
    // category, recent and composer are ignored with section=all: the answer is every album, without an error
    const ignored = [];
    for (const f of ["&category=FAVOURITES", "&recent=1", "&composer=no-such-composer"]) {
      ignored.push({
        f,
        albums: albums(await get(list(svc, "Albums") + f + "&section=all")).length,
        all: out[0].albums,
      });
    }
    vars.e43ignored = JSON.stringify(ignored);
    req.url = H + list(svc, "Albums") + "&quality=hr&section=all";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-43-albums-quality.xml");
    console.log(vars.e43);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e43);
    test("the library has albums", () => expect(r[0].albums).to.be.above(0));
    test("as many albums as the index counts", () => r.forEach((x) => expect(x.albums, x.what).to.equal(x.counted)));
    test("same albums as the requests per section", () => r.forEach((x) => expect(x.same, x.what).to.equal(true)));
    test("category, recent and composer are ignored", () =>
      JSON.parse(vars.e43ignored).forEach((x) => expect(x.albums, x.f).to.equal(x.all)));
  },
});

request("E44 Genre albums in one request", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Genre chips: genre= (as in the genre's browse key) + section=all answers the albums of the genre in one answer.
    // The app builds cover, play, queue and menu URLs of these albums by the pattern of libAlbum(): they must equal
    // the URLs of /Browse. Checked with the first genre and the first with an encoded character, library and USB. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const list = (s, ep) => "/library/v1/" + ep + "?service=" + encodeURIComponent(s);

    const formEnc = (v) =>
      encodeURIComponent(v)
        .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%20/g, "+");
    const items = (x, type) => (x.match(/<item\b[^>]*>/g) || []).filter((t) => attr(t, "type") === type);
    const browse = (key) => get("/Browse?withContextMenuItems=1&key=" + encodeURIComponent(key));
    const out = [];
    let shown = "";
    for (const s of [svc, vars.usbSvc].filter(Boolean)) {
      const genres = items(await browse(s + ":GG/Genres"), "genre").map((t) => attr(t, "browseKey"));
      for (const key of new Set([genres[0], genres.find((k) => /[?&]genre=[^&]*%/.test(k))].filter(Boolean))) {
        const par = key.match(/[?&](genre=[^&]*)/)[1],
          old = [];
        const menu = (await browse(key)).match(/<item\b[^>]*>/g) || [];
        const link = menu.find((t) => /bySection:Album/.test(attr(t, "browseKey")));
        for (const sec of items(await browse(attr(link, "browseKey")), "section").filter(
          (t) => attr(t, "text2") !== "0",
        )) {
          for (let k = attr(sec, "browseKey"); k;) {
            const x = await browse(k);
            const adds = (x.match(/<item\b[^>]*type="addAll-last"[^>]*>/g) || []).map((t) => attr(t, "actionURL"));
            items(x, "album").forEach((t, i) =>
              old.push(
                [
                  attr(t, "text"),
                  attr(t, "text2"),
                  attr(t, "image"),
                  attr(t, "browseKey"),
                  attr(t, "contextMenuKey"),
                  attr(t, "playURL"),
                  adds[i],
                ].join(" | "),
              ),
            );
            k = attr((x.match(/<[^>]*\snextKey="[^"]*"[^>]*>/) || [""])[0], "nextKey");
          }
        }
        const now = [
          ...(await get(list(s, "Albums") + "&" + par + "&section=all")).matchAll(
            /<album\b([^>]*)>\s*<title>([^<]*)<\/title>\s*<art>([^<]*)<\/art>/g,
          ),
        ].map((m) => {
          const t = dec(m[2]),
            a = dec(m[3]),
            q = "album=" + formEnc(t) + "&artist=" + formEnc(a),
            fav = /isFavourite="1"/.test(m[1]);
          return [
            t,
            a,
            "/Artwork?service=" + s + "&" + q,
            s + ":MG/LocalMusic-Album?" + q,
            s + ":CM/LocalMusic-Album?" + q + (fav ? "&isFavourite=1" : ""),
            "/Add?playnow=1&service=" + s + "&" + q,
            "/Add?" + q + "&playnow=-1&service=" + s + "&where=last",
          ].join(" | ");
        });
        const i = old.findIndex((v, n) => v !== now[n]);
        out.push({
          what: (s === svc ? "library " : "USB ") + par,
          albums: now.length,
          browse: old.length,
          differs: i < 0 ? "" : old[i] + " <> " + now[i],
        });
        shown = shown || par;
      }
    }
    if (!shown) {
      req.skip();
      return;
    }
    vars.e44 = JSON.stringify(out);
    req.url = H + list(svc, "Albums") + "&" + shown + "&section=all";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-44-genre-albums.xml");
    console.log(vars.e44);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e44);
    test("as many albums as /Browse", () => r.forEach((x) => expect(x.albums, x.what).to.equal(x.browse)));
    test("same order, favourite state and URLs as /Browse", () =>
      r.forEach((x) => expect(x.differs, x.what).to.equal("")));
  },
});

request("E45 MQA songs without MQA albums", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Player bug: albums whose songs all have quality mqaBrowse are in no quality list of /library/v1/Albums
    // (hr, cd, mqa, mqaBrowse), although the songs filter quality=mqa finds the songs. Skipped without such songs.
    // When this fails after a firmware update, the bug may be fixed. Files checked 2026-11-22: real MQA. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const list = (s, ep) => "/library/v1/" + ep + "?service=" + encodeURIComponent(s);
    const index = async (s, ep, q) =>
      [...(await get(list(s, ep) + q + "&section=all&length=1")).matchAll(/<section name="([^"]*)"([^>]*)>/g)]
        .map((m) => ({ name: dec(m[1]), n: +((m[2].match(/\slength="(\d+)"/) || [])[1] || 0) }))
        .filter((x) => x.n);
    const secs = await index(svc, "Songs", "&quality=mqa"),
      songs = secs.reduce((n, x) => n + x.n, 0);
    if (!songs) {
      req.skip();
      return;
    }
    const first = secs[0];
    const song = (await get(list(svc, "Songs") + "&quality=mqa&section=" + encodeURIComponent(first.name))).match(
      /<alb>([^<]*)<\/alb>/,
    );
    const album = song ? dec(song[1]) : "",
      found = [];
    for (const q of ["hr", "cd", "mqa", "mqaBrowse"]) {
      for (const m of (await get(list(svc, "Albums") + "&quality=" + q + "&section=all")).matchAll(
        /<title>([^<]*)<\/title>/g,
      ))
        if (dec(m[1]) === album) found.push(q);
    }
    vars.e45 = JSON.stringify({ songs, album, found });
    req.url = H + list(svc, "Albums") + "&quality=mqa&section=all";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-45-quality-mqa.xml");
    console.log(vars.e45);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e45);
    test("a song of the MQA songs filter", () => expect(r.album).to.not.equal(""));
    test("its album is in no quality list (player bug)", () => expect(r.found).to.deep.equal([]));
  },
});

request("E46 Album artists in one request", {
  url: `http://${env.host}:11000/library/v1/Artists`,
  async pre(req) {
    // /library/v1/Artists with section=all answers all album artists in one answer (not used by the app, see the
    // decision against an album artist search). Songs and Composers answer only the index with section=all, an
    // empty list without length. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const list = (s, ep) => "/library/v1/" + ep + "?service=" + encodeURIComponent(s);
    const index = async (s, ep, q) =>
      [...(await get(list(s, ep) + q + "&section=all&length=1")).matchAll(/<section name="([^"]*)"([^>]*)>/g)]
        .map((m) => ({ name: dec(m[1]), n: +((m[2].match(/\slength="(\d+)"/) || [])[1] || 0) }))
        .filter((x) => x.n);
    const arts = (x) => [...x.matchAll(/<art\b[^>]*>([^<]*)<\/art>/g)].map((m) => m[1]);
    const idx = await index(svc, "Artists", ""),
      per = [];
    for (const x of idx) per.push(...arts(await get(list(svc, "Artists") + "&section=" + encodeURIComponent(x.name))));
    const all = arts(await get(list(svc, "Artists") + "&section=all"));
    const other = {};
    for (const ep of ["Songs", "Composers"])
      other[ep] = {
        counted: (await index(svc, ep, "")).reduce((n, x) => n + x.n, 0),
        listed: ((await get(list(svc, ep) + "&section=all")).match(/<(song|composer)\b/g) || []).length,
      };
    vars.e46 = JSON.stringify({ artists: all.length, same: JSON.stringify(all) === JSON.stringify(per), other });
    req.url = H + list(svc, "Artists") + "&section=all";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-46-album-artists.xml");
    console.log(vars.e46);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e46);
    test("same artists as the requests per section", () => {
      expect(r.artists).to.be.above(0);
      expect(r.same).to.equal(true);
    });
    test("Songs and Composers list nothing with section=all", () =>
      Object.keys(r.other).forEach((ep) => expect(r.other[ep].listed, ep).to.equal(0)));
  },
});

request("E47 Album filter combinations", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Which filters of /library/v1/Albums combine without section (library): artist, category=FAVOURITES and recent=1
    // with genre or quality; expr with quality but not with genre; expr wins over artist, artist over category; recent
    // lists only the 1000 newest albums and filters within them; year, album artist, label, format and other tags are
    // ignored. Every expected list is built from the single filters.
    // The album artist with the most albums, a genre that holds some of its albums and the first favourite genre are
    // taken from the library. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const L = "/library/v1/Albums?service=" + encodeURIComponent(svc);
    const e = encodeURIComponent;
    // "title | album artist" of every album, for all answer forms (section, recent / category, artist)
    const keys = (x) => {
      const r = [
        ...x.matchAll(/<album\b[^>]*>\s*(?:<title>([^<]*)<\/title>|<alb>([^<]*)<\/alb>)\s*<art>([^<]*)<\/art>/g),
      ].map((m) => dec(m[1] ?? m[2]) + " | " + dec(m[3]));
      if (r.length) return r;
      const name = dec((x.match(/<artist name="([^"]*)"/) || [])[1] || "");
      return [...x.matchAll(/<album\b[^>]*>([^<]+)<\/album>/g)].map((m) => dec(m[1]) + " | " + name);
    };
    const set = async (p) => new Set(keys(await get(p)));
    const walk = async (p) => {
      const s = new Set();
      for (let n = 0; p && n < 60; n++) {
        const x = await get(p);
        keys(x).forEach((k) => s.add(k));
        const m = x.match(/<nextlink>([^<]*)<\/nextlink>/);
        p = m ? dec(m[1]) : "";
      }
      return s;
    };
    const and = (a, b) => new Set([...a].filter((k) => b.has(k)));
    const same = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

    const all = keys(await get(L + "&section=all"));
    const cnt = {};
    all.forEach((k) => {
      const a = k.split(" | ")[1];
      cnt[a] = (cnt[a] || 0) + 1;
    });
    const artist = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const byArtist = await set(L + "&artist=" + e(artist));
    const genres = [...(await get("/library/v1/Genres?service=" + e(svc))).matchAll(/<genre>([^<]*)<\/genre>/g)].map(
      (m) => dec(m[1]),
    );
    const gset = {};
    const genreSet = async (g) => (gset[g] = gset[g] || (await set(L + "&genre=" + e(g) + "&section=all")));
    let genre = "";
    for (const g of genres) {
      const i = and(byArtist, await genreSet(g));
      if (i.size && i.size < byArtist.size) {
        genre = g;
        break;
      }
    }
    const r = { artist, albums: byArtist.size, genre };
    if (genre) {
      const g = await genreSet(genre);
      r.artistGenre = same(await set(L + "&artist=" + e(artist) + "&genre=" + e(genre)), and(byArtist, g));
      const cd = await set(L + "&quality=cd&section=all");
      r.artistQuality = same(await set(L + "&artist=" + e(artist) + "&quality=cd"), and(byArtist, cd));
      r.alone = (await set(L + "&genre=" + e(genre))).size + (await set(L + "&quality=cd")).size;
      const fav = await set(L + "&category=FAVOURITES");
      r.favArtist = same(await set(L + "&category=FAVOURITES&artist=" + e(artist)), byArtist);
      let fg = "";
      for (const x of genres)
        if (fav.size && and(fav, await genreSet(x)).size) {
          fg = x;
          break;
        }
      r.favGenre = fg ? same(await set(L + "&category=FAVOURITES&genre=" + e(fg)), and(fav, await genreSet(fg))) : null;
      const newest = await walk(L + "&recent=1");
      r.newest = newest.size;
      r.recentGenre = same(await walk(L + "&recent=1&genre=" + e(genre)), and(newest, g));
      const other = all.find((k) => k.split(" | ")[1] !== artist && /[A-Za-z]{4,}/.test(k.split(" | ")[0]));
      const term = other.split(" | ")[0].match(/[A-Za-z]{4,}/)[0];
      const byExpr = await set(L + "&expr=" + e(term));
      r.term = term;
      r.exprWins = same(await set(L + "&artist=" + e(artist) + "&expr=" + e(term)), byExpr);
      r.exprQuality = same(await set(L + "&expr=" + e(term) + "&quality=cd"), and(byExpr, cd));
      r.exprGenre = (await set(L + "&expr=" + e(term) + "&genre=" + e(genre))).size;
      // other tags give no filter: the albums of the artist stay the same
      const title = [...byArtist][0].split(" | ")[0];
      const tags = {
        year: "2000",
        date: "2000",
        decade: "1990",
        albumartist: artist,
        label: "EMI",
        conductor: "Karajan",
        performer: "Karajan",
        discno: "2",
        format: "flac",
        codec: "flac",
        atype: "flc",
        samplerate: "96000",
        samplebits: "24",
        channels: "2",
        mood: "Happy",
        rating: "5",
        comment: "test",
        title,
      };
      r.filtersTag = [];
      for (const [k, v] of Object.entries(tags))
        if (!same(await set(L + "&artist=" + e(artist) + "&" + k + "=" + e(v)), byArtist)) r.filtersTag.push(k);
    }
    vars.e47 = JSON.stringify(r);
    req.url = H + L + "&artist=" + e(artist) + (genre ? "&genre=" + e(genre) : "");
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-47-album-filter-combinations.xml");
    console.log(vars.e47);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e47);
    test("a genre with some albums of the artist", () => expect(r.genre).to.not.equal(""));
    test("artist + genre = albums of the artist in the genre", () => expect(r.artistGenre).to.equal(true));
    test("artist + quality = albums of the artist in the quality", () => expect(r.artistQuality).to.equal(true));
    test("genre or quality alone answer empty", () => expect(r.alone).to.equal(0));
    test("category=FAVOURITES + genre = favourites in the genre", () => {
      if (r.favGenre !== null) expect(r.favGenre).to.equal(true);
    });
    test("artist wins over category=FAVOURITES", () => expect(r.favArtist).to.equal(true));
    test("recent=1 lists at most 1000 albums", () => expect(r.newest).to.be.within(1, 1000));
    test("recent=1 + genre = newest albums in the genre", () => expect(r.recentGenre).to.equal(true));
    test("expr wins over artist", () => expect(r.exprWins).to.equal(true));
    test("expr + quality = hits in the quality", () => expect(r.exprQuality).to.equal(true));
    test("expr + genre answers empty", () => expect(r.exprGenre).to.equal(0));
    test("year, album artist, label, format and other tags are ignored", () =>
      expect(r.filtersTag.join(", ")).to.equal(""));
  },
});

request("E48 Song and artist filter combinations", {
  url: `http://${env.host}:11000/library/v1/Songs`,
  async pre(req) {
    // Filters of /library/v1/Songs, /library/v1/Artists and /library/v1/Composers (library): artist matches the album
    // artist or the track artist exactly and combines with genre and quality; composer wins over artist and combines
    // with quality; expr finds song titles only and combines with quality; Artists takes expr (track artists) and genre
    // with section=all; Composers ignores artist. Uses the artist and genre of E47 (run it first). Read only.
    const svc = vars.libSvc;
    const e47 = JSON.parse(vars.e47 || "{}");
    if (!svc || !e47.genre) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const e = encodeURIComponent;
    const q = "?service=" + e(svc);
    const S = "/library/v1/Songs" + q;
    const field = (x, t) => dec((x.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "");
    const songs = async (p) =>
      [...(await get(p)).matchAll(/<song\b[^>]*>([\s\S]*?)<\/song>/g)].map((m) => ({
        fn: field(m[1], "fn"),
        title: field(m[1], "title"),
        art: field(m[1], "art"),
        alb: field(m[1], "alb"),
        albumartist: field(m[1], "albumartist"),
        quality: field(m[1], "quality"),
      }));
    const fns = (l) => new Set(l.map((s) => s.fn));
    const subset = (a, b) => {
      const s = fns(b);
      return a.every((x) => s.has(x.fn));
    };
    const same = (a, b) => a.length === b.length && subset(a, b);
    const words = (v) =>
      v
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/);
    const atStart = (v, t) => words(v).some((w) => w.startsWith(t.toLowerCase()));
    const { artist, genre } = e47;
    const r = { artist, genre };

    const byArtist = await songs(S + "&artist=" + e(artist));
    r.songs = byArtist.length;
    r.artistMatch = byArtist.every((s) => s.art === artist || s.albumartist === artist);
    const track = byArtist.find((s) => s.art !== artist && s.albumartist === artist);
    if (track) {
      const t = await songs(S + "&artist=" + e(track.art));
      r.trackArtist = track.art;
      r.trackArtistFound = t.length > 0 && t.every((s) => s.art === track.art || s.albumartist === track.art);
    }
    const genreAlbums = new Set(
      [
        ...(await get("/library/v1/Albums" + q + "&genre=" + e(genre) + "&section=all")).matchAll(
          /<title>([^<]*)<\/title>\s*<art>([^<]*)<\/art>/g,
        ),
      ].map((m) => dec(m[1]) + " | " + dec(m[2])),
    );
    const ag = await songs(S + "&artist=" + e(artist) + "&genre=" + e(genre));
    r.artistGenre =
      ag.length > 0 &&
      ag.length < byArtist.length &&
      subset(ag, byArtist) &&
      ag.every((s) => genreAlbums.has(s.alb + " | " + s.albumartist));
    const aq = await songs(S + "&artist=" + e(artist) + "&quality=cd");
    r.artistQuality =
      aq.length > 0 &&
      subset(aq, byArtist) &&
      aq.every((s) => s.quality === "cd") &&
      aq.length === byArtist.filter((s) => s.quality === "cd").length;
    const composer = dec(
      ((await get("/library/v1/Composers" + q)).match(/<composer>([^<]*)<\/composer>/) || [])[1] || "",
    );
    const byComposer = await songs(S + "&composer=" + e(composer));
    r.composer = composer;
    r.composerWins =
      byComposer.length > 0 && same(await songs(S + "&composer=" + e(composer) + "&artist=" + e(artist)), byComposer);
    const cq = await songs(S + "&composer=" + e(composer) + "&quality=cd");
    r.composerQuality =
      cq.every((s) => s.quality === "cd") && cq.length === byComposer.filter((s) => s.quality === "cd").length;
    const term = byArtist.map((s) => (s.title.match(/[A-Za-z]{4,}/) || [])[0]).find(Boolean) || "love";
    const byExpr = await songs(S + "&expr=" + e(term));
    r.term = term;
    r.exprTitles = byExpr.length > 0 && byExpr.every((s) => atStart(s.title, term));
    r.exprArtistName = (await songs(S + "&expr=" + e(words(artist).find((w) => w.length > 3) || artist))).filter(
      (s) => !atStart(s.title, words(artist).find((w) => w.length > 3) || artist),
    ).length;
    r.filtersTag = [];
    for (const [k, v] of Object.entries({
      year: "2000",
      date: "2000",
      albumartist: artist,
      discno: "2",
      atype: "flc",
      samplerate: "96000",
      title: term,
    }))
      if (!same(await songs(S + "&artist=" + e(artist) + "&" + k + "=" + e(v)), byArtist)) r.filtersTag.push(k);
    r.alone = (await songs(S + "&genre=" + e(genre))).length + (await songs(S + "&quality=cd")).length;
    const eq = await songs(S + "&expr=" + e(term) + "&quality=cd");
    r.exprQuality = eq.every((s) => s.quality === "cd" && atStart(s.title, term));
    const arts = (x) => [...x.matchAll(/<art\b[^>]*>([^<]*)<\/art>/g)].map((m) => dec(m[1]));
    const word = words(artist).find((w) => w.length > 3) || artist;
    const ae = arts(await get("/library/v1/Artists" + q + "&expr=" + e(word)));
    r.artistsExpr = ae.length > 0 && ae.every((a) => atStart(a, word));
    const allArtists = arts(await get("/library/v1/Artists" + q + "&section=all"));
    const ga = arts(await get("/library/v1/Artists" + q + "&section=all&genre=" + e(genre)));
    r.artistsGenre = ga.length > 0 && ga.length < allArtists.length && ga.every((a) => allArtists.includes(a));
    const comp = (x) => [...x.matchAll(/<composer>([^<]*)<\/composer>/g)].map((m) => m[1]).join("|");
    r.composersIgnoreArtist =
      comp(await get("/library/v1/Composers" + q + "&artist=" + e(artist))) ===
      comp(await get("/library/v1/Composers" + q));
    vars.e48 = JSON.stringify(r);
    req.url = H + S + "&artist=" + e(artist) + "&genre=" + e(genre);
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-48-song-filter-combinations.xml");
    console.log(vars.e48);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e48);
    test("artist = album artist or track artist", () => {
      expect(r.songs).to.be.above(0);
      expect(r.artistMatch).to.equal(true);
    });
    test("artist finds a track artist that is no album artist", () => {
      if (r.trackArtist) expect(r.trackArtistFound).to.equal(true);
    });
    test("artist + genre = songs of the artist on albums of the genre", () => expect(r.artistGenre).to.equal(true));
    test("artist + quality = songs of the artist in the quality", () => expect(r.artistQuality).to.equal(true));
    test("genre or quality alone answer empty", () => expect(r.alone).to.equal(0));
    test("year, album artist, disc, format and title are ignored", () => expect(r.filtersTag.join(", ")).to.equal(""));
    test("composer wins over artist", () => expect(r.composerWins).to.equal(true));
    test("composer + quality = songs of the composer in the quality", () => expect(r.composerQuality).to.equal(true));
    test("expr finds song titles only", () => {
      expect(r.exprTitles).to.equal(true);
      expect(r.exprArtistName).to.equal(0);
    });
    test("expr + quality = hits in the quality", () => expect(r.exprQuality).to.equal(true));
    test("Artists: expr finds artist names", () => expect(r.artistsExpr).to.equal(true));
    test("Artists: genre filters with section=all", () => expect(r.artistsGenre).to.equal(true));
    test("Composers ignore artist", () => expect(r.composersIgnoreArtist).to.equal(true));
  },
});

request("E49 Search with quality and genre filters", {
  url: `http://${env.host}:11000/library/v1/Search`,
  async pre(req) {
    // Parameters of /library/v1/Search found by ffuf: quality and genre filter the songs, albums and artists of the
    // search (albums: only those of the quality / genre lists of /library/v1/Albums), hr answers the same as hd, an
    // unknown quality answers nothing; listindex is only echoed as start / end (no paging, at most 25 per list).
    // The album check searches the first word of the first hi-res album title. Uses libSvc of A01. Read only.
    const svc = vars.libSvc;
    if (!svc) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const dec = (v) =>
      v
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
    const e = encodeURIComponent;
    const S = "/library/v1/Search?service=" + e(svc) + "&expr=";
    const list = (x, tag) => (x.match(new RegExp("<" + tag + "s\\b[^>]*>([\\s\\S]*?)</" + tag + "s>")) || [])[1] || "";
    const parse = (x) => ({
      root: (x.match(/<search\b[^>]*>/) || [""])[0],
      songs: [...list(x, "song").matchAll(/<song>([\s\S]*?)<\/song>/g)].map((m) => ({
        fn: dec((m[1].match(/<fn>([^<]*)/) || [])[1] || ""),
        quality: (m[1].match(/<quality>([^<]*)/) || [])[1] || "",
      })),
      artists: (list(x, "artist").match(/<artist>/g) || []).length,
      albums: [...list(x, "album").matchAll(/<title>([^<]*)<\/title>\s*<art>([^<]*)<\/art>/g)].map(
        (m) => dec(m[1]) + " | " + dec(m[2]),
      ),
    });
    const albumsOf = async (f) =>
      new Set(
        [
          ...(await get("/library/v1/Albums?service=" + e(svc) + "&section=all&" + f)).matchAll(
            /<title>([^<]*)<\/title>\s*<art>([^<]*)<\/art>/g,
          ),
        ].map((m) => dec(m[1]) + " | " + dec(m[2])),
      );
    // Titles only: the search shows another artist for some albums than the album list (track vs album artist)
    const within = (l, set) => {
      const t = new Set([...set].map((a) => a.split(" | ")[0]));
      return l.every((a) => t.has(a.split(" | ")[0]));
    };
    const words = ["love", "night", "time", "you"];
    let term = "",
      base;
    for (const w of words) {
      base = parse(await get(S + w));
      if (base.songs.length >= 5) {
        term = w;
        break;
      }
    }
    if (!term) {
      req.skip();
      return;
    }
    const r = { term, base: { songs: base.songs.length, artists: base.artists, albums: base.albums.length } };
    const q = {};
    for (const v of ["hr", "hd", "cd", "xyz"]) q[v] = parse(await get(S + term + "&quality=" + v));
    r.hr = q.hr.songs.length;
    const lists = (x) => JSON.stringify([x.songs, x.albums, x.artists]);
    r.hrSameAsHd = lists(q.hr) === lists(q.hd);
    r.hrQualities = [...new Set(q.hr.songs.map((s) => s.quality))];
    r.cdQualities = [...new Set(q.cd.songs.map((s) => s.quality))];
    r.unknown = q.xyz.songs.length + q.xyz.artists + q.xyz.albums.length;
    // Albums: search a word of a hi-res album title with and without quality=hr
    const hrSet = await albumsOf("quality=hr");
    const word = ([...hrSet][0] || "").split(" | ")[0].match(/[A-Za-z]{4,}/)?.[0];
    if (word) {
      const all = parse(await get(S + e(word))).albums,
        hr = parse(await get(S + e(word) + "&quality=hr")).albums;
      r.albumWord = word;
      r.albumsAll = all.length;
      r.albumsHr = hr.length;
      r.albumsHrInQualityList = hr.length > 0 && within(hr, hrSet);
    }
    const genres = [...(await get("/library/v1/Genres?service=" + e(svc))).matchAll(/<genre>([^<]*)<\/genre>/g)].map(
      (m) => dec(m[1]),
    );
    for (const g of genres.slice(0, 20)) {
      const x = parse(await get(S + term + "&genre=" + e(g)));
      if (x.songs.length > 0 && (x.songs.length < base.songs.length || x.artists < base.artists)) {
        r.genre = g;
        r.genreSongs = x.songs.length;
        r.genreArtists = x.artists;
        r.genreAlbums = x.albums.length;
        r.genreAlbumsInGenreList = within(x.albums, await albumsOf("genre=" + e(g)));
        break;
      }
    }
    const p = parse(await get(S + term + "&listindex=25"));
    r.listindexRoot = p.root;
    r.listindexSameSongs = JSON.stringify(p.songs) === JSON.stringify(base.songs);
    vars.e49 = JSON.stringify(r);
    req.url = H + S + e(term) + "&quality=hr";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("explore-49-search-filters.xml");
    console.log(vars.e49);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const r = JSON.parse(vars.e49);
    test("quality=hr: only hi-res songs (quality hd), the same as quality=hd", () => {
      expect(r.hrSameAsHd).to.equal(true);
      if (r.hr) expect(r.hrQualities).to.deep.equal(["hd"]);
    });
    test("quality=cd: only CD songs", () => expect(r.cdQualities.every((x) => x === "cd")).to.equal(true));
    test("quality=hr: only albums of the hi-res album list", () => {
      expect(r.albumWord).to.be.a("string");
      expect(r.albumsHrInQualityList).to.equal(true);
    });
    test("unknown quality: no songs, albums or artists", () => expect(r.unknown).to.equal(0));
    test("genre filters songs or artists, only albums of the genre", () => {
      expect(r.genre).to.be.a("string");
      expect(r.genreAlbumsInGenreList).to.equal(true);
    });
    test("listindex is only echoed (start / end), same songs", () => {
      expect(/\bstart="25"/.test(r.listindexRoot)).to.equal(true);
      expect(r.listindexSameSongs).to.equal(true);
    });
  },
});
