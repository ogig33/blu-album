// 1 Read (safe): 30 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("A01 Top menu", {
  url: `http://${env.host}:11000/Browse?withContextMenuItems=1`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("01-top-menu.xml");

    // Remember the source keys for the following requests
    const link = items("link");
    const lib = link.find((t) => /LibraryIcon/.test(attr(t, "image")));
    const usb = link.find((t) => /USBIcon/.test(attr(t, "image")));
    const pl = link.find((t) => /myplaylists/i.test(attr(t, "image")));
    vars.libKey = lib ? attr(lib, "browseKey") : "";
    vars.usbKey = usb ? attr(usb, "browseKey") : "";
    vars.libSvc = lib ? attr(lib, "browseKey").split(":")[0] : "";
    vars.usbSvc = usb ? attr(usb, "browseKey").split(":")[0] : "";
    vars.playlistsKey = pl ? attr(pl, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("has a library or USB source", () => {
      expect(items("link").some((t) => /LibraryIcon|USBIcon/.test(attr(t, "image")))).to.equal(true);
    });
    test("has the saved playlists entry (icon ci_myplaylists)", () => {
      expect(items("link").some((t) => /myplaylists/i.test(attr(t, "image")))).to.equal(true);
    });
  },
});

request("A02 Library menu", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libKey;
    if (!key) {
      // Source not available (e.g. no USB drive connected)
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("02-library-menu.xml");

    const top = tags("browse")[0] || "";
    const genres = items().find((t) => /GG\/Genres/.test(attr(t, "browseKey")));
    const albums = items().find((t) => /bySection:Album/.test(attr(t, "browseKey")));
    vars.libSearchKey = attr(top, "searchKey");
    vars.libGenresKey = genres ? attr(genres, "browseKey") : "";
    vars.libAlbumsKey = albums ? attr(albums, "browseKey") : "";
    // Library playlists (A29): the link "Playlists" of the library menu
    const pls = items().find((t) => /:Playlist\//.test(attr(t, "browseKey")));
    vars.libPlaylistsKey = pls ? attr(pls, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("has a searchKey", () => expect(attr(tags("browse")[0] || "", "searchKey")).to.not.equal(""));
    test("has a Genres entry (key contains GG/Genres)", () =>
      expect(items().some((t) => /GG\/Genres/.test(attr(t, "browseKey")))).to.equal(true));
    test("has an albums entry (key contains bySection:Album)", () =>
      expect(items().some((t) => /bySection:Album/.test(attr(t, "browseKey")))).to.equal(true));
    test("has stats entries for Artist, Song, Composer", () => {
      ["Artist", "Song", "Composer"].forEach((k) =>
        expect(
          items().some((t) => new RegExp("bySection:" + k).test(attr(t, "browseKey"))),
          k,
        ).to.equal(true),
      );
    });
  },
});

request("A03 USB menu", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.usbKey;
    if (!key) {
      // Source not available (e.g. no USB drive connected)
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("03-usb-menu.xml");

    const top = tags("browse")[0] || "";
    const genres = items().find((t) => /GG\/Genres/.test(attr(t, "browseKey")));
    const albums = items().find((t) => /bySection:Album/.test(attr(t, "browseKey")));
    vars.usbSearchKey = attr(top, "searchKey");
    vars.usbGenresKey = genres ? attr(genres, "browseKey") : "";
    vars.usbAlbumsKey = albums ? attr(albums, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("has a searchKey", () => expect(attr(tags("browse")[0] || "", "searchKey")).to.not.equal(""));
    test("has a Genres entry (key contains GG/Genres)", () =>
      expect(items().some((t) => /GG\/Genres/.test(attr(t, "browseKey")))).to.equal(true));
    test("has an albums entry (key contains bySection:Album)", () =>
      expect(items().some((t) => /bySection:Album/.test(attr(t, "browseKey")))).to.equal(true));
    test("has stats entries for Artist, Song, Composer", () => {
      ["Artist", "Song", "Composer"].forEach((k) =>
        expect(
          items().some((t) => new RegExp("bySection:" + k).test(attr(t, "browseKey"))),
          k,
        ).to.equal(true),
      );
    });
  },
});

request("A04 Genres", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libGenresKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("04-genres.xml");

    const g = items("genre")[0];
    vars.genreKey = g ? attr(g, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("lists genres (type=genre) with text and browseKey", () => {
      const g = items("genre");
      expect(g.length).to.be.above(0);
      g.forEach((t) => {
        expect(attr(t, "text")).to.not.equal("");
        expect(attr(t, "browseKey")).to.not.equal("");
      });
    });
  },
});

request("A05 Genre menu", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.genreKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("05-genre-menu.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("genre menu has entries", () => expect(items().length).to.be.above(0));
  },
});

request("A06 Album sections", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libAlbumsKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("06-album-sections.xml");

    const s = items("section").find((t) => attr(t, "text2") !== "0");
    vars.sectionKey = s ? attr(s, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("A-Z sections with counts (text2)", () => {
      const s = items("section");
      expect(s.length).to.be.above(0);
      s.forEach((t) => expect(attr(t, "text2")).to.match(/^\d+$/));
    });
  },
});

request("A07 Albums of a section", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.sectionKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("07-albums-section.xml");

    const a = items("album")[0];
    vars.albumKey = a ? attr(a, "browseKey") : "";
    vars.albumPlay = a ? attr(a, "playURL") : "";
    const addLast = (body.split(a || "#none#")[1] || "").match(/actionURL="([^"]*)"[^>]*type="addAll-last"/);
    vars.albumAddLast = addLast ? dec(addLast[1]) : "";
    vars.albumCm = a ? attr(a, "contextMenuKey") : "";
    vars.albumImage = a ? attr(a, "image") : "";
    vars.albumTitle = a ? attr(a, "text") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("albums have text, text2, image, browseKey, playURL, contextMenuKey", () => {
      const a = items("album");
      expect(a.length).to.be.above(0);
      a.forEach((t) =>
        ["text", "text2", "image", "browseKey", "playURL", "contextMenuKey"].forEach((n) =>
          expect(attr(t, n), n + " of " + attr(t, "text")).to.not.equal(""),
        ),
      );
    });
    test("inline context menu offers addAll-last", () => expect(/type="addAll-last"/.test(body)).to.equal(true));
  },
});

request("A08 Album tracks", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.albumKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("08-album-tracks.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("album has tracks (type=track) with text, playURL and duration", () => {
      const t = items("track");
      expect(t.length).to.be.above(0);
      t.forEach((x) => ["text", "playURL", "duration"].forEach((n) => expect(attr(x, n), n).to.not.equal("")));
    });
  },
});

request("A09 Album context menu", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.albumCm;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("09-album-context-menu.xml");

    const f = items().find((t) => /^favourite-(add|delete)$/.test(attr(t, "type")));
    vars.favUrl = f ? attr(f, "actionURL") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("type=contextMenu", () => expect(attr(tags("browse")[0] || "", "type")).to.equal("contextMenu"));
    test("offers add-now and addAll-last", () => {
      ["add-now", "addAll-last"].forEach((k) => expect(items(k).length, k).to.be.above(0));
    });
    test("library album offers favourite-add or favourite-delete", () => {
      expect(items().some((t) => /^favourite-(add|delete)$/.test(attr(t, "type")))).to.equal(true);
    });
  },
});

request("A10 Artwork", {
  url: `http://${env.host}:11000/Artwork`,
  async pre(req) {
    const img = vars.albumImage;
    if (!img) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + img + "&followRedirects=1";
  },
  async post() {},
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("returns an image", () => expect(String(res.header("content-type"))).to.match(/^image\//));
  },
});

request("A11 Library New", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const svc = vars.libSvc;
    if (!svc) {
      // Source not available
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc) + "&recent=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("11-library-new.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<albums> with <album> elements containing <alb> and <art>", () => {
      expect(tags("albums").length).to.equal(1);
      const n = (body.match(/<album\b/g) || []).length;
      expect(n).to.be.above(0);
      expect((body.match(/<alb>/g) || []).length).to.equal(n);
      expect((body.match(/<art>/g) || []).length).to.equal(n);
    });

    test("paging via <nextlink> when more than one page", () => {
      const n = (body.match(/<album\b/g) || []).length;
      if (n >= 50) expect(/<nextlink>/.test(body)).to.equal(true);
    });
  },
});

request("A12 Library Favourites", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const svc = vars.libSvc;
    if (!svc) {
      // Source not available
      req.skip();
      return;
    }
    req.url =
      "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc) + "&category=FAVOURITES";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("12-library-favourites.xml");

    // Title and artist of the first favourite, for E17 / E18 (lists that surely contain a favourite)
    const first = (body.match(/<album\b[^>]*>[\s\S]*?<\/album>/) || [""])[0];
    vars.favAlbum = dec((first.match(/<alb>([^<]*)<\/alb>/) || [])[1] || "");
    vars.favArtist = dec((first.match(/<art>([^<]*)<\/art>/) || [])[1] || "");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("every album is flagged isFavourite=1", () => {
      const a = tags("album");
      a.forEach((t) => expect(attr(t, "isFavourite")).to.equal("1"));
    });
  },
});

request("A13 Library Quality CD", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const svc = vars.libSvc;
    if (!svc) {
      // Source not available
      req.skip();
      return;
    }
    req.url =
      "http://" +
      env.host +
      ":11000/library/v1/Albums?service=" +
      encodeURIComponent(svc) +
      "&quality=cd&limit=500&section=A";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("13-library-quality-cd-A.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("sectioned answer: <albums><sections> (may be empty for this letter)", () => {
      expect(tags("albums").length).to.equal(1);
      expect(/<sections\b/.test(body)).to.equal(true);
    });
    test("albums (if any) have tracks attribute, <title> and <art>", () => {
      const a = tags("album");
      a.forEach((t) => expect(attr(t, "tracks")).to.match(/^\d+$/));
      expect((body.match(/<title>/g) || []).length).to.equal(a.length);
      expect((body.match(/<art>/g) || []).length).to.equal(a.length);
    });
  },
});

request("A14 USB New", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const svc = vars.usbSvc;
    if (!svc) {
      // Source not available
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/library/v1/Albums?service=" + encodeURIComponent(svc) + "&recent=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("14-usb-new.xml");

    // first album, for "26 USB album songs"
    const a = (body.match(/<album\b[\s\S]*?<\/album>/) || [""])[0];
    const tx = (t) => dec((a.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "");
    vars.usbNewAlb = tx("alb");
    vars.usbNewArt = tx("art");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<albums> with <album> elements containing <alb> and <art>", () => {
      expect(tags("albums").length).to.equal(1);
      const n = (body.match(/<album\b/g) || []).length;
      expect(n).to.be.above(0);
      expect((body.match(/<alb>/g) || []).length).to.equal(n);
      expect((body.match(/<art>/g) || []).length).to.equal(n);
    });
  },
});

request("A15 USB Quality CD", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    const svc = vars.usbSvc;
    if (!svc) {
      // Source not available
      req.skip();
      return;
    }
    req.url =
      "http://" +
      env.host +
      ":11000/library/v1/Albums?service=" +
      encodeURIComponent(svc) +
      "&quality=cd&limit=500&section=A";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("15-usb-quality-cd-A.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("sectioned answer: <albums><sections> (may be empty for this letter)", () => {
      expect(tags("albums").length).to.equal(1);
      expect(/<sections\b/.test(body)).to.equal(true);
    });
    test("albums (if any) have tracks attribute, <title> and <art>", () => {
      const a = tags("album");
      a.forEach((t) => expect(attr(t, "tracks")).to.match(/^\d+$/));
      expect((body.match(/<title>/g) || []).length).to.equal(a.length);
      expect((body.match(/<art>/g) || []).length).to.equal(a.length);
    });
  },
});

request("A16 Saved playlists", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.playlistsKey;
    if (!key) {
      // Needed key not found by an earlier request
      req.skip();
      return;
    }
    // Same request as the app: with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("16-saved-playlists.xml");
    // Track list of the first playlist (A28)
    const first = items("playlist")[0];
    vars.playlistKey = first ? attr(first, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("playlists have text and a play URL (playURL or a play action)", () => {
      const p = items().filter((t) => attr(t, "type") !== "link");
      p.forEach((t) => expect(attr(t, "text")).to.not.equal(""));
      expect(p.every((t) => attr(t, "playURL") !== "" || /actionURL/.test(body))).to.equal(true);
    });
  },
});

request("A17 Playlists names", {
  url: `http://${env.host}:11000/Playlists`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("17-playlists.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<playlists> with <name> elements (the name may carry an image attribute)", () =>
      expect(tags("playlists").length).to.equal(1));
  },
});

request("A18 Search", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libSearchKey;
    if (!key) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&q=a&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("18-search.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("search returns entries", () => expect(items().length).to.be.above(0));
  },
});

request("A19 Status", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("19-status.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("has etag, state and volume", () => {
      expect(attr(tags("status")[0] || "", "etag")).to.not.equal("");
      expect(/<state>/.test(body)).to.equal(true);
      expect(/<volume>/.test(body)).to.equal(true);
    });
    // Inputs (HDMI ARC, optical, Bluetooth: <inputId>, serviceType AudioInputs) have only title1, no title2 / streamFormat
    const isInput = /<inputId>/.test(body);
    test("when playing: title1-2, service, serviceType, streamFormat, secs", () => {
      if (!/<state>(play|stream)<\/state>/.test(body) || isInput) return;
      ["title1", "title2", "service", "serviceType", "streamFormat", "secs"].forEach((k) =>
        expect(new RegExp("<" + k + ">").test(body), k).to.equal(true),
      );
    });
    test("when playing an input: title1, service Capture, serviceType AudioInputs, secs", () => {
      if (!/<state>(play|stream)<\/state>/.test(body) || !isInput) return;
      ["title1", "secs"].forEach((k) => expect(new RegExp("<" + k + ">").test(body), k).to.equal(true));
      expect(body).to.match(/<service>Capture<\/service>/);
      expect(body).to.match(/<serviceType>AudioInputs<\/serviceType>/);
    });
    // Radio streams (with <streamUrl>) may lack title3 (e.g. Radio Paradise); queue playback has all three and totlen
    test("when playing from the queue: title3 and totlen", () => {
      if (!/<state>(play|stream)<\/state>/.test(body) || /<streamUrl>/.test(body)) return;
      ["title3", "totlen"].forEach((k) => expect(new RegExp("<" + k + ">").test(body), k).to.equal(true));
    });
  },
});

request("A20 Queue", {
  url: `http://${env.host}:11000/Playlist?start=0&end=19`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("20-queue.xml");

    vars.queueLength = attr(tags("playlist")[0] || "", "length") || "0";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<playlist> with length attribute", () => expect(attr(tags("playlist")[0] || "", "length")).to.match(/^\d+$/));
    test("songs have title, art, alb (and time)", () => {
      tags("song").length &&
        ["title", "art", "alb"].forEach((k) => expect(new RegExp("<" + k + ">").test(body), k).to.equal(true));
    });
  },
});

request("A21 Settings", {
  url: `http://${env.host}:11000/Settings`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("21-settings.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("has zonename (room name)", () => expect(/id="zonename"/.test(body)).to.equal(true));
  },
});

request("A22 Volume", {
  url: `http://${env.host}:11000/Volume`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("22-volume.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<volume> with db attribute", () => expect(/<volume\b[^>]*db=/.test(body)).to.equal(true));
  },
});

request("A23 API version", {
  url: `http://${env.host}:11000/Version`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("23-api-version.xml");

    const v = (body.match(/<version>([^<]*)<\/version>/) || [])[1] || "";
    vars.apiVersion = v;
    console.log("BluOS API version: " + v);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<version> like v0.5.43", () =>
      expect((body.match(/<version>([^<]*)<\/version>/) || [])[1]).to.match(/^v?\d+(\.\d+)+$/));
  },
});

request("A24 BluOS version", {
  url: `http://${env.host}:11000/GitVersion`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("24-bluos-version.xml");

    const v = (body.match(/<version>([^<]*)<\/version>/) || [])[1] || "";
    vars.bluosVersion = v;
    console.log("BluOS version: " + v);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<version> like 4.18.18", () =>
      expect((body.match(/<version>([^<]*)<\/version>/) || [])[1]).to.match(/^\d+(\.\d+)+$/));
  },
});

request("A25 Album songs", {
  url: `http://${env.host}:11000/library/v1/Songs`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const key = vars.albumKey || "";
    if (!key) {
      req.skip();
      return;
    }
    req.url = H + "/library/v1/Songs?service=" + key.split(":")[0] + "&" + (key.split("?")[1] || "");
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("25-album-songs.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const songs = body.match(/<song\b[\s\S]*?<\/song>/g) || [];
    test("album has songs", () => expect(songs.length).to.be.above(0));
    test("songs have title, art, date, quality", () =>
      songs.forEach((x) =>
        ["title", "art", "date", "quality"].forEach((t) =>
          expect(new RegExp("<" + t + ">[^<]+</" + t + ">").test(x), t).to.equal(true),
        ),
      ));
    test("songs have atype, samplerate, bitrate, channels", () =>
      songs.forEach((x) =>
        ["atype", "samplerate", "bitrate", "channels"].forEach((n) => expect(attr(x, n), n).to.not.equal("")),
      ));
  },
});

request("A26 USB album songs", {
  url: `http://${env.host}:11000/library/v1/Songs`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const svc = vars.usbSvc;
    if (!svc) {
      req.skip();
      return;
    }

    // first album of the USB "New" list (Read 14)
    const alb = vars.usbNewAlb,
      art = vars.usbNewArt;
    if (!alb) {
      req.skip();
      return;
    }
    const enc = (v) => encodeURIComponent(v).replace(/%20/g, "+");
    req.url = H + "/library/v1/Songs?service=" + svc + "&album=" + enc(alb) + "&artist=" + enc(art);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("26-usb-album-songs.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const songs = body.match(/<song\b[\s\S]*?<\/song>/g) || [];
    test("album has songs", () => expect(songs.length).to.be.above(0));
    test("songs have title, art, date, quality", () =>
      songs.forEach((x) =>
        ["title", "art", "date", "quality"].forEach((t) =>
          expect(new RegExp("<" + t + ">[^<]+</" + t + ">").test(x), t).to.equal(true),
        ),
      ));
    test("songs have atype, samplerate, bitrate, channels", () =>
      songs.forEach((x) =>
        ["atype", "samplerate", "bitrate", "channels"].forEach((n) => expect(attr(x, n), n).to.not.equal("")),
      ));
  },
});

request("A27 Listening mode", {
  url: `http://${env.host}:11000/audioPreset`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    // App: listening mode tag in the footer (read on connect and when syncStat of /Status changes).
    // /ui/Configuration lists it as listeningModesURL="/audioPreset" of /ui/presets.
    req.url = H + "/audioPreset";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";
    const modes = tags("value")
      .map((t) => ({ name: attr(t, "name"), label: attr(t, "displayName") }))
      .filter((m) => m.name);
    saveFixture("27-audio-preset.xml");
    vars.lmValue = attr(preset, "value");
    vars.lmLabel = (modes.find((m) => m.name === attr(preset, "value")) || {}).label || "";
    console.log(
      "HTTP " +
        res.status +
        ", current: " +
        attr(preset, "value") +
        ', displayName "' +
        attr(preset, "displayName") +
        '", url ' +
        attr(preset, "url") +
        ", refresh=" +
        attr(preset, "refresh") +
        "\nmodes: " +
        modes.map((m) => m.name + " = " + m.label).join(", ") +
        "\n" +
        body.slice(0, 2000),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";
    const modes = tags("value")
      .map((t) => ({ name: attr(t, "name"), label: attr(t, "displayName") }))
      .filter((m) => m.name);
    test("setting preset of class list", () => {
      expect(preset).to.not.equal("");
      expect(attr(preset, "class")).to.equal("list");
    });
    test("at least two modes with name and displayName", () => {
      expect(modes.length).to.be.above(1);
      expect(modes.every((m) => m.label)).to.equal(true);
    });
    test("current value is one of the modes", () => expect(modes.map((m) => m.name)).to.include(attr(preset, "value")));
    test("url points to alsa_setting", () => expect(attr(preset, "url")).to.match(/\/alsa_setting$/));
  },
});

request("A28 Playlist tracks", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.playlistKey;
    if (!key) {
      // Needed key not found by an earlier request (A16)
      req.skip();
      return;
    }
    // Same request as the app (playlist popup): browse key of the first BluOS playlist, without context menu items
    const H = "http://" + env.host + ":11000";
    req.url = H + "/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=0";
    // Whether the playlist has a second page (more than 10 tracks): exactly 10 tracks fill the first page without one
    const name = decodeURIComponent((key.split("playlist=")[1] || "").replace(/\+/g, " "));
    const next = String(
      (
        await http.get(H + "/Songs?service=BluOS&playlist=" + encodeURIComponent(name) + "&offset=10", {
          responseType: "text",
          transformResponse: (x) => x,
          headers: { "Accept-Language": "en" },
        })
      ).data || "",
    );
    vars.a28More = /<song\b/.test(next) ? "1" : "0";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("28-playlist-tracks.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("type=tracks with the play URL of the playlist", () => {
      const top = tags("browse")[0] || "";
      expect(attr(top, "type")).to.equal("tracks");
      expect(attr(top, "playURL")).to.match(/^\/Load\?service=BluOS&name=/);
    });

    test("tracks have text, text2 (artist • album), duration and autoplayURL of the playlist", () => {
      const t = items("track");
      expect(t.length).to.be.above(0);
      expect(t.length).to.be.at.most(10);
      t.forEach((x) =>
        ["text", "text2", "duration", "autoplayURL"].forEach((n) => expect(attr(x, n), n).to.not.equal("")),
      );
      t.forEach((x, i) => expect(attr(x, "autoplayURL")).to.match(new RegExp("listindex=" + i + "&.*playlist=")));
    });

    test("nextKey (/Songs?playlist=…&offset=10) only with more than 10 tracks", () => {
      const top = tags("browse")[0] || "";
      if (vars.a28More === "1") expect(attr(top, "nextKey")).to.match(/^BluOS:Song\/%2FSongs%3Fplaylist=.*&offset=10$/);
      else expect(attr(top, "nextKey")).to.equal("");
    });
  },
});

request("A29 Library playlists", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libPlaylistsKey;
    if (!key) {
      // Needed key not found by an earlier request (A02)
      req.skip();
      return;
    }
    // Same request as the app (Playlists chip): the link "Playlists" of the library menu, with the inline context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=1";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);

    const saveFixture = (file) => save(file, body);
    saveFixture("29-library-playlists.xml");
    // Track list of the first library playlist (A30)
    const first = items("playlist")[0];
    vars.libPlaylistKey = first ? attr(first, "browseKey") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    // Context menu actions of each playlist item (types of the <item> tags inside its <contextMenu>)
    const menus = () =>
      (
        body.match(
          /<item [^>]*type="playlist"[^>]*>[\s\S]*?<\/item>\s*<\/contextMenu>|<item [^>]*type="playlist"[^>]*>/g,
        ) || []
      ).map((m) => (m.match(/<contextMenu>[\s\S]*$/) || [""])[0].match(/type="[^"]*"/g) || []);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("type=playlists", () => expect(attr(tags("browse")[0] || "", "type")).to.equal("playlists"));

    test("playlists have text, browseKey, contextMenuKey and a play URL /Load?service=LocalMusic", () => {
      items("playlist").forEach((x) => {
        ["text", "browseKey", "contextMenuKey"].forEach((n) => expect(attr(x, n), n).to.not.equal(""));
        expect(attr(x, "browseKey")).to.match(/^LocalMusic:MG\/LocalMusic-Playlist\?playlist=.*&playlistid=/);
        expect(attr(x, "playURL")).to.match(/^\/Load\?service=LocalMusic&.*id=/);
      });
    });

    test("context menu: add-last, no delete (a library playlist cannot be changed through the player)", () => {
      menus().forEach((m) => {
        expect(m).to.include('type="add-last"');
        expect(m).to.not.include('type="delete"');
      });
    });
  },
});

request("A30 Library playlist tracks", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const key = vars.libPlaylistKey;
    if (!key) {
      // No library playlist found by A29 (none imported)
      req.skip();
      return;
    }
    // Same request as the app (playlist popup): browse key of the first library playlist, without context menu items
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(key) + "&withContextMenuItems=0";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("30-library-playlist-tracks.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("type=tracks with the play URL of the playlist", () => {
      const top = tags("browse")[0] || "";
      expect(attr(top, "type")).to.equal("tracks");
      expect(attr(top, "playURL")).to.match(/^\/Load\?service=LocalMusic&id=/);
    });

    test("tracks have text, text2, duration and an autoplayURL of the playlist", () => {
      const t = items("track");
      expect(t.length).to.be.above(0);
      t.forEach((x) =>
        ["text", "text2", "duration", "autoplayURL"].forEach((n) => expect(attr(x, n), n).to.not.equal("")),
      );
      t.forEach((x, i) => expect(attr(x, "autoplayURL")).to.match(new RegExp("listindex=" + i + "&.*playlistid=")));
    });
  },
});
