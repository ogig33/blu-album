// 2 Write (changes the player): 15 requests in this order.

const { request, env, vars, http, save, dec, attr, expect } = require("../lib/player");

request("W01 Remember state", {
  url: `http://${env.host}:11000/Status`,
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    console.log(body);
    vars.vrState = val("state");
    vars.vrSong = val("song");
    vars.vrSecs = val("secs");
    vars.vrVolume = val("volume");
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("plays from the queue (no streamUrl)", () => expect(/<streamUrl>/.test(body)).to.equal(false));
  },
});

request("W02 Remember the first two queue entries", {
  url: `http://${env.host}:11000/Playlist?start=0&end=1`,
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
    const fns = (body.match(/<fn>([^<]*)<\/fn>/g) || []).map((x) => x.replace(/<\/?fn>/g, ""));
    vars.vrFirst = fns[0] || "";
    vars.vrSecond = fns[1] || "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("queue has at least 2 entries", () => expect(tags("song").length).to.equal(2));
  },
});

request("W03 Move entry 0 to position 1", {
  url: `http://${env.host}:11000/Move?new=1&old=0`,
  async pre(req) {
    if (!vars.vrSecond) req.skip();
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-move.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <moved>", () => expect(/<moved>/.test(body)).to.equal(true));
  },
});

request("W04 Queue order swapped", {
  url: `http://${env.host}:11000/Playlist?start=0&end=1`,
  async pre(req) {
    if (!vars.vrSecond) req.skip();
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const fns = (body.match(/<fn>([^<]*)<\/fn>/g) || []).map((x) => x.replace(/<\/?fn>/g, ""));
    test("former second entry is first now", () => expect(fns[0]).to.equal(vars.vrSecond));
  },
});

request("W05 Move it back", {
  url: `http://${env.host}:11000/Move?new=0&old=1`,
  async pre(req) {
    if (!vars.vrSecond) req.skip();
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <moved>", () => expect(/<moved>/.test(body)).to.equal(true));
  },
});

request("W06 Queue order restored", {
  url: `http://${env.host}:11000/Playlist?start=0&end=1`,
  async pre(req) {
    if (!vars.vrSecond) req.skip();
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const fns = (body.match(/<fn>([^<]*)<\/fn>/g) || []).map((x) => x.replace(/<\/?fn>/g, ""));
    test("original first entry is first again", () => expect(fns[0]).to.equal(vars.vrFirst));
  },
});

request("W07 Stop", {
  url: `http://${env.host}:11000/Stop`,
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-stop.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <state>stop</state>", () => expect(val("state")).to.equal("stop"));
  },
});

request("W08 Status is stopped", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 1500)); // give the player time to change state
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("state stop", () => expect(val("state")).to.equal("stop"));
  },
});

request("W09 Next preset", {
  url: `http://${env.host}:11000/Preset?id=+1`,
  async pre(req) {
    // Skipped without a preset (W10 and W11 as well)
    const p = await http.get("http://" + env.host + ":11000/Presets", {
      responseType: "text",
      transformResponse: (x) => x,
      validateStatus: () => true,
      timeout: 10000,
    });
    vars.vrPreset = /<preset\b/.test(String(p.data || "")) ? "1" : "";
    if (!vars.vrPreset) {
      console.log("No preset – W09–W11 skipped");
      req.skip();
    }
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-preset-next.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <state> or <loaded>", () => expect(/<state>|<loaded/.test(body)).to.equal(true));
  },
});

request("W10 Status of the preset", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    if (!vars.vrPreset) {
      vars.vrSkipUrl = "";
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    // A radio stream may stay "connecting" for several seconds: wait until it plays (at most 20 s)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const s = await http.get(H + "/Status", {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        timeout: 5000,
      });
      if (/<state>(play|stream)<\/state>/.test(String(s.data || ""))) break;
    }
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-status-preset.xml");
    console.log(body);
    const skip = tags("action").find((t) => attr(t, "name") === "skip" && attr(t, "url"));
    vars.vrSkipUrl = skip ? attr(skip, "url") : "";
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("playing (play or stream)", () => expect(["play", "stream"]).to.include(val("state")));
  },
});

request("W11 Radio action skip", {
  url: `http://${env.host}:11000/Action`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const u = vars.vrSkipUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url = H + u;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-action-skip.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("W12 Back to the queue entry", {
  url: `http://${env.host}:11000/Play`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const song = vars.vrSong,
      secs = vars.vrSecs || "0";
    if (song === undefined || song === "") {
      req.skip();
      return;
    }
    req.url = H + "/Play?seek=" + secs + "&id=" + song;
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-play-seek-id.xml");
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer has <state>", () => expect(/<state>/.test(body)).to.equal(true));
  },
});

request("W13 Status is on the queue entry again", {
  url: `http://${env.host}:11000/Status`,
  async pre() {
    await new Promise((r) => setTimeout(r, 2000)); // give the player time to change state
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("same queue position as before", () => expect(val("song")).to.equal(vars.vrSong));
    test("plays from the queue again (no streamUrl)", () => expect(/<streamUrl>/.test(body)).to.equal(false));
  },
});

request("W14 Pause again (if it was not playing)", {
  url: `http://${env.host}:11000/Pause`,
  async pre(req) {
    if (["play", "stream"].includes(vars.vrState)) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500)); // let playback settle after the seek
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-pause.xml");
    console.log("state before the test: " + vars.vrState);
    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("answer <state>pause</state>", () => expect(val("state")).to.equal("pause"));
  },
});

request("W15 Volume restore", {
  url: `http://${env.host}:11000/Volume`,
  async pre(req) {
    const H = "http://" + env.host + ":11000";
    const v = vars.vrVolume;
    if (!v) {
      req.skip();
      return;
    }
    req.url = H + "/Volume?level=" + v;
  },
  async post(req, res) {
    const body = String(res.body || "");

    console.log(body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("volume restored", () => expect((body.match(/>(\d+)<\/volume>/) || [])[1]).to.equal(vars.vrVolume));
  },
});
