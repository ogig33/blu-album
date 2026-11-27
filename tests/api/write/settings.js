// 2 Write (changes the player): 47 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("S01 Player settings (remember ledbrightness)", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=player`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const v = attr(setting("ledbrightness"), "value");
    vars.vsLed = v;
    vars.vsLedNew = v === "dim" ? "default" : "dim";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("has ledbrightness", () => expect(attr(setting("ledbrightness"), "value")).to.not.equal(""));
  },
});

request("S02 setting ledbrightness (change)", {
  url: `http://${env.host}:11000/setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsLed) {
      req.skip();
      return;
    }
    req.url = H + "/setting?ledbrightness=" + vars.vsLedNew;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-setting.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S03 Player settings show the new value", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=player`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("ledbrightness changed", () => expect(attr(setting("ledbrightness"), "value")).to.equal(vars.vsLedNew));
  },
});

request("S04 setting ledbrightness (restore)", {
  url: `http://${env.host}:11000/setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsLed) {
      req.skip();
      return;
    }
    req.url = H + "/setting?ledbrightness=" + vars.vsLed;
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S05 Player settings restored", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=player`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("ledbrightness restored", () => expect(attr(setting("ledbrightness"), "value")).to.equal(vars.vsLed));
  },
});

request("S06 Audio settings (remember values)", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const rg = attr(setting("replayGainMode"), "value"),
      bal = attr(setting("eq-balance"), "value");
    vars.vsRg = rg;
    vars.vsRgNew = rg === "album" ? "track" : "album";
    vars.vsBal = bal;
    vars.vsBalNew = parseFloat(bal) === 0 ? "0.5" : "0";
    const trim = tags("setting").find((t) => /\/SlaveVolume\?/.test(attr(t, "url"))) || "";
    vars.vsTrimUrl = attr(trim, "url");
    vars.vsTrim = attr(trim, "value");
    vars.vsTrimNew = parseFloat(attr(trim, "value") || "0") === 0 ? "1" : "0";
    vars.vsTrimId = attr(trim, "id");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("has replayGainMode and eq-balance", () => {
      expect(attr(setting("replayGainMode"), "value")).to.not.equal("");
      expect(attr(setting("eq-balance"), "value")).to.not.equal("");
    });
  },
});

request("S07 audiomodes replayGainMode (change)", {
  url: `http://${env.host}:11000/audiomodes`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsRg) {
      req.skip();
      return;
    }
    req.url = H + "/audiomodes?replayGainMode=" + vars.vsRgNew;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-audiomodes.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S08 Audio settings show the new replay gain", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("replayGainMode changed", () => expect(attr(setting("replayGainMode"), "value")).to.equal(vars.vsRgNew));
  },
});

request("S09 audiomodes replayGainMode (restore)", {
  url: `http://${env.host}:11000/audiomodes`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsRg) {
      req.skip();
      return;
    }
    req.url = H + "/audiomodes?replayGainMode=" + vars.vsRg;
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S10 Audio settings: replay gain restored", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("replayGainMode restored", () => expect(attr(setting("replayGainMode"), "value")).to.equal(vars.vsRg));
  },
});

request("S11 alsa_setting eq-balance (change)", {
  url: `http://${env.host}:11000/alsa_setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsBal) {
      req.skip();
      return;
    }
    req.url = H + "/alsa_setting?eq-balance=" + vars.vsBalNew;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-alsa-setting.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S12 Audio settings show the new balance", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("eq-balance changed", () =>
      expect(parseFloat(attr(setting("eq-balance"), "value"))).to.equal(parseFloat(vars.vsBalNew)));
  },
});

request("S13 alsa_setting eq-balance (restore)", {
  url: `http://${env.host}:11000/alsa_setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsBal) {
      req.skip();
      return;
    }
    req.url = H + "/alsa_setting?eq-balance=" + vars.vsBal;
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S14 Audio settings: balance restored", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const setting = (name) => tags("setting").find((t) => attr(t, "name") === name) || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("eq-balance restored", () =>
      expect(parseFloat(attr(setting("eq-balance"), "value"))).to.equal(parseFloat(vars.vsBal)));
  },
});

request("S15 SlaveVolume trim of a group member (change)", {
  url: `http://${env.host}:11000/SlaveVolume`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const u = vars.vsTrimUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url = H + u + "&db=" + vars.vsTrimNew;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-slavevolume.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S16 Audio settings show the new trim", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre(req) {
    if (!vars.vsTrimUrl) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const t = tags("setting").find((x) => attr(x, "id") === vars.vsTrimId) || "";
    test("trim changed", () => expect(parseFloat(attr(t, "value"))).to.equal(parseFloat(vars.vsTrimNew)));
  },
});

request("S17 SlaveVolume trim (restore)", {
  url: `http://${env.host}:11000/SlaveVolume`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const u = vars.vsTrimUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url = H + u + "&db=" + (vars.vsTrim || "0");
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S18 Audio settings: trim restored", {
  url: `http://${env.host}:11000/Settings?schemaVersion=36&id=audio`,
  async pre(req) {
    if (!vars.vsTrimUrl) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const t = tags("setting").find((x) => attr(x, "id") === vars.vsTrimId) || "";
    test("trim restored", () => expect(parseFloat(attr(t, "value"))).to.equal(parseFloat(vars.vsTrim || "0")));
  },
});

request("S19 proxyToSlave SyncStatus of a group member (read)", {
  url: `http://${env.host}:11000/proxyToSlave`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const u = vars.vsTrimUrl || "";
    const slave = (u.match(/[?&]slave=([^&]*)/) || [])[1];
    if (!slave) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/proxyToSlave?slave=" +
      encodeURIComponent(decodeURIComponent(slave)) +
      "&url=" +
      encodeURIComponent("/SyncStatus");
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-proxytoslave-syncstatus.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is the SyncStatus of the member", () => expect(tags("SyncStatus").length).to.equal(1));
  },
});

request("S20 Backup of the saved playlists (port 80, download)", {
  url: `http://${env.host}:80/download_playlists_api`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-download-playlists.txt");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    console.log(
      "content-type: " +
        res.header("content-type") +
        ", content-disposition: " +
        res.header("content-disposition") +
        ", length: " +
        body.length,
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S21 redirectToCp to the services page", {
  url: `http://${env.host}:11000/redirectToCp?href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-redirecttocp.html");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S22 Wi-Fi settings page (port 80)", {
  url: `http://${env.host}:80/wificfg?noheader=1`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-wificfg.html");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is an HTML page", () => expect(/<html/i.test(body)).to.equal(true));
  },
});

request("S23 IR learning page (port 80)", {
  url: `http://${env.host}:80/triggercfg?noheader=1&playnum=1`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-triggercfg.html");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer is an HTML page", () => expect(/<html/i.test(body)).to.equal(true));
  },
});

request("S24 Status (remember infourl)", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    vars.vsInfoUrl = val("infourl");
    vars.vsService = val("service");
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S25 Info for the playing item (infourl)", {
  url: `http://${env.host}:11000/Info`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const u = vars.vsInfoUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url = H + "/Info?service=" + encodeURIComponent(vars.vsService) + "&infourl=" + encodeURIComponent(u);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-info-infourl.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S26 Save the queue as test playlist", {
  url: `http://${env.host}:11000/Save?name=__bluos_verify__`,
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const H = "http://" + env.host + ":11000";
    const countSongs = async () => {
      let n = 0,
        next = H + "/Songs?service=BluOS&playlist=" + encodeURIComponent("__bluos_verify__");
      for (let i = 0; next && i < 100; i++) {
        const r = await http.get(next, { responseType: "text", transformResponse: (x) => x });
        const x = String(r.data || "");
        n += (x.match(/<song\b/g) || []).length;
        const l = (x.match(/<nextlink>([^<]*)<\/nextlink>/) || [])[1];
        next = l ? H + l.replace(/&amp;/g, "&") : "";
      }
      return n;
    };
    vars.vsPlBefore = String(await countSongs());
    console.log("songs in the test playlist: " + vars.vsPlBefore);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("saved with entries", () => expect(parseInt(val("entries") || "0")).to.be.above(0));
  },
});

request("S27 First new album (library)", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&recent=1`,
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const a = (body.match(/<album\b[^>]*>([\s\S]*?)<\/album>/) || [])[1] || "";
    const pick = (t) => {
      const m = a.match(new RegExp("<" + t + ">([^<]*)</" + t + ">"));
      return m ? dec(m[1]) : "";
    };
    vars.vsAlbum = pick("alb") || pick("title");
    vars.vsArtist = pick("art");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("at least one album", () => expect(tags("album").length).to.be.above(0));
  },
});

request("S28 Add to playlist options (album)", {
  url: `http://${env.host}:11000/AddToPlaylistOptions`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const al = vars.vsAlbum;
    if (!al) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/AddToPlaylistOptions?service=LocalMusic&album=" +
      encodeURIComponent(al) +
      "&artist=" +
      encodeURIComponent(vars.vsArtist);
  },
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const params = (body.match(/<requestParameter>([^<]*)<\/requestParameter>/g) || []).map((x) =>
      dec(x.replace(/<\/?requestParameter>/g, "")),
    );
    vars.vsAddUrl = val("urlPath") + "?" + params.join("&");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("has urlPath", () => expect(val("urlPath")).to.not.equal(""));
  },
});

request("S29 AddToPlaylist album to the test playlist (name= is a guess)", {
  url: `http://${env.host}:11000/AddToPlaylist`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    const u = vars.vsAddUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url = H + u + "&name=" + encodeURIComponent("__bluos_verify__");
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-addtoplaylist.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const H = "http://" + env.host + ":11000";
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
    const countSongs = async () => {
      let n = 0,
        next = H + "/Songs?service=BluOS&playlist=" + encodeURIComponent("__bluos_verify__");
      for (let i = 0; next && i < 100; i++) {
        const r = await http.get(next, { responseType: "text", transformResponse: (x) => x });
        const x = String(r.data || "");
        n += (x.match(/<song\b/g) || []).length;
        const l = (x.match(/<nextlink>([^<]*)<\/nextlink>/) || [])[1];
        next = l ? H + l.replace(/&amp;/g, "&") : "";
      }
      return n;
    };
    vars.vsPlAfter = String(await countSongs());
    console.log("songs before: " + vars.vsPlBefore + ", after: " + vars.vsPlAfter);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
    test("test playlist got longer", () =>
      expect(parseInt(vars.vsPlAfter || "0")).to.be.above(parseInt(vars.vsPlBefore || "0")));
  },
});

request("S30 Delete the test playlist", {
  url: `http://${env.host}:11000/Delete?service=BluOS&name=__bluos_verify__`,
  async post(req, res) {
    const body = String(res.body || "");

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S31 Remember the player name", {
  url: `http://${env.host}:11000/Name`,
  async post(req, res) {
    const body = String(res.body || "");
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    console.log(body);
    vars.vsName = name.replace(/&amp;/g, "&");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("has a name", () => expect(name).to.not.equal(""));
  },
});

request("S32 Rename the player (test name)", {
  url: `http://${env.host}:11000/Name`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.vsName) {
      req.skip();
      return;
    }
    req.url = H + "/Name?set=" + encodeURIComponent(vars.vsName + " test");
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S33 Player has the test name", {
  url: `http://${env.host}:11000/Name`,
  async pre(req) {
    if (!vars.vsName) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("name changed", () => expect(name.replace(/&amp;/g, "&")).to.equal(vars.vsName + " test"));
  },
});

request("S34 Rename the player back", {
  url: `http://${env.host}:11000/Name`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.vsName) {
      req.skip();
      return;
    }
    req.url = H + "/Name?set=" + encodeURIComponent(vars.vsName);
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S35 Player name restored", {
  url: `http://${env.host}:11000/Name`,
  async pre(req) {
    if (!vars.vsName) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const name = (body.match(/<name>([^<]*)<\/name>/) || [])[1] || "";
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("name restored", () => expect(name.replace(/&amp;/g, "&")).to.equal(vars.vsName));
  },
});

request("S41 Listening mode (remember)", {
  url: `http://${env.host}:11000/audioPreset`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    req.url = H + "/audioPreset";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";
    const modes = tags("value")
      .map((t) => ({ name: attr(t, "name"), label: attr(t, "displayName") }))
      .filter((m) => m.name);
    const cur = attr(preset, "value");
    const other = (modes.find((m) => m.name !== cur) || {}).name || "";
    vars.lmBefore = cur && other ? cur : "";
    vars.lmNew = other;
    console.log("current " + cur + ", test switches to " + (other || "(none, S42–S47 skipped)"));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";
    const modes = tags("value")
      .map((t) => ({ name: attr(t, "name"), label: attr(t, "displayName") }))
      .filter((m) => m.name);
    test("current mode and another one", () => {
      expect(attr(preset, "value")).to.not.equal("");
      expect(modes.length).to.be.above(1);
    });
  },
});

request("S42 Status (remember etag)", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    req.url = H + "/Status";
  },
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-status-before-listening-mode.xml");
    vars.lmEtag = (body.match(/<status etag="([^"]*)"/) || [])[1] || "";
    vars.lmStatus = body;
    console.log("etag " + vars.lmEtag + ", state " + val("state"));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("status with etag", () => expect(/<status etag="[^"]+"/.test(body)).to.equal(true));
  },
});

request("S43 alsa_setting preset (change)", {
  url: `http://${env.host}:11000/alsa_setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    req.url = H + "/alsa_setting?preset=" + encodeURIComponent(vars.lmNew);
  },
  async post(req, res) {
    let body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    body = "HTTP " + res.status + "\n" + JSON.stringify(res.headers) + "\n\n" + body;
    saveFixture("verify-alsa-setting-preset.txt");
    console.log("HTTP " + res.status + " (" + body.length + " bytes)\n" + body.slice(0, 1000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 205 (Reset Content, empty body)", () => expect(res.status).to.equal(205));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S44 Status long poll after the change", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    // Long poll with the etag of S42: an answer well before the timeout means /Status reports the
    // change, so the footer could follow the listening mode without extra polling.
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    req.url = H + "/Status?timeout=10&etag=" + vars.lmEtag;
    req.timeout = 20000;
    vars.lmT0 = String(Date.now());
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-status-after-listening-mode.xml");
    const fields = (b) => {
      const o = {};
      (b.match(/<([A-Za-z0-9]+)>([^<]*)<\/\1>/g) || []).forEach((t) => {
        const m = t.match(/<([A-Za-z0-9]+)>([^<]*)</);
        o[m[1]] = m[2];
      });
      return o;
    };
    const a = fields(vars.lmStatus || ""),
      b = fields(body);
    const diff = Object.keys(Object.assign({}, a, b))
      .filter((k) => a[k] !== b[k])
      .map((k) => k + ": " + (a[k] ?? "–") + " → " + (b[k] ?? "–"));
    const etag = (body.match(/<status etag="([^"]*)"/) || [])[1] || "";
    const ms = res.time;
    console.log(
      "answer after " +
        ms +
        " ms, etag " +
        (etag !== vars.lmEtag ? "CHANGED" : "unchanged") +
        " (" +
        vars.lmEtag +
        " → " +
        etag +
        ")" +
        "\nchanged fields: " +
        (diff.join("; ") || "none") +
        "\nnew mode " +
        vars.lmNew +
        " in body: " +
        new RegExp(vars.lmNew, "i").test(body),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("status answer", () => expect(/<status/.test(body)).to.equal(true));
    // Verified 2026-11-15: the listening mode is not in /Status, but the change gives a new etag and syncStat + 1
    const before = vars.lmStatus || "";
    const num = (b, t) => Number((b.match(new RegExp("<" + t + ">([^<]*)<")) || [])[1]);
    test("etag changed", () => expect((body.match(/<status etag="([^"]*)"/) || [])[1]).to.not.equal(vars.lmEtag));
    test("syncStat increased", () => expect(num(body, "syncStat")).to.be.above(num(before, "syncStat")));
  },
});

request("S45 Listening mode shows the new mode", {
  url: `http://${env.host}:11000/audioPreset`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
    req.url = H + "/audioPreset";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";

    console.log("current " + attr(preset, "value"));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";

    test("mode changed", () => expect(attr(preset, "value")).to.equal(vars.lmNew));
  },
});

request("S46 alsa_setting preset (restore)", {
  url: `http://${env.host}:11000/alsa_setting`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    req.url = H + "/alsa_setting?preset=" + encodeURIComponent(vars.lmBefore);
  },
  async post(req, res) {
    let body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    body = "HTTP " + res.status + "\n" + JSON.stringify(res.headers) + "\n\n" + body;
    saveFixture("verify-alsa-setting-preset-restore.txt");
    console.log("HTTP " + res.status);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 205 (Reset Content, empty body)", () => expect(res.status).to.equal(205));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("S47 Listening mode restored", {
  url: `http://${env.host}:11000/audioPreset`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    if (!vars.lmBefore) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000)); // give the player time
    req.url = H + "/audioPreset";
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";

    console.log("current " + attr(preset, "value"));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const preset = tags("setting").find((t) => attr(t, "name") === "preset") || "";

    test("mode restored", () => expect(attr(preset, "value")).to.equal(vars.lmBefore));
  },
});

request("S48 Status (remember shuffle)", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    const sh = (body.match(/<shuffle>([^<]*)</) || [])[1] || "";
    vars.vsShuffle = sh;
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const sh = (body.match(/<shuffle>([^<]*)</) || [])[1] || "";
    test("has shuffle", () => expect(sh).to.match(/^[01]$/));
  },
});

request("S49 Shuffle on (for the next step)", {
  url: `http://${env.host}:11000/Shuffle`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsShuffle) {
      req.skip();
      return;
    }
    req.url = H + "/Shuffle?state=1";
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-shuffle-on.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S50 Shuffle without state", {
  url: `http://${env.host}:11000/Shuffle`,
  async pre(req) {
    if (!vars.vsShuffle) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-shuffle-nostate.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("S51 Status shows shuffle off", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    if (!vars.vsShuffle) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const sh = (body.match(/<shuffle>([^<]*)</) || [])[1] || "";
    test("shuffle is off after /Shuffle without state", () => expect(sh).to.equal("0"));
  },
});

request("S52 Shuffle restore", {
  url: `http://${env.host}:11000/Shuffle`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";

    if (!vars.vsShuffle) {
      req.skip();
      return;
    }
    req.url = H + "/Shuffle?state=" + vars.vsShuffle;
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});
