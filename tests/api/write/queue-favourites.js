// 2 Write (changes the player): 24 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("P01 Remember state and save the queue", {
  url: `http://${env.host}:11000/Save?name=__bluos_verify_add__`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    // Start of P01–P14: autoplayURLs with category / composer / offset and a song favourite (fn=).
    // The queue is saved as playlist __bluos_verify_add__ and restored by P12–P14.
    const s = await get("/Status");
    const v = (t) => {
      const m = s.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? m[1] : "";
    };
    const len = attr(tagsOf(await get("/Playlist?start=0&end=0"), "playlist")[0] || "", "length") || "0";
    vars.vaState = v("state");
    vars.vaSong = v("song");
    vars.vaSecs = v("secs");
    vars.vaLength = len;
    vars.vaExpect = "";
    if (/<streamUrl>/.test(s) || len === "0") {
      console.log("Not playing from a queue (or the queue is empty) – P01–P14 skipped");
      vars.vaSkip = "1";
      req.skip();
      return;
    }
    vars.vaSkip = "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("<saved><entries>N</entries> with N > 0", () =>
      expect(+((body.match(/<entries>(\d+)<\/entries>/) || [])[1] || 0)).to.be.above(0));
  },
});

request("P02 Play the songs of a composer (composer=)", {
  url: `http://${env.host}:11000/Add`,
  async pre(req) {
    if (vars.vaSkip === "1") {
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
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    // Library menu -> Composers -> first composer -> Songs; autoplayURL of the second song (listindex=1)
    vars.vaExpect = "";
    const keys = (xml) =>
      tagsOf(xml, "item")
        .map((t) => attr(t, "browseKey"))
        .filter(Boolean);
    // Lists with letters (type="sections") are opened at their first letter
    const open = async (key) => {
      let xml = await browse(key);
      while (/<browse\b[^>]*type="sections"/.test(xml) && keys(xml)[0]) xml = await browse(keys(xml)[0]);
      return xml;
    };
    const compKey = keys(await browse("LocalMusic:")).find((k) => /Composer/.test(k));
    const composer = compKey ? tagsOf(await open(compKey), "item").find((t) => attr(t, "type") === "composer") : "";
    const songsKey = composer
      ? keys(await browse(attr(composer, "browseKey"))).find((k) => /^LocalMusic:Song\//.test(k))
      : "";
    vars.vaComposerSongsKey = songsKey || "";
    const items = songsKey
      ? tagsOf(await browse(songsKey), "item").filter((t) => /composer=/.test(attr(t, "autoplayURL")))
      : [];
    const item = items[1] || items[0];
    if (!item) {
      console.log("No composer songs (or no composer= in autoplayURL) – skipped");
      req.skip();
      return;
    }
    vars.vaExpect = attr(item, "text");
    req.url = H + attr(item, "autoplayURL");
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-composer.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <playlist>, no error", () => expect(/<playlist\b/.test(body) && !/<error/.test(body)).to.equal(true));
  },
});

request("P03 Status plays the composer song", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaExpect) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 2000)); // give the player time to start the song
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const body = String(res.body || "");
    const val = (t) => {
      const m = body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    const q = await get("/Playlist?start=0&end=0");
    const len = attr(tagsOf(q, "playlist")[0] || "", "length");
    console.log(
      "composer=: plays '" +
        val("title1") +
        "' (expected '" +
        vars.vaExpect +
        "'), queue entry " +
        val("song") +
        " of " +
        len +
        " (before the test: " +
        vars.vaLength +
        " entries)",
    );
    vars.vaTitle = val("title1");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("plays the song of the autoplayURL", () => expect(vars.vaTitle).to.equal(vars.vaExpect));
    test("plays from the queue (no streamUrl)", () => expect(/<streamUrl>/.test(body)).to.equal(false));
  },
});

request("P04 Favourite a song (AddFavourite fn=)", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    if (vars.vaSkip === "1") {
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
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    const param = (u, n) => {
      const m = u.match(new RegExp("[?&]" + n + "=([^&]*)"));
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    };
    // First composer song that is not a favourite; its context menu gives /AddFavourite?fn=…
    vars.vaFavFn = "";
    const songsKey = vars.vaComposerSongsKey;
    const song = songsKey
      ? tagsOf(await browse(songsKey), "item").find(
          (t) => attr(t, "contextMenuKey") && !/isFavourite=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    const add = song
      ? tagsOf(await browse(attr(song, "contextMenuKey")), "item").find((t) => attr(t, "type") === "favourite-add")
      : "";
    const url = add ? attr(add, "actionURL") : "";
    if (!/[?&]fn=/.test(url)) {
      console.log("No song without favourite, or its menu has no /AddFavourite?fn= – skipped");
      req.skip();
      return;
    }
    vars.vaFavFn = param(url, "fn");
    vars.vaFavTitle = attr(song, "text");
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-favourite-song.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <favourite>added</favourite>", () =>
      expect(/<favourite\b[^>]*>added<\/favourite>/.test(body)).to.equal(true));
  },
});

request("P05 Play the favourite songs (category=FAVOURITES)", {
  url: `http://${env.host}:11000/Add`,
  async pre(req) {
    if (vars.vaSkip === "1") {
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
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    // Library menu -> Favourites -> Songs; autoplayURL of the first song
    vars.vaExpect = "";
    const keys = (xml) =>
      tagsOf(xml, "item")
        .map((t) => attr(t, "browseKey"))
        .filter(Boolean);
    const favKey = keys(await browse("LocalMusic:")).find((k) => /Favourites/.test(k));
    const songsKey = favKey ? keys(await browse(favKey)).find((k) => /^LocalMusic:Song\//.test(k)) : "";
    vars.vaFavSongsKey = songsKey || "";
    const item = songsKey
      ? tagsOf(await browse(songsKey), "item").find((t) => /category=FAVOURITES/.test(attr(t, "autoplayURL")))
      : "";
    if (!item) {
      console.log("No favourite songs (or no category=FAVOURITES in autoplayURL) – skipped");
      req.skip();
      return;
    }
    vars.vaExpect = attr(item, "text");
    req.url = H + attr(item, "autoplayURL");
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-category-favourites.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <playlist>, no error", () => expect(/<playlist\b/.test(body) && !/<error/.test(body)).to.equal(true));
  },
});

request("P06 Status plays the favourite song", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaExpect) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 2000)); // give the player time to start the song
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const body = String(res.body || "");
    const val = (t) => {
      const m = body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    const q = await get("/Playlist?start=0&end=0");
    const len = attr(tagsOf(q, "playlist")[0] || "", "length");
    console.log(
      "category=FAVOURITES: plays '" +
        val("title1") +
        "' (expected '" +
        vars.vaExpect +
        "'), queue entry " +
        val("song") +
        " of " +
        len +
        " (before the test: " +
        vars.vaLength +
        " entries)",
    );
    vars.vaTitle = val("title1");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("plays the song of the autoplayURL", () => expect(vars.vaTitle).to.equal(vars.vaExpect));
    test("plays from the queue (no streamUrl)", () => expect(/<streamUrl>/.test(body)).to.equal(false));
  },
});

request("P07 Favourite songs contain the song", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaFavFn || !vars.vaFavSongsKey) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vaFavSongsKey);
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    const param = (u, n) => {
      const m = u.match(new RegExp("[?&]" + n + "=([^&]*)"));
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    };
    const body = String(res.body || "");
    // The song in the favourite list (by its file) and the remove action of its context menu
    const fileOf = (t) => param(attr(t, "playURL"), "file");
    const song = tagsOf(body, "item").find((t) => fileOf(t) === vars.vaFavFn);
    const del = song
      ? tagsOf(await browse(attr(song, "contextMenuKey")), "item").find((t) => attr(t, "type") === "favourite-delete")
      : "";
    vars.vaUnfavUrl = del ? attr(del, "actionURL") : "";
    console.log("'" + vars.vaFavTitle + "' in the favourite songs: " + !!song + "\nremove action: " + vars.vaUnfavUrl);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the song is a favourite now", () => expect(vars.vaUnfavUrl).to.not.equal(""));
    test("its menu removes it with /DeleteFavourite?fn=", () =>
      expect(/^\/DeleteFavourite\?(.*&)?fn=/.test(vars.vaUnfavUrl)).to.equal(true));
  },
});

request("P08 Remove the song favourite (DeleteFavourite fn=)", {
  url: `http://${env.host}:11000/DeleteFavourite`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaUnfavUrl) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + vars.vaUnfavUrl;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-delete-favourite-song.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <favourite>deleted</favourite>", () =>
      expect(/<favourite\b[^>]*>deleted<\/favourite>/.test(body)).to.equal(true));
  },
});

request("P09 Favourite songs no longer contain the song", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaFavFn || !vars.vaFavSongsKey) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vaFavSongsKey);
  },
  async post(req, res) {
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const param = (u, n) => {
      const m = u.match(new RegExp("[?&]" + n + "=([^&]*)"));
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    };
    const body = String(res.body || "");
    const fileOf = (t) => param(attr(t, "playURL"), "file");
    vars.vaStillFav = tagsOf(body, "item").some((t) => fileOf(t) === vars.vaFavFn) ? "1" : "";
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the song is no favourite any more", () => expect(vars.vaStillFav).to.equal(""));
  },
});

request("P10 Play the test playlist from its second page (offset=)", {
  url: `http://${env.host}:11000/Add`,
  async pre(req) {
    if (vars.vaSkip === "1") {
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
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    // Saved playlist __bluos_verify_add__ (P01) -> second page (nextKey) -> autoplayURL of its first song
    vars.vaExpect = "";
    const pl = tagsOf(await browse("BluOS:"), "item").find((t) => attr(t, "text") === "__bluos_verify_add__");
    const first = pl ? await browse(attr(pl, "browseKey")) : "";
    const next = attr(tagsOf(first, "browse")[0] || "", "nextKey");
    if (!next) {
      console.log("The queue has no second page (10 entries or fewer) – skipped");
      req.skip();
      return;
    }
    const item = tagsOf(await browse(next), "item").find((t) => /offset=/.test(attr(t, "autoplayURL")));
    if (!item) {
      console.log("No offset= in the autoplayURL of the second page – skipped");
      req.skip();
      return;
    }
    vars.vaExpect = attr(item, "text");
    req.url = H + attr(item, "autoplayURL");
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-offset.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <playlist>, no error", () => expect(/<playlist\b/.test(body) && !/<error/.test(body)).to.equal(true));
  },
});

request("P11 Status plays the song of the second page", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    if (!vars.vaExpect) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 2000)); // give the player time to start the song
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const body = String(res.body || "");
    const val = (t) => {
      const m = body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    const q = await get("/Playlist?start=0&end=0");
    const len = attr(tagsOf(q, "playlist")[0] || "", "length");
    console.log(
      "offset=: plays '" +
        val("title1") +
        "' (expected '" +
        vars.vaExpect +
        "'), queue entry " +
        val("song") +
        " of " +
        len +
        " (before the test: " +
        vars.vaLength +
        " entries)",
    );
    vars.vaTitle = val("title1");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("plays the song of the autoplayURL", () => expect(vars.vaTitle).to.equal(vars.vaExpect));
    test("plays from the queue (no streamUrl)", () => expect(/<streamUrl>/.test(body)).to.equal(false));
  },
});

request("P12 Load the saved queue", {
  url: `http://${env.host}:11000/Load?service=BluOS&name=__bluos_verify_add__`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("P13 Back to the former position", {
  url: `http://${env.host}:11000/Play`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500)); // let the player load the queue
    req.url = "http://" + env.host + ":11000/Play?seek=" + (vars.vaSecs || "0") + "&id=" + vars.vaSong;
  },
  async post() {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );

    // Pause again if the player was not playing before P01
    if (!["play", "stream"].includes(vars.vaState)) {
      await new Promise((r) => setTimeout(r, 1500));
      await get("/Pause");
    }
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("P14 Delete the saved queue playlist", {
  url: `http://${env.host}:11000/Delete?service=BluOS&name=__bluos_verify_add__`,
  async pre(req) {
    if (vars.vaSkip === "1") {
      req.skip();
      return;
    }
  },
  async post() {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    // The player needs a moment until it plays (or pauses) again: up to 10 s
    const playing = (x) => ["play", "stream"].includes(x);
    let s = "";
    const v = (t) => {
      const m = s.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? m[1] : "";
    };
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      s = await get("/Status");
      if (v("song") === vars.vaSong && playing(v("state")) === playing(vars.vaState)) break;
    }
    vars.vaLengthNow = attr(tagsOf(await get("/Playlist?start=0&end=0"), "playlist")[0] || "", "length");
    vars.vaSongNow = v("song");
    vars.vaStateNow = v("state");
    vars.vaPlaylistsNow = (await get("/Playlists?service=BluOS")).includes(">__bluos_verify_add__<") ? "1" : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const playing = (s) => ["play", "stream"].includes(s);
    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
    test("test playlist is gone", () => expect(vars.vaPlaylistsNow).to.equal(""));
    test("queue length as before P01", () => expect(vars.vaLengthNow).to.equal(vars.vaLength));
    test("queue position as before P01", () => expect(vars.vaSongNow).to.equal(vars.vaSong));
    test(`playing / paused as before P01 (${vars.vaState} → ${vars.vaStateNow})`, () =>
      expect(playing(vars.vaStateNow)).to.equal(playing(vars.vaState)));
  },
});

request("P15 Favourite an artist (AddFavourite artist=)", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    // First artist of the library that is no favourite; its context menu gives /AddFavourite?artist=…
    // (P15–P18 change no queue and run without P01)
    vars.vfArtist = "";
    const keys = (xml) =>
      tagsOf(xml, "item")
        .map((t) => attr(t, "browseKey"))
        .filter(Boolean);
    const open = async (key) => {
      let xml = await browse(key);
      while (/<browse\b[^>]*type="sections"/.test(xml) && keys(xml)[0]) xml = await browse(keys(xml)[0]);
      return xml;
    };
    const menu = keys(await browse("LocalMusic:"));
    const favKey = menu.find((k) => /Favourites/.test(k));
    vars.vfFavArtistsKey = (favKey ? keys(await browse(favKey)) : []).find((k) => /^LocalMusic:Artist\//.test(k)) || "";
    const artistsKey = menu.find((k) => /:Artist\//.test(k));
    const artist = artistsKey
      ? tagsOf(await open(artistsKey), "item").find(
          (t) =>
            attr(t, "type") === "artist" &&
            attr(t, "contextMenuKey") &&
            !/isFavourite=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    const add = artist
      ? tagsOf(await browse(attr(artist, "contextMenuKey")), "item").find((t) => attr(t, "type") === "favourite-add")
      : "";
    const url = add ? attr(add, "actionURL") : "";
    if (!/[?&]artist=/.test(url) || !vars.vfFavArtistsKey) {
      console.log("No artist without favourite, no /AddFavourite?artist= or no favourite artist list – skipped");
      req.skip();
      return;
    }
    vars.vfArtist = attr(artist, "text");
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-favourite-artist.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <favourite>added</favourite>", () =>
      expect(/<favourite\b[^>]*>added<\/favourite>/.test(body)).to.equal(true));
  },
});

request("P16 Favourite artists contain the artist", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    if (!vars.vfArtist || !vars.vfFavArtistsKey) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vfFavArtistsKey);
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    const body = String(res.body || "");
    // The artist in the favourite list and the remove action of its context menu
    const artist = tagsOf(body, "item").find((t) => attr(t, "type") === "artist" && attr(t, "text") === vars.vfArtist);
    const del = artist
      ? tagsOf(await browse(attr(artist, "contextMenuKey")), "item").find((t) => attr(t, "type") === "favourite-delete")
      : "";
    vars.vfUnfavUrl = del ? attr(del, "actionURL") : "";
    vars.vfMarked = artist && attr(artist, "isFavourite") === "true" ? "1" : "";
    console.log(
      "'" + vars.vfArtist + "' in the favourite artists: " + !!artist + "\nremove action: " + vars.vfUnfavUrl,
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the artist is a favourite now (isFavourite=true)", () => expect(vars.vfMarked).to.equal("1"));
    test("its menu removes it with /DeleteFavourite?artist=", () =>
      expect(/^\/DeleteFavourite\?(.*&)?artist=/.test(vars.vfUnfavUrl)).to.equal(true));
  },
});

request("P17 Remove the artist favourite (DeleteFavourite artist=)", {
  url: `http://${env.host}:11000/DeleteFavourite`,
  async pre(req) {
    if (!vars.vfUnfavUrl) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + vars.vfUnfavUrl;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-delete-favourite-artist.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <favourite>deleted</favourite>", () =>
      expect(/<favourite\b[^>]*>deleted<\/favourite>/.test(body)).to.equal(true));
  },
});

request("P18 Favourite artists no longer contain the artist", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    if (!vars.vfArtist || !vars.vfFavArtistsKey) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vfFavArtistsKey);
  },
  async post(req, res) {
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const body = String(res.body || "");
    vars.vfStillFav = tagsOf(body, "item").some(
      (t) => attr(t, "type") === "artist" && attr(t, "text") === vars.vfArtist,
    )
      ? "1"
      : "";
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the artist is no favourite any more", () => expect(vars.vfStillFav).to.equal(""));
  },
});

request("P19 Move entry 0 to position 3", {
  url: `http://${env.host}:11000/Move?new=3&old=0`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    // Queue entries in order: the content of every <song> without its id (same song = same text)
    const songs = (xml) =>
      [...xml.matchAll(/<song [^>]*>([\s\S]*?)<\/song>/g)].map((m) => dec(m[1]).replace(/\s+/g, " ").trim());
    // Queue before the move (P19–P22 change only the order and restore it; independent of P01)
    const xml = await get("/Playlist?start=0&end=199");
    const list = songs(xml);
    vars.vmOrder = "";
    if (list.length < 5 || +((xml.match(/<playlist [^>]*length="(\d+)"/) || [])[1] || 0) > 200) {
      console.log("Fewer than 5 or more than 200 queue entries – skipped");
      req.skip();
      return;
    }
    vars.vmOrder = JSON.stringify(list);
    vars.vmPid = (xml.match(/<playlist [^>]*id="(\d+)"/) || [])[1] || "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    // Queue entries in order: the content of every <song> without its id (same song = same text)

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <moved>", () => expect(/<moved>/.test(body)).to.equal(true));
  },
});

request("P20 Queue order after the move", {
  url: `http://${env.host}:11000/Playlist?start=0&end=199`,
  async pre(req) {
    if (!vars.vmOrder) req.skip();
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    // Queue entries in order: the content of every <song> without its id (same song = same text)
    const songs = (xml) =>
      [...xml.matchAll(/<song [^>]*>([\s\S]*?)<\/song>/g)].map((m) => dec(m[1]).replace(/\s+/g, " ").trim());
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const before = JSON.parse(vars.vmOrder || "[]"),
      want = [...before];
    // new = position afterwards: entry 0 is taken out and inserted at index 3
    want.splice(3, 0, want.splice(0, 1)[0]);
    test("entry 0 is now at position 3, entries 1–3 moved up by one", () => expect(songs(body)).to.deep.equal(want));
    test("queue id (pid) changed", () =>
      expect((body.match(/<playlist [^>]*id="(\d+)"/) || [])[1]).to.not.equal(vars.vmPid));
  },
});

request("P21 Move entry 3 back to position 0", {
  url: `http://${env.host}:11000/Move?new=0&old=3`,
  async pre(req) {
    if (!vars.vmOrder) req.skip();
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    // Queue entries in order: the content of every <song> without its id (same song = same text)

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <moved>", () => expect(/<moved>/.test(body)).to.equal(true));
  },
});

request("P22 Queue order restored", {
  url: `http://${env.host}:11000/Playlist?start=0&end=199`,
  async pre(req) {
    if (!vars.vmOrder) req.skip();
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    // Queue entries in order: the content of every <song> without its id (same song = same text)
    const songs = (xml) =>
      [...xml.matchAll(/<song [^>]*>([\s\S]*?)<\/song>/g)].map((m) => dec(m[1]).replace(/\s+/g, " ").trim());
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("order as before P19", () => expect(songs(body)).to.deep.equal(JSON.parse(vars.vmOrder || "[]")));
  },
});

request("P23 Favourite a library playlist and back (playlistid=)", {
  url: `http://${env.host}:11000/library/v1/Playlists`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 15000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    const menuOf = async (key) =>
      Object.fromEntries(tagsOf(await browse(key), "item").map((t) => [attr(t, "type"), attr(t, "actionURL")]));
    // Like the heart of the app: the first library playlist that is no favourite; /AddFavourite?playlistid= of its context
    // menu, the menu read again with &isFavourite=1 appended to the key (favourite-delete), /DeleteFavourite?playlistid=,
    // the menu without the flag (favourite-add). Changes no queue, runs without P01; skipped without a library playlist.
    const r = { skipped: true };
    vars.w38 = JSON.stringify(r);
    const plKey = tagsOf(await browse("LocalMusic:"), "item")
      .map((t) => attr(t, "browseKey"))
      .find((k) => /:Playlist\//.test(k));
    const pl = plKey
      ? tagsOf(await browse(plKey), "item").find(
          (t) => attr(t, "type") === "playlist" && !/isFavourite=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    if (!pl) {
      console.log("No library playlist without favourite – skipped");
      req.skip();
      return;
    }
    const cm = attr(pl, "contextMenuKey"),
      id = (cm.match(/[?&]playlistid=([^&]*)/) || [])[1] || "";
    const before = await menuOf(cm);
    r.skipped = false;
    r.addUrl = before["favourite-add"] || "";
    r.added = /<favourite\b[^>]*>added</.test(await get(r.addUrl));
    r.favList = (await get("/library/v1/Playlists?service=LocalMusic&category=FAVOURITES")).includes('id="' + id + '"');
    const on = await menuOf(cm + "&isFavourite=1");
    r.delUrl = on["favourite-delete"] || "";
    r.deleted = /<favourite\b[^>]*>deleted</.test(await get(r.delUrl));
    r.offMenu = !!(await menuOf(cm))["favourite-add"];
    r.id = id;
    vars.w38 = JSON.stringify(r);
    req.url = H + "/library/v1/Playlists?service=LocalMusic&category=FAVOURITES";
  },
  async post() {
    console.log(vars.w38);
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.w38);
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("add: /AddFavourite?playlistid=… of the context menu answers added", () => {
      expect(r.addUrl).to.match(/^\/AddFavourite\?playlistid=/);
      expect(r.added).to.equal(true);
    });
    test("the playlist is in category=FAVOURITES", () => expect(r.favList).to.equal(true));
    test("the context menu key with &isFavourite=1 at the end offers /DeleteFavourite?playlistid=", () =>
      expect(r.delUrl).to.match(/^\/DeleteFavourite\?playlistid=/));
    test("remove answers deleted; the menu offers favourite-add again; no longer a favourite", () => {
      expect(r.deleted).to.equal(true);
      expect(r.offMenu).to.equal(true);
      expect(body.includes('id="' + r.id + '"')).to.equal(false);
    });
  },
});

request("P24 Library id in Status follows a favourite", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            responseType: "text",
            transformResponse: (x) => x,
            validateStatus: () => true,
            timeout: 30000,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));
    const menuOf = async (key) =>
      Object.fromEntries(tagsOf(await browse(key), "item").map((t) => [attr(t, "type"), attr(t, "actionURL")]));
    const libId = async () =>
      ((await get("/library/v1/Albums?service=LocalMusic&section=all&length=1")).match(/<albums\b[^>]*\sid="(\d+)"/) ||
        [])[1] || "";
    const status = async (q = "") => {
      const s = await get("/Status" + q);
      return {
        mid: (s.match(/<mid>(\d*)</) || [])[1] || "",
        etag: (s.match(/<status\b[^>]*\setag="([^"]*)"/) || [])[1] || "",
      };
    };
    // Is <mid> of /Status the library version (root id of the /library/v1 answers), and does the long poll answer when
    // it changes? Favourites the first library album that is no favourite with the /AddFavourite of its context menu and
    // removes it again with /DeleteFavourite (menu key with &isFavourite=1); each time a long poll with the etag from
    // before is open. Changes no queue, runs without P01.
    const r = { skipped: true };
    vars.w39 = JSON.stringify(r);
    const albKey = tagsOf(await browse("LocalMusic:"), "item")
      .map((t) => attr(t, "browseKey"))
      .find((k) => /:bySection:Album\//.test(k));
    const secKey = albKey ? attr(tagsOf(await browse(albKey), "item")[0] || "", "browseKey") : "";
    const alb = secKey
      ? tagsOf(await browse(secKey), "item").find(
          (t) => attr(t, "type") === "album" && !/isFavourite=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    if (!alb) {
      console.log("No library album without favourite – skipped");
      req.skip();
      return;
    }
    r.skipped = false;
    r.album = attr(alb, "text");
    const cm = attr(alb, "contextMenuKey");
    // One change: long poll open, the command, then mid of the long poll answer, the library id and the time it took
    const step = async (url, word) => {
      const s = await status();
      const poll = status("?timeout=20&etag=" + encodeURIComponent(s.etag));
      await new Promise((z) => setTimeout(z, 1000));
      const t = Date.now();
      const ok = new RegExp("<favourite\\b[^>]*>" + word + "<").test(await get(url));
      const p = await poll;
      return { url, ok, before: s.mid, after: p.mid, lib: await libId(), ms: Date.now() - t };
    };
    r.start = { mid: (await status()).mid, lib: await libId() };
    r.add = await step((await menuOf(cm))["favourite-add"] || "", "added");
    r.del = await step((await menuOf(cm + "&isFavourite=1"))["favourite-delete"] || "", "deleted");
    vars.w39 = JSON.stringify(r);
  },
  async post() {
    console.log(vars.w39);
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.w39);
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("mid of /Status = library id", () => {
      expect(r.start.mid).to.match(/^\d+$/);
      expect(r.start.mid).to.equal(r.start.lib);
    });
    for (const [k, s] of [
      ["add", r.add],
      ["delete", r.del],
    ]) {
      test(k + ": command of the context menu succeeds", () => expect(s.ok).to.equal(true));
      test(k + ": mid changes with the library id", () => {
        expect(s.after).to.not.equal(s.before);
        expect(s.after).to.equal(s.lib);
      });
      test(k + ": the long poll answers at once (< 5 s)", () => expect(s.ms).to.be.below(5000));
    }
    test("mid of the current /Status = library id", () =>
      expect((body.match(/<mid>(\d*)</) || [])[1]).to.equal(r.del.lib));
  },
});
