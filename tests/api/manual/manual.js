// 3 Manual (run on purpose): 45 requests in this order.

const { request, env, vars, http, save, dec, attr, expect, ROOT } = require("../lib/player");

request("M01 Doorbell (plays the chime)", {
  url: `http://${env.host}:11000/Doorbell?play=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-doorbell.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    // Players without a doorbell chime (e.g. the Powernode) answer <error>Not supported</error>
    test("answer <status> with chime, or Not supported", () =>
      expect(attr(tags("status")[0] || "", "chime") !== "" || /<error>Not supported<\/error>/.test(body)).to.equal(
        true,
      ));
  },
});

request("M02 Reindex the library", {
  url: `http://${env.host}:11000/Reindex`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-reindex.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("M03 Status while indexing", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }

    await new Promise((r) => setTimeout(r, 3000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    const val = (tag) => {
      const m = body.match(new RegExp("<" + tag + ">([^<]*)</" + tag + ">"));
      return m ? dec(m[1]) : "";
    };

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-status-indexing.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    console.log("indexing: " + val("indexing"));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("M04 Presets (remember the first one)", {
  url: `http://${env.host}:11000/Presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
    const p = tags("preset")[0] || "";
    vars.vsPresetUrl = attr(p, "url");
    vars.vsPresetImage = attr(p, "image");
    vars.vsPresetCount = String(tags("preset").length);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("at least one preset", () => expect(tags("preset").length).to.be.above(0));
  },
});

request("M05 SetPreset test preset (delete it in the BluOS app afterwards)", {
  url: `http://${env.host}:11000/SetPreset`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";

    const u = vars.vsPresetUrl;
    if (!u) {
      req.skip();
      return;
    }
    req.url =
      H +
      "/SetPreset?name=" +
      encodeURIComponent("__bluos_verify__") +
      "&url=" +
      encodeURIComponent(u) +
      "&image=" +
      encodeURIComponent(vars.vsPresetImage || "");
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-setpreset.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("M06 Presets contain the test preset", {
  url: `http://${env.host}:11000/Presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }

    await new Promise((r) => setTimeout(r, 1000)); // give the player time
  },
  async post(req, res) {
    const body = String(res.body || "");

    const saveFixture = (file) => save(file, body);
    saveFixture("verify-presets-after-setpreset.xml");
    console.log("HTTP " + res.status + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("preset __bluos_verify__ exists", () =>
      expect(tags("preset").some((t) => attr(t, "name") === "__bluos_verify__")).to.equal(true));
  },
});

request("M07 Reboot", {
  method: "POST",
  url: `http://${env.host}:80/reboot`,
  form: { yes: "1" },
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    // Official: soft reboot, POST to port 80 with the form field yes (any value)
    const body = String(res.body || "");
    const saveFixture = (file) => save(file, body);
    saveFixture("verify-reboot.html");
    vars.rebootAt = String(Date.now());
    console.log("HTTP " + res.status + ", content-type: " + res.header("content-type") + "\n" + body.slice(0, 2000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("M08 Player is back", {
  url: `http://${env.host}:11000/SyncStatus`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Waits until the player answers again (every 5 s, at most 5 minutes).
    const H = "http://" + env.host + ":11000";
    await new Promise((r) => setTimeout(r, 10000)); // the player needs a moment to go down
    const start = Date.now();
    let up = false;
    while (!up && Date.now() - start < 300000) {
      try {
        const r = await http.get(H + "/SyncStatus", {
          timeout: 3000,
          responseType: "text",
          transformResponse: (x) => x,
        });
        up = /<SyncStatus/.test(String(r.data || ""));
      } catch {
        /* not up yet */
      }
      if (!up) await new Promise((r) => setTimeout(r, 5000));
    }
    const at = parseInt(vars.rebootAt || "0");
    vars.rebootSeconds = at ? String(Math.round((Date.now() - at) / 1000)) : "";
  },
  async post(req, res) {
    const body = String(res.body || "");
    console.log("Player answers again " + vars.rebootSeconds + " s after the reboot request\n" + body.slice(0, 1500));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("SyncStatus answers again", () => expect(/<SyncStatus/.test(String(res.body || ""))).to.equal(true));
  },
});

request("M09 Saved playlists (remember names)", {
  url: `http://${env.host}:11000/Playlists`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    const names = (body.match(/<name\b[^>]*>([^<]*)<\/name>/g) || []).map((x) => x.replace(/<[^>]*>/g, "")).sort();
    vars.vsPlaylists = JSON.stringify(names);
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const tags = (name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("at least one playlist", () => expect(tags("name").length).to.be.above(0));
  },
});

request("M10 Backup of the saved playlists (to a file)", {
  url: `http://${env.host}:80/download_playlists_api`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    saveFixture("verify-playlists-backup.json", body);
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("JSON array of playlists", () => expect(Array.isArray(raw) || /^\s*\[/.test(body)).to.equal(true));
  },
});

request("M11 Restore the same backup (upload)", {
  method: "POST",
  url: `http://${env.host}:80/upload_playlists_api`,
  multipart: { file: { file: "fixtures/verify-playlists-backup.json" } },
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Upload only the backup M10 has just written (needs saveFixtures = true)
    const fs = require("fs"),
      path = require("path");
    const f = path.join(ROOT, "fixtures", "verify-playlists-backup.json");
    if (!fs.existsSync(f) || Date.now() - fs.statSync(f).mtimeMs > 10 * 60 * 1000) {
      console.log("No fresh backup from M10 – upload skipped");
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-upload-playlists.txt");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("M12 Saved playlists unchanged", {
  url: `http://${env.host}:11000/Playlists`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
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
    const names = (body.match(/<name\b[^>]*>([^<]*)<\/name>/g) || []).map((x) => x.replace(/<[^>]*>/g, "")).sort();
    test("same playlists as before", () => expect(JSON.stringify(names)).to.equal(vars.vsPlaylists));
  },
});

request("M13 Clear the recent stations (deletes the history)", {
  url: `http://${env.host}:11000/ui/clearUsageHistory?stations=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-clearusagehistory.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("M14 Diagnostics page (remember statistics setting)", {
  url: `http://${env.host}:80/diagnostics?noheader=1&playnum=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    const sel = (body.match(/<select[^>]*id="statistics"[\s\S]*?<\/select>/) || [""])[0];
    const cur = (sel.match(/<option value="(\d)" selected/) || [])[1] || "";
    vars.vsStats = cur;
    vars.vsStatsNew = cur === "1" ? "0" : "1";
    console.log("statistics: " + cur);
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    const sel = (body.match(/<select[^>]*id="statistics"[\s\S]*?<\/select>/) || [""])[0];
    const cur = (sel.match(/<option value="(\d)" selected/) || [])[1] || "";
    test("statistics switch found", () => expect(cur).to.match(/^[01]$/));
  },
});

request("M15 Statistics collection (change)", {
  url: `http://${env.host}:80/statistics`,
  async pre(req) {
    const H80 = "http://" + env.host + ":80";
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vsStats) {
      req.skip();
      return;
    }
    req.url = H80 + "/statistics?enable=" + vars.vsStatsNew;
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-statistics.txt");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("M16 Diagnostics page shows the new setting", {
  url: `http://${env.host}:80/diagnostics?noheader=1&playnum=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vsStats) {
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
    const sel = (body.match(/<select[^>]*id="statistics"[\s\S]*?<\/select>/) || [""])[0];
    const cur = (sel.match(/<option value="(\d)" selected/) || [])[1] || "";
    test("statistics changed", () => expect(cur).to.equal(vars.vsStatsNew));
  },
});

request("M17 Statistics collection (restore)", {
  url: `http://${env.host}:80/statistics`,
  async pre(req) {
    const H80 = "http://" + env.host + ":80";
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vsStats) {
      req.skip();
      return;
    }
    req.url = H80 + "/statistics?enable=" + vars.vsStats;
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
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("M18 Diagnostics page: statistics restored", {
  url: `http://${env.host}:80/diagnostics?noheader=1&playnum=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vsStats) {
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
    const sel = (body.match(/<select[^>]*id="statistics"[\s\S]*?<\/select>/) || [""])[0];
    const cur = (sel.match(/<option value="(\d)" selected/) || [])[1] || "";
    test("statistics restored", () => expect(cur).to.equal(vars.vsStats));
  },
});

request("M19 Rebuild index (delete_index, the library is scanned again)", {
  url: `http://${env.host}:80/delete_index?noheader=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-delete-index.html");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error|404 page not found/i.test(body)).to.equal(false));
  },
});

request("M20 Status after the rebuild request", {
  url: `http://${env.host}:11000/Status`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-status-after-delete-index.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
    console.log("indexing: " + ((body.match(/<indexing>([^<]*)</) || [])[1] || ""));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("M21 UpdateDNS (no visible effect)", {
  url: `http://${env.host}:11000/UpdateDNS`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-updatedns.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no error answer", () => expect(/<error/i.test(body)).to.equal(false));
  },
});

request("M22 RadioAddPreset (adds a URL favourite, M24-M26 remove it)", {
  url: `http://${env.host}:11000/RadioAddPreset?service=TuneIn&name=__bluos_verify__&url=TuneIn%3As16252`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-radioaddpreset.xml");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("M23 playurl web form (port 80, plays a stream)", {
  method: "POST",
  url: `http://${env.host}:80/playurl`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    req.body = "url=" + encodeURIComponent("TuneIn:s16252");
    req.headers["Content-Type"] = "application/x-www-form-urlencoded";
  },
  async post(req, res) {
    const raw = res.body;
    const body = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

    const saveFixture = (file, text) => save(file, text === undefined ? body : text);
    saveFixture("verify-playurl.html");
    console.log("HTTP " + res.status + ", " + (res.header("content-type") || "") + "\n" + body.slice(0, 3000));
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
  },
});

request("M24 URL favourite is a TuneIn favourite", {
  url: `http://${env.host}:11000/RadioBrowse?service=TuneIn&url=presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
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
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    const menuAction = async (item, type) => {
      const t = item
        ? tagsOf(await browse(attr(item, "contextMenuKey")), "item").find((x) => attr(x, "type") === type)
        : "";
      return t ? attr(t, "actionURL") : "";
    };
    const tuneInFavs = async () => {
      const k = tagsOf(await browse("TuneIn:"), "item")
        .map((t) => attr(t, "browseKey"))
        .find((k) => /url=presets$/.test(k));
      return k ? browse(k) : "";
    };
    // Every favourite named __bluos_verify__ (M22, also left over from earlier runs) and its remove action
    const items = tagsOf(await tuneInFavs(), "item").filter((t) => attr(t, "text") === "__bluos_verify__");
    const urls = [];
    for (const it of items) urls.push(await menuAction(it, "favourite-delete"));
    // The id is in the context menu key (preset_id=u…), /Browse items have no preset_id attribute
    const idOf = (t) => (attr(t, "contextMenuKey").match(/[?&]preset_id=([^&]*)/) || [])[1] || "";
    vars.vrUrlFavIds = JSON.stringify(items.map(idOf));
    vars.vrUrlFavDel = JSON.stringify(urls.filter(Boolean));
    console.log(
      items.length +
        " URL favourite(s) __bluos_verify__: " +
        items.map((t) => idOf(t) + " plays " + attr(t, "playURL")).join(", ") +
        "\nremove: " +
        urls.join(", "),
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    const ids = JSON.parse(vars.vrUrlFavIds || "[]"),
      del = JSON.parse(vars.vrUrlFavDel || "[]");
    test("__bluos_verify__ is in the TuneIn favourites (run M22 first)", () => expect(ids.length).to.be.above(0));
    test("its preset_id starts with u (URL favourite)", () =>
      expect(ids.every((i) => /^u\d+$/.test(i))).to.equal(true));
    test("its menu removes it with /DeleteFavourite?id=u…&service=TuneIn", () =>
      expect(
        del.length === ids.length && del.every((u) => /^\/DeleteFavourite\?id=u\d+&service=TuneIn$/.test(u)),
      ).to.equal(true));
  },
});

request("M25 Remove the URL favourite (DeleteFavourite id=u)", {
  url: `http://${env.host}:11000/DeleteFavourite`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    const del = JSON.parse(vars.vrUrlFavDel || "[]");
    if (!del.length) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + del[0];
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-delete-favourite-url.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
    // Further copies of __bluos_verify__ (earlier runs)
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

    for (const u of JSON.parse(vars.vrUrlFavDel || "[]").slice(1))
      console.log(u + " -> " + (await get(u)).replace(/\s+/g, " ").slice(0, 120));
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test('answer <favourite service="TuneIn">deleted</favourite>', () =>
      expect(/<favourite service="TuneIn">deleted<\/favourite>/.test(body)).to.equal(true));
  },
});

request("M26 URL favourite is gone", {
  url: `http://${env.host}:11000/RadioBrowse?service=TuneIn&url=presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!JSON.parse(vars.vrUrlFavDel || "[]").length) {
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
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    const tuneInFavs = async () => {
      const k = tagsOf(await browse("TuneIn:"), "item")
        .map((t) => attr(t, "browseKey"))
        .find((k) => /url=presets$/.test(k));
      return k ? browse(k) : "";
    };
    vars.vrUrlFavLeft = String(
      tagsOf(await tuneInFavs(), "item").filter((t) => attr(t, "text") === "__bluos_verify__").length,
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("no favourite __bluos_verify__ left", () => expect(vars.vrUrlFavLeft).to.equal("0"));
  },
});

request("M27 Favourite a TuneIn station (AddFavourite preset_id=)", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
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

    const menuAction = async (item, type) => {
      const t = item
        ? tagsOf(await browse(attr(item, "contextMenuKey")), "item").find((x) => attr(x, "type") === type)
        : "";
      return t ? attr(t, "actionURL") : "";
    };
    // First local TuneIn station that is no favourite; its context menu gives /AddFavourite?preset_id=…
    vars.vrTuneInId = "";
    const localKey = tagsOf(await browse("TuneIn:"), "item")
      .map((t) => attr(t, "browseKey"))
      .find((k) => /categories%252Flocal/.test(k));
    const station = localKey
      ? tagsOf(await browse(localKey), "item").find(
          (t) => /inputType=station/.test(attr(t, "contextMenuKey")) && !/is_preset=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    const url = await menuAction(station, "favourite-add");
    if (!/^\/AddFavourite\?preset_id=/.test(url)) {
      console.log("No local TuneIn station without favourite, or no /AddFavourite?preset_id= – skipped");
      req.skip();
      return;
    }
    vars.vrTuneInId = (url.match(/preset_id=([^&]*)/) || [])[1];
    vars.vrTuneInName = attr(station, "text");
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-favourite-tunein.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test('answer <favourite service="TuneIn">added</favourite>', () =>
      expect(/<favourite service="TuneIn">added<\/favourite>/.test(body)).to.equal(true));
  },
});

request("M28 TuneIn favourites contain the station", {
  url: `http://${env.host}:11000/RadioBrowse?service=TuneIn&url=presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrTuneInId) {
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
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    const menuAction = async (item, type) => {
      const t = item
        ? tagsOf(await browse(attr(item, "contextMenuKey")), "item").find((x) => attr(x, "type") === type)
        : "";
      return t ? attr(t, "actionURL") : "";
    };
    const tuneInFavs = async () => {
      const k = tagsOf(await browse("TuneIn:"), "item")
        .map((t) => attr(t, "browseKey"))
        .find((k) => /url=presets$/.test(k));
      return k ? browse(k) : "";
    };
    await new Promise((r) => setTimeout(r, 1000));
    const st = tagsOf(await tuneInFavs(), "item").find(
      (t) =>
        /is_preset=1/.test(attr(t, "contextMenuKey")) &&
        new RegExp("[?&]preset_id=" + vars.vrTuneInId + "(&|$)").test(attr(t, "contextMenuKey")),
    );
    vars.vrTuneInDel = await menuAction(st, "favourite-delete");
    console.log(
      "'" +
        vars.vrTuneInName +
        "' (" +
        vars.vrTuneInId +
        ") in the TuneIn favourites: " +
        !!st +
        "\nremove: " +
        vars.vrTuneInDel,
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the station is a favourite now", () => expect(vars.vrTuneInDel).to.not.equal(""));
    test("its menu removes it with /DeleteFavourite?id=<same id>", () =>
      expect(vars.vrTuneInDel).to.equal("/DeleteFavourite?id=" + vars.vrTuneInId + "&service=TuneIn"));
  },
});

request("M29 Remove the TuneIn favourite (DeleteFavourite id=)", {
  url: `http://${env.host}:11000/DeleteFavourite`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrTuneInDel) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + vars.vrTuneInDel;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-delete-favourite-tunein.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test('answer <favourite service="TuneIn">deleted</favourite>', () =>
      expect(/<favourite service="TuneIn">deleted<\/favourite>/.test(body)).to.equal(true));
  },
});

request("M30 TuneIn favourites no longer contain the station", {
  url: `http://${env.host}:11000/RadioBrowse?service=TuneIn&url=presets`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrTuneInDel) {
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
    const browse = (key) => get("/Browse?key=" + encodeURIComponent(key));

    const tuneInFavs = async () => {
      const k = tagsOf(await browse("TuneIn:"), "item")
        .map((t) => attr(t, "browseKey"))
        .find((k) => /url=presets$/.test(k));
      return k ? browse(k) : "";
    };
    await new Promise((r) => setTimeout(r, 1000));
    vars.vrTuneInLeft = tagsOf(await tuneInFavs(), "item").some((t) =>
      new RegExp("[?&]preset_id=" + vars.vrTuneInId + "(&|$)").test(attr(t, "contextMenuKey")),
    )
      ? "1"
      : "";
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the station is no favourite any more", () => expect(vars.vrTuneInLeft).to.equal(""));
  },
});

request("M31 Favourite an Airable station (AddFavourite url=)", {
  url: `http://${env.host}:11000/AddFavourite`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
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
    const stationOf = (t) => (attr(t, "playURL").match(/[?&]url=([^&]*)/) || [])[1] || "";
    const menuAction = async (item, type) => {
      const t = item
        ? tagsOf(await browse(attr(item, "contextMenuKey")), "item").find((x) => attr(x, "type") === type)
        : "";
      return t ? attr(t, "actionURL") : "";
    };
    // First station of "Most popular stations" (Radio) that is no favourite; its menu gives /AddFavourite?service=Airable&url=…
    vars.vrAirableUrl = "";
    const listKey = tagsOf(await browse("Airable:"), "item")
      .map((t) => attr(t, "browseKey"))
      .find((k) => /stations%252Fcharts/.test(k));
    const station = listKey
      ? tagsOf(await browse(listKey), "item").find(
          (t) =>
            /^Airable%3Aradio%3A/.test(stationOf(t)) &&
            attr(t, "contextMenuKey") &&
            !/is_preset=1/.test(attr(t, "contextMenuKey")),
        )
      : "";
    const url = await menuAction(station, "favourite-add");
    if (!/^\/AddFavourite\?(.*&)?url=/.test(url)) {
      console.log("No Airable station without favourite, or no /AddFavourite?url= – skipped");
      req.skip();
      return;
    }
    vars.vrAirableList = listKey;
    vars.vrAirableUrl = stationOf(station);
    vars.vrAirableName = attr(station, "text");
    req.url = H + url;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-add-favourite-airable.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
    if (/<message>Login to use favourites<\/message>/.test(body)) {
      console.log("Airable favourites need a login to the radio service – M32–M34 skipped");
      vars.vrAirableUrl = "";
    }
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    // Without a login to the radio service the player refuses: M32–M34 are skipped then
    test("added, or 'Login to use favourites' without a login", () =>
      expect(/<favourite\b[^>]*>added<\/favourite>|<message>Login to use favourites<\/message>/.test(body)).to.equal(
        true,
      ));
  },
});

request("M32 Airable station is a favourite", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrAirableUrl) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vrAirableList);
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
    const stationOf = (t) => (attr(t, "playURL").match(/[?&]url=([^&]*)/) || [])[1] || "";
    const menuAction = async (item, type) => {
      const t = item
        ? tagsOf(await browse(attr(item, "contextMenuKey")), "item").find((x) => attr(x, "type") === type)
        : "";
      return t ? attr(t, "actionURL") : "";
    };
    const body = String(res.body || "");
    // The same station in the list again: marked is_preset=1, and its menu offers the remove action
    const st = tagsOf(body, "item").find((t) => stationOf(t) === vars.vrAirableUrl);
    vars.vrAirableMarked = st && /is_preset=1/.test(attr(st, "contextMenuKey")) ? "1" : "";
    vars.vrAirableDel = await menuAction(st, "favourite-delete");
    console.log(
      "'" +
        vars.vrAirableName +
        "' in the list: " +
        !!st +
        ", is_preset: " +
        vars.vrAirableMarked +
        "\nremove: " +
        vars.vrAirableDel,
    );
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the station is marked is_preset=1", () => expect(vars.vrAirableMarked).to.equal("1"));
    test("its menu removes it with /DeleteFavourite?…url=", () =>
      expect(/^\/DeleteFavourite\?(.*&)?url=/.test(vars.vrAirableDel)).to.equal(true));
  },
});

request("M33 Remove the Airable favourite (DeleteFavourite url=)", {
  url: `http://${env.host}:11000/DeleteFavourite`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrAirableDel) {
      req.skip();
      return;
    }
    req.url = "http://" + env.host + ":11000" + vars.vrAirableDel;
  },
  async post(req, res) {
    const body = String(res.body || "");
    // Stores the answer in fixtures/
    save("verify-delete-favourite-airable.xml", "<!-- " + req.url.replace(/^https?:\/\/[^/]+/, "") + " -->\n" + body);
    console.log(req.url + "\n" + body);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    // Not seen yet (needs a login to the radio service); the other favourite kinds answer <favourite …>deleted</favourite>
    test("answer <favourite>deleted</favourite>", () =>
      expect(/<favourite\b[^>]*>deleted<\/favourite>/.test(body)).to.equal(true));
  },
});

request("M34 Airable station is no favourite any more", {
  url: `http://${env.host}:11000/Browse`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    if (!vars.vrAirableDel) {
      req.skip();
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
    req.url = "http://" + env.host + ":11000/Browse?key=" + encodeURIComponent(vars.vrAirableList);
  },
  async post(req, res) {
    const tagsOf = (xml, name) => xml.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];

    const stationOf = (t) => (attr(t, "playURL").match(/[?&]url=([^&]*)/) || [])[1] || "";

    const body = String(res.body || "");
    const st = tagsOf(body, "item").find((t) => stationOf(t) === vars.vrAirableUrl);
    vars.vrAirableLeft = st && /is_preset=1/.test(attr(st, "contextMenuKey")) ? "1" : "";
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("the station is no longer marked is_preset=1", () => expect(vars.vrAirableLeft).to.equal(""));
  },
});

request("M35 Upgrade notification (check for upgrade, remember the version)", {
  url: `http://${env.host}:11000/update`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Remembers the BluOS version. Without a notification in /update it first sends /upgrade?noheader=1 (Help › Check for upgrade),
    // which sets the notification when an upgrade is available.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String((await http.get(H + p, { timeout: 30000, responseType: "text", transformResponse: (x) => x })).data || "");
    const v = (await get("/GitVersion")).match(/<version>([^<]*)</);
    vars.upgradeFrom = v ? v[1] : "";
    vars.upgradeChecked = "";
    if (!/<notification\b/.test(await get("/update"))) {
      vars.upgradeCheckPage = await get("/upgrade?noheader=1");
      vars.upgradeChecked = "1";
      await new Promise((r) => setTimeout(r, 3000));
    }
  },
  async post(req, res) {
    // <notification>: message and one button per choice (label, url); "I want it now" = /upgrade?upgrade=all, "Delay 24 hours" = /upgrade?upgrade=delay
    const body = String(res.body || "");
    const saveFixture = (file, text) => save(file, text);
    saveFixture("verify-upgrade-notification.xml", body);
    if (vars.upgradeChecked) saveFixture("verify-upgrade-check.html", vars.upgradeCheckPage || "");
    const dec = (s) => s.replace(/&amp;/g, "&");
    const buttons = [
      ...body.matchAll(/<button\b[^>]*>[\s\S]*?<label>([^<]*)<\/label>[\s\S]*?<url>([^<]*)<\/url>[\s\S]*?<\/button>/g),
    ].map((m) => ({ label: dec(m[1]), url: dec(m[2]) }));
    // The button that is not the delay; only an unambiguous one is used by M36
    const start = buttons.filter((b) => !/delay/i.test(b.url));
    vars.upgradeURI = start.length === 1 ? start[0].url : "";
    console.log(
      "BluOS version: " +
        vars.upgradeFrom +
        (vars.upgradeChecked ? "\nChecked for upgrade first (/upgrade?noheader=1)" : "") +
        "\n/update: " +
        body +
        "\nButtons: " +
        (buttons.map((b) => b.label + " = " + b.url).join(", ") || "none") +
        "\nM36 will send: " +
        (vars.upgradeURI || "nothing (skipped)"),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("BluOS version read", () => expect(vars.upgradeFrom).to.match(/^\d+\.\d+/));
    test("notification with a message", () =>
      expect(/<notification\b[\s\S]*<message>[^<]+<\/message>/.test(body)).to.equal(true));
    test("one button that starts the upgrade", () => expect(vars.upgradeURI).to.match(/^\/upgrade\?/));
  },
});

request("M36 Start the firmware upgrade (upgrade)", {
  url: `http://${env.host}:11000/update`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Starts the firmware upgrade: the url of the button of the /update notification that is not the delay (M35, "I want it now").
    // Skipped without such a button. Sent with axios without following a redirect, so status, Location and body are recorded.
    const uri = vars.upgradeURI || "";
    if (!uri) {
      req.skip();
      return;
    }
    const H = "http://" + env.host + ":11000";
    let out;
    try {
      const r = await http.get(H + uri, {
        timeout: 30000,
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: "text",
        transformResponse: (x) => x,
      });
      out = {
        uri,
        status: r.status,
        location: r.headers.location || "",
        type: r.headers["content-type"] || "",
        body: String(r.data || ""),
      };
    } catch (e) {
      out = { uri, status: 0, location: "", type: "", body: "request failed: " + e.message };
    }
    vars.upgradeAt = String(Date.now());
    vars.upgradeTrigger = JSON.stringify(out);
  },
  async post(req, res) {
    // Main request: /update right after the trigger
    const t = JSON.parse(vars.upgradeTrigger || "{}");
    const body = String(res.body || "");
    const saveFixture = (file, text) => save(file, text);
    saveFixture(
      "verify-upgrade-trigger.txt",
      "GET " +
        t.uri +
        "\nHTTP " +
        t.status +
        "\nLocation: " +
        t.location +
        "\nContent-Type: " +
        t.type +
        "\n\n" +
        t.body,
    );
    saveFixture("verify-upgrade-message-after.xml", body);
    console.log(
      "GET " +
        t.uri +
        " -> HTTP " +
        t.status +
        (t.location ? ", Location " + t.location : "") +
        "\n" +
        String(t.body).slice(0, 2000) +
        "\n/update afterwards: " +
        body,
    );
  },
  async tests(req, res, test) {
    const t = JSON.parse(vars.upgradeTrigger || "{}");
    test("/upgrade answers (200 or redirect)", () => expect([200, 301, 302, 303, 307]).to.include(t.status));
  },
});

request("M37 Upgrade progress until the player is back", {
  url: `http://${env.host}:11000/SyncStatus`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Every 3 s: /update and /GitVersion. Logs every change (message, player down / up, version) with the seconds since M36.
    // Ends when the player answers with another version, after 5 minutes without any change (no upgrade started) or after 30 minutes.
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String((await http.get(H + p, { timeout: 3000, responseType: "text", transformResponse: (x) => x })).data || "");
    const from = vars.upgradeFrom || "";
    const at = parseInt(vars.upgradeAt || String(Date.now()));
    const log = [];
    let last = "",
      lastChange = Date.now(),
      version = from;
    while (Date.now() - at < 1800000) {
      let state;
      try {
        const msg = (await get("/update")).replace(/<\?xml[^>]*>\s*/, "").trim();
        const v = (await get("/GitVersion")).match(/<version>([^<]*)</);
        version = v ? v[1] : version;
        state = "up, version " + version + ", /update " + msg;
      } catch (e) {
        state = "down (" + (e.code || e.message) + ")";
      }
      if (state !== last) {
        log.push(Math.round((Date.now() - at) / 1000) + " s: " + state);
        last = state;
        lastChange = Date.now();
      }
      if (state.startsWith("up") && version !== from) break;
      if (Date.now() - lastChange > 300000) {
        log.push("no change for 5 minutes: stopped");
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    vars.upgradeTo = version;
    vars.upgradeSeconds = String(Math.round((Date.now() - at) / 1000));
    vars.upgradeLog = log.join("\n");
  },
  async post() {
    const log = vars.upgradeLog || "";
    const saveFixture = (file, text) => save(file, text);
    saveFixture("verify-upgrade-progress.txt", log + "\n");
    console.log("Upgrade " + vars.upgradeFrom + " -> " + vars.upgradeTo + " in " + vars.upgradeSeconds + " s\n" + log);
  },
  async tests(req, res, test) {
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("new BluOS version", () => expect(vars.upgradeTo).to.not.equal(vars.upgradeFrom));
  },
});

request("M38 Upgrade log and versions of the group", {
  url: `http://${env.host}:80/Dataexport`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Versions of every player of the group from the settings tree (settings "Version").
    const H = "http://" + env.host + ":11000";
    // The player's schema from /SyncStatus: without schemaVersion the tree is that of an old schema, without the version entries
    const sync = String(
      (await http.get(H + "/SyncStatus", { timeout: 15000, responseType: "text", transformResponse: (x) => x })).data ||
        "",
    );
    const schema = (sync.match(/\sschemaVersion="(\d+)"/) || [])[1] || "";
    const r = await http.get(H + "/Settings?expand=1&schemaVersion=" + schema, {
      timeout: 15000,
      responseType: "text",
      transformResponse: (x) => x,
    });
    const versions = [...String(r.data || "").matchAll(/<setting\b[^>]*id="([^"]*-version)"[^>]*value="([^"]*)"/g)].map(
      (m) => m[1] + " = " + m[2],
    );
    vars.groupVersions = versions.join("\n");
  },
  async post(req, res) {
    // System log of the player: only the lines of the upgrade (stage0 = upgrade service, stage1 / stage2 = upgrader) and the requests to /update and /upgrade
    const body = String(res.body || "");
    const lines = body.split("\n").filter((l) => /stage[012]|upgrade|GET \/update|POST \/update|\/upgrade/i.test(l));
    const saveFixture = (file, text) => save(file, text);
    saveFixture(
      "verify-upgrade-log.txt",
      lines.join("\n") + "\n\nVersions of the group:\n" + vars.groupVersions + "\n",
    );
    console.log(
      "Versions of the group:\n" +
        vars.groupVersions +
        "\n\nUpgrade lines of the log (last 60):\n" +
        lines.slice(-60).join("\n"),
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const from = vars.upgradeFrom,
      to = vars.upgradeTo;
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("log names the upgrade " + from + " -> " + to, () =>
      expect(body.includes("Start upgrade from " + from + " to " + to)).to.equal(true),
    );
    test("every player of the group has the new version", () => {
      const vs = (vars.groupVersions || "").split("\n").filter(Boolean);
      expect(vs.length).to.be.above(0);
      vs.forEach((v) => expect(v.endsWith("= " + to)).to.equal(true));
    });
  },
});

request("M39 Library id (remember)", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&section=all&length=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Does the root attribute id of the /library/v1 answers change when the library changes? Remembers the id, the album
    // count of the index and the newest album (New); M40 and M41 compare with it. Also kept in fixtures/verify-library-id.json
    // (survives the end of the test run). Read only.
    const L = "http://" + env.host + ":11000/library/v1/Albums?service=LocalMusic";
    const get = async (q) =>
      String(
        (
          await http.get(L + q, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const idx = await get("&section=all&length=1"),
      neu = await get("&recent=1");
    const first = neu.match(/<alb>([^<]*)<\/alb>\s*<art>([^<]*)<\/art>/);
    const snap = {
      at: new Date().toISOString(),
      id: (idx.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1] || "",
      newId: (neu.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1] || "",
      albums: [...idx.matchAll(/<section name="[^"]*" length="(\d+)"/g)].reduce((n, m) => n + +m[1], 0),
      newest: first ? first[1] + " - " + first[2] : "",
    };
    vars.libSnap = JSON.stringify(snap);
    save("verify-library-id.json", JSON.stringify(snap, null, 2), true);
    const hex = (v) => v + " = 0x" + (+v).toString(16) + " (high " + (+v >>> 16) + ", low " + (+v & 0xffff) + ")";
    console.log(
      "Library id " +
        hex(snap.id) +
        ", id of New " +
        snap.newId +
        ", " +
        snap.albums +
        " albums, newest: " +
        snap.newest,
    );
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    const snap = JSON.parse(vars.libSnap || "{}");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("root carries a numeric id", () => expect(body).to.match(/<albums\b[^>]*\sid="\d+"/));
    test("id of New = id of the index", () => expect(snap.newId).to.equal(snap.id));
  },
});

request("M40 Library id compared", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&section=all&length=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Reads the library id, the album count and the newest album again and logs what changed since M39
    // (bru variable, else fixtures/verify-library-id.json). Send it after each change, e.g. a favourite, a reindex, a new
    // album on the share. Read only.
    const L = "http://" + env.host + ":11000/library/v1/Albums?service=LocalMusic";
    const get = async (q) =>
      String(
        (
          await http.get(L + q, {
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    let before = vars.libSnap;
    if (!before) {
      try {
        before = require("fs").readFileSync(require("path").join(ROOT, "fixtures", "verify-library-id.json"), "utf8");
      } catch {
        /* no saved state of M39 */
      }
    }
    const was = JSON.parse(before || "{}");
    const idx = await get("&section=all&length=1"),
      neu = await get("&recent=1");
    const first = neu.match(/<alb>([^<]*)<\/alb>\s*<art>([^<]*)<\/art>/);
    const now = {
      at: new Date().toISOString(),
      id: (idx.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1] || "",
      newId: (neu.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1] || "",
      albums: [...idx.matchAll(/<section name="[^"]*" length="(\d+)"/g)].reduce((n, m) => n + +m[1], 0),
      newest: first ? first[1] + " - " + first[2] : "",
    };
    vars.libWas = JSON.stringify(was);
    vars.libNow = JSON.stringify(now);
    const hex = (v) => v + " = 0x" + (+v).toString(16) + " (high " + (+v >>> 16) + ", low " + (+v & 0xffff) + ")";
    const diff = (k) => (was[k] === now[k] ? "unchanged " : "CHANGED " + was[k] + " -> ") + now[k];
    console.log(
      "Since M39 (" +
        (was.at || "not run") +
        "):\n- id: " +
        (was.id === now.id ? "unchanged " + hex(now.id) : "CHANGED " + hex(was.id || "0") + " -> " + hex(now.id)) +
        "\n- albums: " +
        diff("albums") +
        "\n- newest: " +
        diff("newest") +
        "\n- id of New: " +
        now.newId,
    );
  },
  async tests(req, res, test) {
    const was = JSON.parse(vars.libWas || "{}");
    const now = JSON.parse(vars.libNow || "{}");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("M39 was run before", () => expect(was.id || "").to.match(/^\d+$/));
    test("id of New = id of the index", () => expect(now.newId).to.equal(now.id));
  },
});

request("M41 Reindex and follow the library id", {
  url: `http://${env.host}:11000/library/v1/Albums?service=LocalMusic&section=all&length=1`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // Starts a library rescan (/Reindex) and reads every 5 s the library id, the album count, the newest album and
    // indexing and mid of /Status; logs every change with the seconds since /Reindex. Ends 90 s after the last change, at the
    // latest after 15 minutes. Changes the library index (as M02).
    const H = "http://" + env.host + ":11000";
    const get = async (p) =>
      String(
        (
          await http.get(H + p, {
            timeout: 10000,
            responseType: "text",
            transformResponse: (x) => x,
            headers: { "Accept-Language": "en" },
          })
        ).data || "",
      );
    const L = "/library/v1/Albums?service=LocalMusic";
    const hex = (v) => v + " = 0x" + (+v).toString(16) + " (high " + (+v >>> 16) + ", low " + (+v & 0xffff) + ")";
    let id = "",
      mid = "",
      maxIndexing = 0;
    const read = async () => {
      try {
        const idx = await get(L + "&section=all&length=1"),
          neu = await get(L + "&recent=1"),
          st = await get("/Status");
        const first = neu.match(/<alb>([^<]*)<\/alb>\s*<art>([^<]*)<\/art>/);
        const indexing = (st.match(/<indexing>([^<]*)</) || [])[1] || "-";
        id = (idx.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1] || "0";
        mid = (st.match(/<mid>([^<]*)</) || [])[1] || "-";
        maxIndexing = Math.max(maxIndexing, parseInt(indexing) || 0);
        return (
          "id " +
          hex(id) +
          ", " +
          [...idx.matchAll(/<section name="[^"]*" length="(\d+)"/g)].reduce((n, m) => n + +m[1], 0) +
          " albums" +
          ", newest " +
          (first ? first[1] + " - " + first[2] : "-") +
          ", indexing " +
          indexing +
          ", mid " +
          mid
        );
      } catch (e) {
        return "error (" + (e.code || e.message) + ")";
      }
    };
    const log = ["before: " + (await read())];
    vars.libIdBefore = id;
    log.push("/Reindex: " + (await get("/Reindex")).replace(/<\?xml[^>]*>\s*/, "").trim());
    const at = Date.now();
    let last = "",
      lastChange = 0;
    while (Date.now() - at < 900000) {
      const state = await read();
      if (state !== last) {
        log.push(Math.round((Date.now() - at) / 1000) + " s: " + state);
        if (last) lastChange = Date.now();
        last = state;
      }
      if (lastChange && Date.now() - lastChange > 90000) break;
      await new Promise((r) => setTimeout(r, 5000));
    }
    log.push("end after " + Math.round((Date.now() - at) / 1000) + " s" + (lastChange ? "" : " (no change seen)"));
    vars.libReindexLog = log.join("\n");
    vars.libMaxIndexing = String(maxIndexing);
    vars.libMidAfter = mid;
    console.log(log.join("\n"));
    save("verify-library-id-reindex.txt", log.join("\n") + "\n", true);
  },
  async tests(req, res, test) {
    const body = String(res.body || "");
    test("HTTP 200", () => expect(res.status).to.equal(200));
    test("rescan started", () => expect(vars.libReindexLog || "").to.match(/\/Reindex: <indexing>1<\/indexing>/));
    test("root carries a numeric id", () => expect(body).to.match(/<albums\b[^>]*\sid="\d+"/));
    test("indexing of /Status counted the files during the rescan", () => expect(+vars.libMaxIndexing).to.be.above(0));
    test("library id changed after the rescan", () => {
      const after = (body.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1];
      expect(after).to.not.equal(vars.libIdBefore);
    });
    test("mid of /Status = library id after the rescan", () => {
      const after = (body.match(/<albums\b[^>]*\sid="(\d+)"/) || [])[1];
      expect(vars.libMidAfter).to.equal(after);
    });
  },
});

request("M42 PlayTestSound (pink noise, then stop)", {
  url: `http://${env.host}:11000/PlayTestSound?sound=1&volume=20&type=pinknoise`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // The BluOS app plays pink noise while setting up a stereo pair or home theatre group ("Where is the sound"):
    // sound=1&volume=20&type=pinknoise (&channel=left|right), and stops it with sound=0&volume=20.
    // Stops the playback (seen during ffuf); this request remembers /Status before.
    const H = "http://" + env.host + ":11000";
    const st = String(
      (
        await http.get(H + "/Status", {
          responseType: "text",
          transformResponse: (x) => x,
          headers: { "Accept-Language": "en" },
        })
      ).data || "",
    );
    const v = (t) => (st.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "";
    vars.m42 = JSON.stringify({ before: { state: v("state"), pid: v("pid"), song: v("song"), volume: v("volume") } });
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const get = async (p) => {
      const r = await http.get(H + p, {
        responseType: "text",
        transformResponse: (x) => x,
        validateStatus: () => true,
        headers: { "Accept-Language": "en" },
      });
      return { status: r.status, body: String(r.data || "") };
    };
    const v = (st, t) => (st.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "";
    const r = JSON.parse(vars.m42);
    r.play = { status: res.status, body: String(res.body || "").slice(0, 500) };
    await new Promise((ok) => setTimeout(ok, 3000));
    const during = (await get("/Status")).body;
    r.during = { state: v(during, "state"), pid: v(during, "pid"), title1: v(during, "title1") };
    r.stop = await get("/PlayTestSound?sound=0&volume=20");
    r.stop.body = r.stop.body.slice(0, 500);
    await new Promise((ok) => setTimeout(ok, 1000));
    const after = (await get("/Status")).body;
    r.after = { state: v(after, "state"), pid: v(after, "pid"), song: v(after, "song"), volume: v(after, "volume") };
    vars.m42 = JSON.stringify(r);
    save("verify-playtestsound.json", JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.m42);
    test("pink noise: HTTP 200, no error", () => {
      expect(r.play.status).to.equal(200);
      expect(/<error/i.test(r.play.body)).to.equal(false);
    });
    test("stop: HTTP 200, no error", () => {
      expect(r.stop.status).to.equal(200);
      expect(/<error/i.test(r.stop.body)).to.equal(false);
    });
    test("volume unchanged", () => expect(r.after.volume).to.equal(r.before.volume));
  },
});

request("M43 SetInitialized (player stays initialized)", {
  url: `http://${env.host}:11000/SetInitialized`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // The BluOS app sends it without parameters at the end of the setup of a new player; on a player that is
    // set up already (initialized="true" in /SyncStatus) it should change nothing.
    const H = "http://" + env.host + ":11000";
    const s = String(
      (await http.get(H + "/SyncStatus", { responseType: "text", transformResponse: (x) => x })).data || "",
    );
    vars.m43 = JSON.stringify({ before: (s.match(/\sinitialized="([^"]*)"/) || [])[1] || "" });
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const r = JSON.parse(vars.m43);
    r.answer = {
      status: res.status,
      type: String(res.header("content-type") || ""),
      body: String(res.body || "").slice(0, 1000),
    };
    const s = String(
      (await http.get(H + "/SyncStatus", { responseType: "text", transformResponse: (x) => x })).data || "",
    );
    r.after = (s.match(/\sinitialized="([^"]*)"/) || [])[1] || "";
    vars.m43 = JSON.stringify(r);
    save("verify-setinitialized.json", JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.m43);
    test("HTTP 200", () => expect(r.answer.status).to.equal(200));
    test("SyncStatus initialized unchanged", () => expect(r.after).to.equal(r.before));
  },
});

request("M44 SetMaster (grouping unchanged)", {
  url: `http://${env.host}:11000/SetMaster`,
  headers: { Accept: "text/javascript; charset=utf-8", "Accept-Language": "en-US" },
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // The BluOS app sends it without parameters, with Accept text/javascript. During ffuf it answered like
    // /SyncStatus (1226 bytes) and the grouping stayed the same. This request compares the grouping before and after.
    const H = "http://" + env.host + ":11000";
    const s = String(
      (await http.get(H + "/SyncStatus", { responseType: "text", transformResponse: (x) => x })).data || "",
    );
    const group = (x) =>
      JSON.stringify({
        root: ["zoneController", "zone", "group", "channelMode"].map(
          (n) => (x.match(new RegExp("<SyncStatus\\b[^>]*\\s" + n + '="([^"]*)"')) || [])[1] || "",
        ),
        members: (x.match(/<(zoneSlave|slave|master)\b[^>]*>/g) || []).map((t) =>
          t.replace(/\s(distance|etag)="[^"]*"/g, ""),
        ),
      });
    vars.m44 = JSON.stringify({ before: group(s) });
  },
  async post(req, res) {
    const H = "http://" + env.host + ":11000";
    const body = String(res.body || "");
    const r = JSON.parse(vars.m44);
    r.answer = {
      status: res.status,
      type: String(res.header("content-type") || ""),
      root: (body.match(/<\w+\b[^>]*>/) || [""])[0].slice(0, 400),
      bytes: body.length,
    };
    const s = String(
      (await http.get(H + "/SyncStatus", { responseType: "text", transformResponse: (x) => x })).data || "",
    );
    const group = (x) =>
      JSON.stringify({
        root: ["zoneController", "zone", "group", "channelMode"].map(
          (n) => (x.match(new RegExp("<SyncStatus\\b[^>]*\\s" + n + '="([^"]*)"')) || [])[1] || "",
        ),
        members: (x.match(/<(zoneSlave|slave|master)\b[^>]*>/g) || []).map((t) =>
          t.replace(/\s(distance|etag)="[^"]*"/g, ""),
        ),
      });
    r.after = group(s);
    r.sameAsSyncStatus = r.answer.root.split(" ")[0] === "<SyncStatus";
    vars.m44 = JSON.stringify(r);
    save("verify-setmaster.json", JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.m44);
    test("HTTP 200", () => expect(r.answer.status).to.equal(200));
    test("grouping unchanged", () => expect(r.after).to.equal(r.before));
  },
});

request("M45 AddShare and RemoveShare (test share, port 80)", {
  method: "POST",
  url: `http://${env.host}:80/AddShare`,
  async pre(req) {
    // Manual requests run only with the environment variable runManual = true
    if (!env.runManual) {
      req.skip();
      return;
    }
    // The BluOS app adds a folder of the computer as a library share: POST :80/AddShare (form: sharename, username,
    // password), and removes it with POST :80/RemoveShare (form: sharename). This request adds a test share on the
    // player's own address (no SMB server there, no real account): the mount fails, the player answers
    // "Addshare failed" only after several minutes and stores nothing; RemoveShare then answers "Share not found".
    // No /Reindex is sent. Test shares left over by an earlier run are removed first.
    const H80 = "http://" + env.host + ":80";
    const opt = { responseType: "text", transformResponse: (x) => x, validateStatus: () => true, timeout: 60000 };
    const form = { ...opt, headers: { "Content-Type": "application/x-www-form-urlencoded" } };
    const names = (x) => [...x.matchAll(/<sharename>([^<]*)<\/sharename>/g)].map((m) => m[1]);
    const shares = async () => names(String((await http.get(H80 + "/Shares", opt)).data || ""));
    const leftover = (await shares()).filter((n) => /\\blualbum-test$/.test(n));
    for (const n of leftover) await http.post(H80 + "/RemoveShare", "sharename=" + encodeURIComponent(n), form);
    const before = await shares();
    const share = "\\\\127.0.0.1\\blualbum-test";
    vars.m45 = JSON.stringify({ share, leftover, before });
    req.body = "sharename=" + encodeURIComponent(share) + "&username=guest&password=";
    req.headers["Content-Type"] = "application/x-www-form-urlencoded";
  },
  async post(req, res) {
    const H80 = "http://" + env.host + ":80";
    const names = (x) => [...x.matchAll(/<sharename>([^<]*)<\/sharename>/g)].map((m) => m[1]);
    const shares = async () =>
      names(
        String(
          (await http.get(H80 + "/Shares", { responseType: "text", transformResponse: (x) => x, timeout: 60000 }))
            .data || "",
        ),
      );
    const r = JSON.parse(vars.m45);
    r.add = {
      status: res.status,
      type: String(res.header("content-type") || ""),
      body: String(res.body || "").slice(0, 1000),
    };
    await new Promise((ok) => setTimeout(ok, 2000));
    r.afterAdd = await shares();
    const rm = await http.post(H80 + "/RemoveShare", "sharename=" + encodeURIComponent(r.share), {
      responseType: "text",
      transformResponse: (x) => x,
      validateStatus: () => true,
      timeout: 60000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    r.remove = { status: rm.status, body: String(rm.data || "").slice(0, 1000) };
    await new Promise((ok) => setTimeout(ok, 2000));
    r.afterRemove = await shares();
    vars.m45 = JSON.stringify(r);
    save("verify-addshare.json", JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
  },
  async tests(req, res, test) {
    const r = JSON.parse(vars.m45);
    // The test share cannot be mounted: the player answers after the mount attempt and stores nothing
    test("AddShare: HTTP 200, Addshare failed", () => {
      expect(r.add.status).to.equal(200);
      expect(r.add.body).to.contain("<message>Addshare failed</message>");
    });
    test("Shares without the test share", () => expect(r.afterAdd).to.not.include(r.share));
    test("RemoveShare: HTTP 200, Share not found", () => {
      expect(r.remove.status).to.equal(200);
      expect(r.remove.body).to.contain("<message>Share not found</message>");
    });
    test("Shares as before", () => expect(r.afterRemove).to.deep.equal(r.before));
  },
});
