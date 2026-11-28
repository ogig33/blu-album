// 1 Read (safe): 62 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("V01 SyncStatus", {
  url: `http://${env.host}:11000/SyncStatus`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-syncstatus.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root SyncStatus with etag, syncStat, id, name, model, volume", () => {
      const r = tags("SyncStatus")[0] || "";
      ["etag", "syncStat", "id", "name", "model", "modelName", "brand", "volume"].forEach((a) =>
        expect(attr(r, a), a).to.not.equal(""),
      );
    });
    test("id is <ip>:<port>", () => expect(attr(tags("SyncStatus")[0] || "", "id")).to.match(/^[\d.]+:\d+$/));
  },
});

request("V02 Presets", {
  url: `http://${env.host}:11000/Presets`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-presets.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root presets with prid", () => expect(attr(tags("presets")[0] || "", "prid")).to.not.equal(""));
    test("every preset has id, name and url", () =>
      tags("preset").forEach((t) => ["id", "name", "url"].forEach((a) => expect(attr(t, a), a).to.not.equal(""))));
  },
});

request("V03 Inputs (RadioBrowse Capture)", {
  url: `http://${env.host}:11000/RadioBrowse?service=Capture`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-radiobrowse-capture.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root radiotime with service=Capture", () =>
      expect(attr(tags("radiotime")[0] || "", "service")).to.equal("Capture"));
    test("every item has text and URL", () =>
      tags("item").forEach((t) => ["text", "URL"].forEach((a) => expect(attr(t, a), a).to.not.equal(""))));
  },
});

request("V04 Services", {
  url: `http://${env.host}:11000/Services`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-services.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is XML with a root element", () =>
      expect(/^\s*(<\?xml[^>]*>\s*)?<[A-Za-z]/.test(body)).to.equal(true));
  },
});

request("V05 Settings audio", {
  url: `http://${env.host}:11000/Settings?id=audio`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-settings-audio.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root settings", () => expect(tags("settings").length).to.equal(1));
    test("has setting elements with id", () =>
      expect(tags("setting").filter((t) => attr(t, "id")).length).to.be.above(0));
  },
});

request("V06 Settings capture (schema 32)", {
  url: `http://${env.host}:11000/Settings?id=capture&schemaVersion=32`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-settings-capture.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root settings", () => expect(tags("settings").length).to.equal(1));
    test("has a menuGroup capture", () =>
      expect(tags("menuGroup").some((t) => attr(t, "id") === "capture")).to.equal(true));
  },
});

request("V07 Network shares page (port 80)", {
  url: `http://${env.host}:80/sharecfg?noheader=1`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-sharecfg.html");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is an HTML page", () => expect(/<html|<form|<table/i.test(body)).to.equal(true));
  },
});

request("V08 First new album (library)", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&recent=1`,
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
    const a = (body.match(/<album\b[^>]*>([\s\S]*?)<\/album>/) || [])[1] || "";
    const pick = (t) => {
      const m = a.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    vars.vAlbum = pick("alb") || pick("title");
    vars.vArtist = pick("art");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("at least one album", () => expect(tags("album").length).to.be.above(0));
  },
});

request("V09 Add to playlist options (album)", {
  url: `http://${env.host}:11000/AddToPlaylistOptions`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const al = vars.vAlbum,
      ar = vars.vArtist;
    if (!al) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/AddToPlaylistOptions?service=LocalMusic&album=" +
      encodeURIComponent(al) +
      "&artist=" +
      encodeURIComponent(ar);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-addtoplaylistoptions.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is XML without error", () => {
      expect(/^\s*(<\?xml[^>]*>\s*)?<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
  },
});

request("V10 Library playlists (imported)", {
  url: `http://${env.host}:11000/library/v1/Playlists?service=LocalMusic&imported=1`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-playlists-imported.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is XML without error", () => {
      expect(/^\s*(<\?xml[^>]*>\s*)?<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
  },
});

request("V11 Library playlists (favourites)", {
  url: `http://${env.host}:11000/library/v1/Playlists?service=LocalMusic&category=FAVOURITES`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-playlists-favourites.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is XML without error", () => {
      expect(/^\s*(<\?xml[^>]*>\s*)?<[A-Za-z]/.test(body)).to.equal(true);
      expect(/<error/i.test(body)).to.equal(false);
    });
  },
});

request("V12 Settings tree (all menus)", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36`,
  async post(req, res) {
    // Reads the whole settings tree: the top level (schema 36, as /SyncStatus reports it), then every
    // menuGroup id (not the settings / buttons) with /Settings?id=<id>, also the ids found in those answers.
    // Only GET /Settings requests – nothing is changed.
    const body = String(res.body || "");
    const H = "http://" + env.host + ":11000";
    const ids = (xml) => [...xml.matchAll(/<menuGroup\b[^>]*\sid="([^"]*)"/g)].map((m) => m[1]);
    const urls = (xml) => [...xml.matchAll(/\surl="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

    const saveSub = (file, text) => save("settings/" + file, text);
    saveSub("_top.xml", body);
    const done = new Set(),
      queue = ids(body),
      found = new Set(urls(body)),
      pages = [];
    while (queue.length && done.size < 150) {
      const id = queue.shift();
      if (done.has(id)) continue;
      done.add(id);
      try {
        const r = await http.get(H + "/Settings?schemaVersion=36&id=" + encodeURIComponent(id), {
          responseType: "text",
          transformResponse: (x) => x,
          timeout: 10000,
        });
        const xml = String(r.data || "");
        if (!/<settings/.test(xml)) continue;
        pages.push(id);
        saveSub(id.replace(/[^\w.-]/g, "_") + ".xml", xml);
        ids(xml).forEach((i) => {
          if (!done.has(i)) queue.push(i);
        });
        urls(xml).forEach((u) => found.add(u));
      } catch (e) {
        console.log("id " + id + ": " + e.message);
      }
    }
    const paths = [...new Set([...found].map((u) => u.replace(/^https?:\/\/[^/]+/, "").split("?")[0]))].sort();
    vars.settingsPages = pages.length;
    saveSub(
      "_summary.txt",
      "ids asked: " +
        done.size +
        "\npages: " +
        pages.join(", ") +
        "\n\nendpoints:\n" +
        paths.join("\n") +
        "\n\nurls:\n" +
        [...found].sort().join("\n") +
        "\n",
    );
    console.log("Settings pages: " + pages.length + " of " + done.size + " ids\nEndpoints: " + paths.join(", "));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("top level is a settings tree", () => expect(/<settings/.test(String(res.body || ""))).to.equal(true));
    test("sub pages read", () => expect(vars.settingsPages).to.be.above(0));
  },
});

request("V13 UI home screen", {
  url: `http://${env.host}:11000/ui/Home`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-home.xml");
    console.log(body.slice(0, 4000));
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

request("V14 UI sources", {
  url: `http://${env.host}:11000/ui/Sources`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-sources.xml");
    console.log(body.slice(0, 4000));
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

request("V15 UI queue", {
  url: `http://${env.host}:11000/ui/Queue?offset=0`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-queue.xml");
    console.log(body.slice(0, 4000));
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

request("V16 UI presets", {
  url: `http://${env.host}:11000/ui/presets`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-presets.xml");
    console.log(body.slice(0, 4000));
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

request("V17 UI my playlists row (library)", {
  url: `http://${env.host}:11000/ui/myPlaylistsRow?service=LocalMusic`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-myplaylistsrow.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 4000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    // Without playlists the player answers with an empty body (HTTP 200 or 204)
    test("HTTP 200 or 204", () => expect([200, 204]).to.include(res.status));
    // Empty answer when the source has no playlists (no row on the home screen)
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("V18 UI saved playlists (BrowseObjects)", {
  url: `http://${env.host}:11000/ui/BrowseObjects?browseIndex=0&menuGroupId=BluOS&service=BluOS&type=Playlist&url=%2FPlaylists%3Fservice%3DBluOS%26myPlaylists%3D1`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-browseobjects.xml");
    console.log(body.slice(0, 4000));
    const list = (body.match(/<list>([\s\S]*)<\/list>/) || [])[1] || "";
    vars.uiPlaylist = dec((list.match(/<item\b[^>]*\stitle="([^"]*)"/) || [])[1] || "");
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

request("V19 UI playlist page (browseContext)", {
  url: `http://${env.host}:11000/ui/browseContext`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const p = vars.uiPlaylist || vars.vrPlaylistName || "";
    if (!p) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/ui/browseContext?service=BluOS&type=Playlist&title=" +
      encodeURIComponent(p) +
      "&url=" +
      encodeURIComponent("/Playlists?service=BluOS&playlist=" + encodeURIComponent(p) + "&playlistid=");
  },
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-browsecontext.xml");
    console.log(body.slice(0, 4000));
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

request("V20 UI playlist context menu", {
  url: `http://${env.host}:11000/ui/ContextMenu`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const p = vars.uiPlaylist || "";
    if (!p) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/ui/ContextMenu?context=Playlist&service=BluOS&playlist=" +
      encodeURIComponent(p) +
      "&title=" +
      encodeURIComponent(p);
  },
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-contextmenu.xml");
    console.log(body.slice(0, 4000));
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

request("V21 UI favourites (library)", {
  url: `http://${env.host}:11000/ui/Favourites?service=LocalMusic&singleService=1&title=My+Favourites`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-favourites.xml");
    console.log(body.slice(0, 4000));
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

request("V22 UI recently played", {
  url: `http://${env.host}:11000/ui/RecentlyPlayed`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-recentlyplayed.xml");
    console.log(body.slice(0, 4000));
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

request("V23 UI queue entry context menu", {
  url: `http://${env.host}:11000/ui/queueItemCM?id=0`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-queueitemcm.xml");
    console.log(body.slice(0, 4000));
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

request("V24 Save queue options", {
  url: `http://${env.host}:11000/AddToPlaylistOptions?saveQueue=1`,
  async post(req, res) {
    // Options for saving the queue (read only, nothing is saved). The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-savequeueoptions.xml");
    console.log(body.slice(0, 4000));
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

request("V25 UI configuration", {
  url: `http://${env.host}:11000/ui/Configuration`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-configuration.xml");
    console.log(body.slice(0, 4000));
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

request("V26 UI now playing context menu", {
  url: `http://${env.host}:11000/ui/nowPlayingCM`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-nowplayingcm.xml");
    console.log(body.slice(0, 4000));
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

request("V27 UI search in the library", {
  url: `http://${env.host}:11000/ui/Search?forService=LocalMusic&q=a`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-search.xml");
    console.log(body.slice(0, 4000));
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

request("V28 UI library menu", {
  url: `http://${env.host}:11000/ui/browseMenuGroup?service=LocalMusic`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-browsemenugroup.xml");
    console.log(body.slice(0, 4000));
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

request("V29 UI artists of the library", {
  url: `http://${env.host}:11000/ui/browseGrouped?browseIndex=0&menuGroupId=LocalMusic&service=LocalMusic&title=Artists&type=Artist&url=%2Flibrary%2Fv1%2FArtists%3Fservice%3DLocalMusic`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-browsegrouped.xml");
    console.log(body.slice(0, 4000));
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

request("V30 UI genres of the library", {
  url: `http://${env.host}:11000/ui/browseGenres?genreGroupId=Genres&service=LocalMusic&title=Genres&url=%2Flibrary%2Fv1%2FGenres%3Fservice%3DLocalMusic`,
  async post(req, res) {
    // BluOS app screen (/ui/...): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-browsegenres.xml");
    console.log(body.slice(0, 4000));
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

request("V31 Network shares", {
  url: `http://${env.host}:80/Shares`,
  async post(req, res) {
    // Network shares of the library (asked by the /sharecfg page, port 80; port 11000 answers 404): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-shares.xml");
    console.log(body.slice(0, 4000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V32 Diagnostics page (port 80)", {
  url: `http://${env.host}:80/diag?noheader=1&playnum=1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-diag.html");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V33 Diagnostics page 2 (port 80)", {
  url: `http://${env.host}:80/diagnostics?noheader=1&playnum=1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-diagnostics.html");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V34 Support request page (port 80, not sent)", {
  url: `http://${env.host}:80/settings/sendSupportRequest?noheader=1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-sendsupportrequest.html");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V35 Support request settings as web view", {
  url: `http://${env.host}:11000/Settings?view=web&id=sendSupportRequest`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-settings-sendsupportrequest.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V36 Data export (port 80)", {
  url: `http://${env.host}:80/Dataexport`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-dataexport.txt");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    console.log("content-disposition: " + (res.header("content-disposition") || "") + ", length: " + body.length);
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V37 Error message 1 (read, not cleared)", {
  url: `http://${env.host}:11000/error?1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-error.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("V38 UI news", {
  url: `http://${env.host}:11000/ui/News`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-ui-news.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("V39 UI resolveSoviURL (no parameters)", {
  url: `http://${env.host}:11000/ui/resolveSoviURL`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-ui-resolvesoviurl.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    // Without a URL the player answers the text "invalid URL scheme: " (not XML, not HTTP 200)
    test('answers "invalid URL scheme"', () => expect(/invalid URL scheme/.test(body)).to.equal(true));
  },
});

request("V40 UI prf with a read request (Volume)", {
  url: `http://${env.host}:11000/ui/prf?u=%2FVolume`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-ui-prf-volume.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer of /Volume passed through", () => expect(/<volume\b/.test(body)).to.equal(true));
  },
});

request("V41 Library artists (section A)", {
  url: `http://${env.host}:11000/library/v1/Artists?service=LocalMusic&section=A`,
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-artists.xml");
    console.log(body.slice(0, 4000));
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

request("V42 Library composers", {
  url: `http://${env.host}:11000/library/v1/Composers?service=LocalMusic`,
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-composers.xml");
    console.log(body.slice(0, 4000));
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

request("V43 Library search", {
  url: `http://${env.host}:11000/library/v1/Search?service=LocalMusic&expr=a`,
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-search.xml");
    console.log(body.slice(0, 4000));
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

request("V44 Library albums of an artist", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Album and artist from V08 (first new album)
    const H = "http://" + env.host + ":11000";
    const ar = vars.vArtist;
    if (!ar) {
      req.skip();
      return;
    }
    req.url = H + "/library/v1/Albums?service=LocalMusic&artist=" + encodeURIComponent(ar);
  },
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-albums-artist.xml");
    console.log(body.slice(0, 4000));
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

request("V45 Library album (album and artist)", {
  url: `http://${env.host}:11000/library/v1/Albums`,
  async pre(req) {
    // Album and artist from V08 (first new album)
    const H = "http://" + env.host + ":11000";
    const al = vars.vAlbum,
      ar = vars.vArtist;
    if (!al) {
      req.skip();
      return;
    }
    req.url =
      H + "/library/v1/Albums?service=LocalMusic&album=" + encodeURIComponent(al) + "&artist=" + encodeURIComponent(ar);
  },
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-album.xml");
    console.log(body.slice(0, 4000));
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

request("V46 Library folders (root)", {
  url: `http://${env.host}:11000/library/v1/Folders?service=LocalMusic`,
  async post(req, res) {
    // Library server answer for the response example in docs/bluos-api.md: read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-library-folders.xml");
    console.log(body.slice(0, 4000));
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

request("V47 Info lyrics of the playing track", {
  url: `http://${env.host}:11000/Info`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const st = String(
      (await http.get(H + "/Status", { responseType: "text", transformResponse: (x) => x })).data || "",
    );
    const id = (st.match(/<lyricsid>([^<]*)<\/lyricsid>/) || [])[1],
      svc = (st.match(/<service>([^<]*)<\/service>/) || [])[1];
    if (!id) {
      console.log("No lyricsid in /Status – skipped (play Radio Paradise)");
      req.skip();
      return;
    }
    req.url = H + "/Info?lyricsid=" + encodeURIComponent(id) + "&service=" + encodeURIComponent(svc || "");
  },
  async post(req, res) {
    // Lyrics of the playing track (/Info?lyricsid=…), only when /Status has a lyricsid (e.g. Radio Paradise): read only. The answer goes to the console and fixtures/.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-info-lyrics.xml");
    console.log(body.slice(0, 4000));
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

request("V48 Diagnostics log (port 80, print)", {
  url: `http://${env.host}:80/diag?print=1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-diag-print.txt");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("V49 Settings expanded", {
  url: `http://${env.host}:11000/Settings?expand=1`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-settings-expand.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("V50 audiomodes read (GET without parameters)", {
  url: `http://${env.host}:11000/audiomodes`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-audiomodes-get.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("V51 Paths that should not exist", {
  url: `http://${env.host}:11000/Version`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    const H = "http://" + env.host + ":11000";
    const out = [];
    for (const p of [
      "/Mute",
      "/ZoneStatus",
      "/Players",
      "/Sources",
      "/GroupStatus",
      "/PlayQueue",
      "/CoverArt",
      "/RadioDeletePreset",
      "/Search?service=LocalMusic&expr=a",
      "/RadioSearch?service=TuneIn&expr=jazz",
      "/captures",
      "/ui/reportServiceDuration",
    ]) {
      try {
        const r = await http.get(H + p, {
          responseType: "text",
          transformResponse: (x) => x,
          validateStatus: () => true,
          timeout: 5000,
        });
        out.push(
          p +
            " -> HTTP " +
            r.status +
            " " +
            String(r.data || "")
              .slice(0, 80)
              .replace(/\s+/g, " "),
        );
      } catch (e) {
        out.push(p + " -> " + e.message);
      }
    }
    vars.vsMissing = out.join("\n");
    saveFixture("verify-missing-paths.txt", out.join("\n"));
    console.log(out.join("\n"));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("all answer 404", () =>
      expect((vars.vsMissing || "").split("\n").every((l) => / -> HTTP 404 /.test(l))).to.equal(true));
  },
});

request("V52 Playlists sorted and filtered", {
  url: `http://${env.host}:11000/Playlists?service=BluOS&sort=recent`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-playlists-recent.xml");
    const names = (xml) => [...xml.matchAll(/<name\b[^>]*>([^<]*)<\/name>/g)].map((m) => m[1]);
    // The same list A → Z, a single playlist by name and an unknown name
    const get = async (p) => {
      const r = await http.get("http://" + env.host + ":11000" + p, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 10000,
      });
      return String(r.data || "");
    };
    const recent = names(body);
    const alpha = names(await get("/Playlists?service=BluOS&sort=alpha"));
    const first = alpha[0] || "";
    const one = first
      ? names(await get("/Playlists?service=BluOS&playlist=" + encodeURIComponent(first) + "&playlistid="))
      : [];
    const missing = await get("/Playlists?service=BluOS&playlist=__bluos_no_such_playlist__");
    vars.vpRecent = JSON.stringify(recent);
    vars.vpAlpha = JSON.stringify(alpha);
    vars.vpOne = JSON.stringify(one);
    vars.vpFirst = first;
    vars.vpMissing = missing;
    console.log(
      "recent: " +
        recent.join(" | ") +
        "\nalpha:  " +
        alpha.join(" | ") +
        "\nplaylist=" +
        first +
        ": " +
        one.join(" | ") +
        "\nunknown name: " +
        missing.replace(/\s+/g, " ").slice(0, 200),
    );
  },
  async tests(req, res, test) {
    const recent = JSON.parse(vars.vpRecent || "[]");
    const alpha = JSON.parse(vars.vpAlpha || "[]");
    const one = JSON.parse(vars.vpOne || "[]");
    const first = vars.vpFirst || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("sort=recent and sort=alpha list the same playlists", () =>
      expect([...recent].sort()).to.deep.equal([...alpha].sort()));
    if (first) test("playlist=<name> gives only that playlist", () => expect(one).to.deep.equal([first]));
    test("unknown playlist name answers 'not found'", () =>
      expect(/<error[^>]*>\s*<message>not found<\/message>/.test(vars.vpMissing || "")).to.equal(true));
  },
});

request("V53 Presets edit with GET (405)", {
  url: `http://${env.host}:11000/Presets/edit`,
  async pre(req) {
    // Same URL as the deep link of the BluOS Controller: /reorder-presets?url=/Presets/edit?prid=<prid>
    const H = "http://" + env.host + ":11000";
    const r = await http.get(H + "/Presets", { responseType: "text", transformResponse: (x) => x, timeout: 10000 });
    const m = String(r.data || "").match(/<presets\b[^>]*\sprid="([^"]*)"/);
    req.url = H + "/Presets/edit?prid=" + (m ? m[1] : "");
  },
  async post(req, res) {
    console.log(
      "HTTP " +
        res.status +
        ", allow: " +
        (res.header("allow") || "–") +
        ", body: " +
        String(res.body || "").length +
        " bytes",
    );
  },
  async tests(req, res, test) {
    // Only GET is tried: the endpoint presumably takes a POST with the new order of the presets
    test("GET answers 405 (endpoint exists, other method)", () => expect(res.status).to.equal(405));
  },
});

request("V54 Music services page (port 80)", {
  url: `http://${env.host}:80/services?noheader=1&schemaVersion=36`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-services-page.html");
    const links = (body.match(/href="\/(credentials|spotifyinfo)\?[^"]*"/g) || []).map((l) => l.slice(6, -1));
    console.log("HTTP " + res.status + ", " + links.length + " service links\n" + links.join("\n"));
    // The same path on port 11000 does not exist (/Services there is the XML self-description)
    const r = await http.get("http://" + env.host + ":11000/services?noheader=1", {
      responseType: "text",
      transformResponse: (x) => x,
      validateStatus: () => true,
      timeout: 10000,
    });
    vars.vsServices11000 = String(r.status);
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("HTML page 'Configure Music Services'", () =>
      expect(/<title>Configure Music Services<\/title>/.test(body)).to.equal(true));
    test("links to the sign-in pages of the services", () =>
      expect(/href="\/credentials\?service=/.test(body)).to.equal(true));
    test("not on port 11000 (404)", () => expect(vars.vsServices11000).to.equal("404"));
  },
});

request("V55 UI context menu of a radio favourite", {
  url: `http://${env.host}:11000/ui/ContextMenu`,
  async pre(req) {
    // First TuneIn favourite station; its attributes become the parameters, as in /ui/BrowseObjects
    const H = "http://" + env.host + ":11000";
    const r = await http.get(H + "/RadioBrowse?service=TuneIn&url=presets", {
      responseType: "text",
      transformResponse: (x) => x,
      validateStatus: () => true,
      timeout: 10000,
    });
    const item = (String(r.data || "").match(/<item\b[^>]*>/g) || []).find(
      (t) => attr(t, "is_preset") === "1" && attr(t, "inputType") === "station" && attr(t, "URL"),
    );
    if (!item) {
      // No TuneIn favourite station on this player
      req.skip();
      return;
    }
    const e = encodeURIComponent;
    const base =
      "context=Item&service=TuneIn&URL=" +
      e(decodeURIComponent(attr(item, "URL"))) +
      "&inputType=station&text=" +
      e(attr(item, "text")) +
      "&title=" +
      e(attr(item, "text")) +
      "&preset_id=" +
      e(attr(item, "preset_id"));
    vars.vcRadioBase = base;
    req.url = H + "/ui/ContextMenu?" + base + "&is_preset=1";
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-ui-context-menu-radio.xml");
    const texts = (xml) => (xml.match(/\stext="[^"]*"/g) || []).map((t) => t.slice(7, -1));
    // The same station without is_preset (not a favourite) and without inputType
    const get = async (q) => {
      const r = await http.get("http://" + env.host + ":11000/ui/ContextMenu?" + q, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 10000,
      });
      return String(r.data || "");
    };
    const base = vars.vcRadioBase;
    const notFav = await get(base);
    const noType = await get(base.replace("&inputType=station", "") + "&is_preset=1");
    vars.vcRadioNotFav = notFav;
    vars.vcRadioNoType = JSON.stringify(texts(noType));
    console.log(
      "is_preset=1:      " +
        texts(body).join(" | ") +
        "\nwithout is_preset: " +
        texts(notFav).join(" | ") +
        "\nwithout inputType: " +
        texts(noType).join(" | "),
    );
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    const notFav = vars.vcRadioNotFav || "";
    const noType = JSON.parse(vars.vcRadioNoType || "[]");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("is_preset=1: 'Remove favourite' with /DeleteFavourite?id=", () =>
      expect(/text="Remove favourite"/.test(body) && /URI="\/DeleteFavourite\?id=/.test(body)).to.equal(true));
    test("inputType=station: 'Related stations' and 'Add preset'", () =>
      expect(/text="Related stations"/.test(body) && /text="Add preset"/.test(body)).to.equal(true));
    test("without is_preset: 'Favourite' with /AddFavourite?preset_id=", () =>
      expect(/text="Favourite"/.test(notFav) && /URI="\/AddFavourite\?preset_id=/.test(notFav)).to.equal(true));
    test("without inputType: only 'Remove favourite'", () => expect(noType).to.deep.equal(["Remove favourite"]));
  },
});

request("V56 Upgrade message (update)", {
  url: `http://${env.host}:11000/update`,
  async post(req, res) {
    // Upgrade message of the player: "no message", or the message of the upgrade service (stage0) when a firmware upgrade is ready.
    // Not called: /update?<n> (presumably a long poll), /update?clear=1 (clears the message), POST /update (sets it).
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-update.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root element update", () => expect(/<update\b/.test(body)).to.equal(true));
  },
});

request("V57 UI testing screen", {
  url: `http://${env.host}:11000/ui/testing`,
  headers: { "Accept-Language": "en" },
  async post(req, res) {
    // Hidden test screen of the BluOS Controller (found in its code, menu entry only in a test mode): a sample of every
    // element type of the /ui screens with fixed example links (Tidal, Idagio, Radio Paradise). Read only.
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-ui-testing.xml");
    const tags = [...new Set([...body.matchAll(/<([A-Za-z]+)[\s>]/g)].map((m) => m[1]))];
    console.log("HTTP " + res.status + ", elements: " + tags.join(" "));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root element screen", () => expect(/<screen\b/.test(body)).to.equal(true));
    test("rows, buttons, teasers and thumbnails", () => {
      for (const t of ["row", "button", "teaser", "largeThumbnail", "smallThumbnail"])
        expect(body.includes("<" + t)).to.equal(true);
    });
    test("app links with iosApp / androidPackage / desktopApp", () =>
      expect(/\b(iosApp|androidPackage|desktopApp)="/.test(body)).to.equal(true));
  },
});

request("V58 New read endpoints (BTDevices, ui playlist and work, Works)", {
  url: `http://${env.host}:11000/BTDevices`,
  headers: { "Accept-Language": "en" },
  async post(req, res) {
    // Endpoints found by build-wordlist.js (BluOS Controller code) and ffuf, read without parameters:
    // /BTDevices (Bluetooth devices; refresh, connect, disconnect, unpair change them: not sent), /ui/playlist and
    // /ui/work (empty lists without a service), /Works (service function of Idagio, error without a login).
    // Not sent: /PlayTestSound (stops the playback), /SetMaster, /SetInitialized, /ExternalSource, /MovePlayback.
    const body = String(res.body || "");
    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-btdevices.xml");
    const H = "http://" + env.host + ":11000";
    const get = async (p) => {
      const r = await http.get(H + p, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 10000,
        headers: { "Accept-Language": "en" },
      });
      return { status: r.status, body: String(r.data || "") };
    };
    const r = {};
    for (const [k, p] of Object.entries({
      uiPlaylist: "/ui/playlist",
      uiWork: "/ui/work",
      works: "/Works?service=Idagio&composerid=61259&sort=popular",
      album: "/Album?service=LocalMusic",
    }))
      r[k] = await get(p);
    saveFixture("verify-ui-playlist.xml", r.uiPlaylist.body);
    vars.v58 = JSON.stringify(r);
    console.log(
      body +
        "\n" +
        Object.entries(r)
          .map(([k, v]) => k + ": HTTP " + v.status + " " + v.body.slice(0, 200))
          .join("\n"),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const r = JSON.parse(vars.v58);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("BTDevices: root btdevices with etag and connecting", () =>
      expect(/<btdevices\b[^>]*\betag="[^"]*"[^>]*\bconnecting="(true|false)"/.test(body)).to.equal(true));
    test("ui/playlist: root playlists", () => {
      expect(r.uiPlaylist.status).to.equal(200);
      expect(/<playlists\b/.test(r.uiPlaylist.body)).to.equal(true);
    });
    test("ui/work: root works", () => {
      expect(r.uiWork.status).to.equal(200);
      expect(/<works\b/.test(r.uiWork.body)).to.equal(true);
    });
    test("Works: works or an error of Idagio", () => {
      expect(r.works.status).to.equal(200);
      expect(/<works\b|<error service="Idagio"/.test(r.works.body)).to.equal(true);
    });
    test("Album (in the app's code) does not exist: 404", () => expect(r.album.status).to.equal(404));
  },
});

request("V59 Spotify Connect info", {
  url: `http://${env.host}:11000/spotifyconnect?action=getInfo`,
  async post(req, res) {
    // Spotify Connect ZeroConf endpoint of the player (mDNS _spotify-connect._tcp, CPath=/spotifyconnect), JSON.
    // Only action=getInfo (read); action=addUser would sign in a Spotify account: not sent.
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-spotifyconnect.json");
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    console.log("HTTP " + res.status + ", keys: " + Object.keys(j).join(", "));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("JSON answer", () => expect(String(res.header("content-type"))).to.contain("application/json"));
    test("status 101 OK", () => {
      expect(j.status).to.equal(101);
      expect(j.statusString).to.equal("OK");
    });
    test("deviceID and version", () => {
      expect(j.deviceID).to.be.a("string");
      expect(j.version).to.be.a("string");
    });
  },
});

request("V60 TLS ports (cert-bootstrap manifest, port 80)", {
  url: `http://${env.host}:80/cert-bootstrap/manifest`,
  async post(req, res) {
    // The web app of port 80 reads the TLS ports here and opens https://<player>:<port>/cert-accept?next=/ so that the
    // browser accepts the self-signed certificate (not called here). Checks that the first TLS port after 443 answers
    // the API of port 11000 (/SyncStatus) over https; the certificate is not verified.
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw);
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-cert-manifest.json");
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    const ports = Array.isArray(j.tlsPorts) ? j.tlsPorts : [];
    const api = ports.find((p) => p !== 443);
    let sync = { status: 0, body: "" };
    if (api) {
      const https = require("https");
      const r = await http.get("https://" + env.host + ":" + api + "/SyncStatus", {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      sync = { status: r.status, body: String(r.data || "") };
    }
    vars.v60 = JSON.stringify({ ports, api, sync });
    console.log(
      "TLS ports " +
        ports.join(", ") +
        "; https://…:" +
        api +
        "/SyncStatus: HTTP " +
        sync.status +
        " " +
        sync.body.slice(0, 160),
    );
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.v60);
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("JSON with tlsPorts, 443 among them", () => {
      expect(r.ports.length).to.be.above(1);
      expect(r.ports).to.include(443);
    });
    test("a TLS port answers /SyncStatus", () => {
      expect(r.sync.status).to.equal(200);
      expect(/<SyncStatus\b/.test(r.sync.body)).to.equal(true);
    });
  },
});

request("V61 Redirects of Settings and imported Playlists", {
  url: `http://${env.host}:11000/Version`,
  async post() {
    // Redirects of port 11000, read without following them: /Settings goes to the settings service on port 11001,
    // /Playlists?imported=1 to the library playlists on port 11004. Read only.
    const H = "http://" + env.host + ":11000";
    const head = async (p) => {
      const r = await http.get(H + p, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        maxRedirects: 0,
        timeout: 10000,
        headers: { "Accept-Language": "en" },
      });
      return { status: r.status, location: String(r.headers.location || "") };
    };
    const r = { settings: await head("/Settings?schemaVersion=36"), imported: await head("/Playlists?imported=1") };
    vars.v61 = JSON.stringify(r);
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.v61);
    test("Settings: 301 to port 11001", () => {
      expect(r.settings.status).to.equal(301);
      expect(r.settings.location).to.match(/:11001\/Settings\?/);
    });
    test("Playlists?imported=1: 302 to the library playlists on port 11004", () => {
      expect(r.imported.status).to.equal(302);
      expect(r.imported.location).to.match(/:11004\/library\/v1\/Playlists\?imported=1/);
    });
  },
});

request("V62 Unverified reads (GetUnpairedSlaves, state, Removable)", {
  url: `http://${env.host}:11000/GetUnpairedSlaves`,
  async post(req, res) {
    // /GetUnpairedSlaves: the BluOS app reads it while pairing a speaker (unpairedSlaves > unpairedSlave with brand,
    // model, modelName, version, mac, pairUrl). /state and /Removable answered HTTP 200 to ffuf. Read only, no parameters.
    const H = "http://" + env.host + ":11000";
    const read = async (p) => {
      const r = await http.get(H + p, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 10000,
        headers: { "Accept-Language": "en" },
      });
      return { status: r.status, type: String(r.headers["content-type"] || ""), body: String(r.data || "") };
    };
    const body = String(res.body || "");
    const r = {
      unpaired: { status: res.status, body: body.slice(0, 2000) },
      state: await read("/state"),
      removable: await read("/Removable"),
    };
    vars.v62 = JSON.stringify(r);
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.v62);
    // HTTP 400 without a body on a player that is the primary of a fixed group
    test("GetUnpairedSlaves: 200 with unpairedSlaves, or 400", () =>
      expect(
        r.unpaired.status === 400 || (r.unpaired.status === 200 && /<unpairedSlaves\b/.test(r.unpaired.body)),
      ).to.equal(true));
    test("state: HTTP 200, empty", () => {
      expect(r.state.status).to.equal(200);
      expect(r.state.body.trim()).to.equal("");
    });
    test("Removable: HTTP 200, empty", () => {
      expect(r.removable.status).to.equal(200);
      expect(r.removable.body.trim()).to.equal("");
    });
  },
});
