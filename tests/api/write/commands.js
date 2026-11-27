// 2 Write (changes the player): 47 requests in this order.

const { request, env, vars, save, attr, expect } = require("../lib/player");

request("C01 Remember state", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    vars.volBefore = val("volume");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("status readable", () => expect(val("volume")).to.not.equal(""));
  },
});

request("C02 Remember queue", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    vars.queueBefore = attr(tags("playlist")[0] || "", "length") || "0";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("queue is not empty (play an album first)", () =>
      expect(+attr(tags("playlist")[0] || "", "length")).to.be.above(0));
  },
});

request("C03 Save queue as test playlist", {
  url: `http://${env.host}:11000/Save?name=__bluos_album_player_test__`,
  async pre(req) {
    if (vars.queueBefore === "0") {
      req.skip();
      return;
    }
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("<saved><entries>N</entries> with N > 0", () => {
      const m = body.match(/<entries>(\d+)<\/entries>/);
      expect(m && +m[1]).to.be.above(0);
    });
  },
});

request("C04 Test playlist exists", {
  url: `http://${env.host}:11000/Playlists`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("test playlist is listed", () =>
      expect(/<name\b[^>]*>__bluos_album_player_test__<\/name>/.test(body)).to.equal(true));
  },
});

request("C05 Favourite toggle", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    // Favourite action of the album from "09 Album context menu" (Read folder)
    const url = vars.favUrl;
    if (!url) {
      req.skip();
      return;
    }
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    saveFixture("verify-favourite-toggle.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C06 Favourite state changed", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    // Context menu again: it must now offer the opposite action
    const cm = vars.albumCm;
    if (!cm || !vars.favUrl) {
      req.skip();
      return;
    }
    const was = /DeleteFavourite/.test(vars.favUrl);
    const k = cm.replace(/[&?]isFavourite=1/, "") + (was ? "" : "&isFavourite=1");
    req.url = H + "/Browse?key=" + encodeURIComponent(k) + "&withContextMenuItems=1";
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    const items = (type) => tags("item").filter((t) => !type || attr(t, "type") === type);
    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("opposite favourite action offered", () => {
      const was = /DeleteFavourite/.test(vars.favUrl);
      expect(items(was ? "favourite-add" : "favourite-delete").length).to.be.above(0);
    });
  },
});

request("C07 Favourite restore", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const url = vars.favUrl;
    if (!url) {
      req.skip();
      return;
    }
    req.url =
      H +
      (/DeleteFavourite/.test(url)
        ? url.replace("/DeleteFavourite", "/AddFavourite")
        : url.replace("/AddFavourite", "/DeleteFavourite"));
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    saveFixture("verify-favourite-restore.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C08 Play album now", {
  url: `http://${env.host}:11000/Add`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    // playURL of the album from "07 Albums of a section" (cover play button)
    const url = vars.albumPlay;
    if (!url) {
      req.skip();
      return;
    }
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    saveFixture("verify-add-play-album.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C09 Status is playing the album", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    // C08 did not play an album (no album from folder 1, e.g. folder 2 run alone)
    if (!vars.albumPlay) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("state play/stream", () => expect(val("state")).to.match(/^(play|stream)$/));
    test("title3 is the album", () => expect(val("title3").replace(/&amp;/g, "&")).to.equal(vars.albumTitle));
  },
});

request("C10 Pause toggle", {
  url: `http://${env.host}:11000/Pause?toggle=1`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("C11 Status is paused", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("state pause", () => expect(val("state")).to.equal("pause"));
  },
});

request("C12 Pause toggle again (resume)", {
  url: `http://${env.host}:11000/Pause?toggle=1`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("C13 Status is playing again", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    vars.songBefore = val("song");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("state play/stream", () => expect(val("state")).to.match(/^(play|stream)$/));
  },
});

request("C14 Skip to next track", {
  url: `http://${env.host}:11000/Skip`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C15 Status is on the next track", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("song index + 1", () => expect(+val("song")).to.equal(+vars.songBefore + 1));
  },
});

request("C16 Back", {
  url: `http://${env.host}:11000/Back`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C17 Play queue entry 3", {
  url: `http://${env.host}:11000/Play?id=2`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("C18 Status is on track 3", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("song index 2", () => expect(val("song")).to.equal("2"));
  },
});

request("C19 Seek to 0:30", {
  url: `http://${env.host}:11000/Play?seek=30`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("C20 Status position after seek", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("position about 30 s", () => expect(+val("secs")).to.be.above(28));
  },
});

request("C21 Remember queue length", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    vars.queueLen = attr(tags("playlist")[0] || "", "length") || "0";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("length readable", () => expect(attr(tags("playlist")[0] || "", "length")).to.match(/^\d+$/));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id readable", () => expect(pidNow).to.match(/^\d+$/));
    vars.pid = pidNow;
  },
});

request("C22 Add album to end of queue", {
  url: `http://${env.host}:11000/Add`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    // addAll-last action of the album (cover / popup "Add last")
    const url = vars.albumAddLast;
    if (!url) {
      req.skip();
      return;
    }
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    saveFixture("verify-add-album-last.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C23 Queue got longer", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async pre(req) {
    // C22 did not add an album (no album from folder 1, e.g. folder 2 run alone); C24–C25 skip too
    if (!vars.albumAddLast) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    vars.queueLen2 = attr(tags("playlist")[0] || "", "length") || "0";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("length increased", () => expect(+attr(tags("playlist")[0] || "", "length")).to.be.above(+vars.queueLen));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after adding an album", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C24 Remove last queue entry", {
  url: `http://${env.host}:11000/Delete`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    // Removes the album entry added by C22; without it the queue stays as it is
    if (!vars.albumAddLast) {
      req.skip();
      return;
    }
    req.url = H + "/Delete?id=" + (+vars.queueLen2 - 1);
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C25 Queue got shorter", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async pre(req) {
    if (!vars.albumAddLast) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("length decreased by 1", () =>
      expect(+attr(tags("playlist")[0] || "", "length")).to.equal(+vars.queueLen2 - 1));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after removing an entry", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C26 Shuffle on", {
  url: `http://${env.host}:11000/Shuffle?state=1`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C27 Status shows shuffle on", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<shuffle>1</shuffle>", () => expect(val("shuffle")).to.equal("1"));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after shuffle on", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C28 Shuffle off", {
  url: `http://${env.host}:11000/Shuffle?state=0`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C29 Status shows shuffle off", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<shuffle>0</shuffle>", () => expect(val("shuffle")).to.equal("0"));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after shuffle off", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C30 Remember repeat", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    vars.repeatBefore = val("repeat");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<repeat> is 0, 1 or 2", () => expect(val("repeat")).to.match(/^[012]$/));
  },
});

request("C31 Repeat queue", {
  url: `http://${env.host}:11000/Repeat?state=0`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-repeat.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C32 Status shows repeat queue", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<repeat>0</repeat>", () => expect(val("repeat")).to.equal("0"));
  },
});

request("C33 Repeat track", {
  url: `http://${env.host}:11000/Repeat?state=1`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C34 Status shows repeat track", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<repeat>1</repeat>", () => expect(val("repeat")).to.equal("1"));
  },
});

request("C35 Repeat off", {
  url: `http://${env.host}:11000/Repeat?state=2`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C36 Status shows repeat off", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("<repeat>2</repeat>", () => expect(val("repeat")).to.equal("2"));
  },
});

request("C37 Repeat restore", {
  url: `http://${env.host}:11000/Repeat`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const v = vars.repeatBefore;
    if (!v) {
      req.skip();
      return;
    }
    req.url = H + "/Repeat?state=" + v;
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C38 Volume set to 10", {
  url: `http://${env.host}:11000/Volume?level=10`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("volume is 10", () => expect(+(body.match(/>(\d+)<\/volume>/) || [])[1]).to.equal(10));
  },
});

request("C39 Volume up (+2 dB)", {
  url: `http://${env.host}:11000/Volume?db=2`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("volume above 10", () => expect(+(body.match(/>(\d+)<\/volume>/) || [])[1]).to.be.above(10));
  },
});

request("C40 Volume down (-2 dB)", {
  url: `http://${env.host}:11000/Volume?db=-2`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("answer has a volume", () => expect(/<volume\b/.test(body)).to.equal(true));
  },
});

request("C41 Volume restore", {
  url: `http://${env.host}:11000/Volume`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const v = vars.volBefore;
    if (!v) {
      req.skip();
      return;
    }
    req.url = H + "/Volume?level=" + v;
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("volume restored", () => expect((body.match(/>(\d+)<\/volume>/) || [])[1]).to.equal(vars.volBefore));
  },
});

request("C42 Clear queue", {
  url: `http://${env.host}:11000/Clear`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C43 Queue is empty", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("length 0", () => expect(attr(tags("playlist")[0] || "", "length") || "0").to.equal("0"));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after clearing the queue", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C44 Load test playlist (restores the queue)", {
  url: `http://${env.host}:11000/Load?service=BluOS&name=__bluos_album_player_test__`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    saveFixture("verify-load.xml");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C45 Queue restored from playlist", {
  url: `http://${env.host}:11000/Playlist?start=0&end=0`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? m[1] : "";
    };

    test("same length as before the tests", () =>
      expect(attr(tags("playlist")[0] || "", "length")).to.equal(vars.queueBefore));
    test("queue reports the playlist name", () =>
      expect(attr(tags("playlist")[0] || "", "name")).to.equal("__bluos_album_player_test__"));

    // Playlist id (/Playlist id = <pid> of /Status): the app reloads the queue only when it changes
    const pidNow = attr(tags("playlist")[0] || "", "id") || val("pid");
    test("playlist id changed after loading a playlist", () => expect(pidNow).to.not.equal(vars.pid));
    vars.pid = pidNow;
  },
});

request("C46 Delete test playlist", {
  url: `http://${env.host}:11000/Delete?service=BluOS&name=__bluos_album_player_test__`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("accepted", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("C47 Test playlist is gone", {
  url: `http://${env.host}:11000/Playlists`,
  async post() {},
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));

    test("test playlist is no longer listed", () =>
      expect(/<name\b[^>]*>__bluos_album_player_test__<\/name>/.test(body)).to.equal(false));
  },
});
