// Shared helpers of the API tests: configuration, player requests, fixtures, XML helpers, assertions.
// No dependencies: node:test, fetch and node:assert of Node.js only.
// Every request of a test file is declared with request(name, { method, url, headers, form, multipart, pre, post, tests }):
//   form { field: value }   URL-encoded body; multipart { field: value | { file } } with a file relative to tests/api
//   pre(req)            may change req.url / req.headers / req.method / req.body / req.timeout or call req.skip()
//   post(req, res)      reads the answer, saves fixtures, stores values for later requests in vars
//   tests(req, res, test)  the checks; each test(name, fn) is a subtest
// The requests of one file run in order; values pass from one request to the next through vars.
const fs = require("fs"),
  path = require("path");
const nodeTest = require("node:test");
const assert = require("node:assert");

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(ROOT, "fixtures");

// config.json (host, saveFixtures, runManual); PLAYER, SAVE_FIXTURES and RUN_MANUAL override it
const env = (() => {
  const file = path.join(ROOT, "config.json");
  const c = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const flag = (v, def) => (v === undefined ? def : v === "1" || v === "true");
  const e = {
    host: process.env.PLAYER || c.host || "",
    saveFixtures: flag(process.env.SAVE_FIXTURES, c.saveFixtures !== false),
    runManual: flag(process.env.RUN_MANUAL, c.runManual === true),
  };
  if (!e.host) throw new Error("No player: set PLAYER=<IP address> or host in tests/api/config.json");
  return e;
})();

// Values passed from one request to the next (unset: undefined)
const vars = {};

// Every request sends Accept-Language: en, as the app does, unless the request sets its own
const DEFAULT_HEADERS = { "Accept-Language": "en" };

// One HTTP request with a timeout; redirect "manual" returns the 3xx answer itself
async function send(url, { method = "GET", headers = {}, body, timeout = 60000, redirect = "follow" } = {}) {
  const t0 = Date.now();
  let r;
  try {
    r = await fetch(url, {
      method,
      headers: { ...DEFAULT_HEADERS, ...headers },
      body,
      redirect,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const err = new Error(
      e.name === "TimeoutError" ? `timeout of ${timeout} ms exceeded` : (e.cause && e.cause.message) || e.message,
    );
    err.code = e.name === "TimeoutError" ? "ECONNABORTED" : (e.cause && e.cause.code) || e.code;
    throw err;
  }
  const buffer = Buffer.from(await r.arrayBuffer());
  const hdrs = {};
  r.headers.forEach((v, k) => (hdrs[k] = v));
  return { status: r.status, headers: hdrs, buffer, text: buffer.toString("utf8"), time: Date.now() - t0 };
}

// The same over https without checking the certificate (the player's is self-signed); no redirects
function sendInsecure(url, { method = "GET", headers = {}, body, timeout = 60000 } = {}) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const r = require("node:https").request(
      url,
      { method, headers: { ...DEFAULT_HEADERS, ...headers }, rejectUnauthorized: false, timeout },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            text: buffer.toString("utf8"),
            time: Date.now() - t0,
          });
        });
      },
    );
    r.on("timeout", () =>
      r.destroy(Object.assign(new Error(`timeout of ${timeout} ms exceeded`), { code: "ECONNABORTED" })),
    );
    r.on("error", reject);
    if (body !== undefined) r.write(body);
    r.end();
  });
}

// JSON answers come parsed, every other answer as text
const parseBody = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Requests inside scripts, with the options of axios that the tests use:
// headers, timeout, validateStatus, maxRedirects: 0, responseType "text" / "arraybuffer", transformResponse.
// Resolves to { status, data, headers }; rejects on other status than 2xx unless validateStatus allows it.
const http = {
  async get(url, opts = {}) {
    return this.request(url, { ...opts, method: "GET" });
  },
  async post(url, data, opts = {}) {
    return this.request(url, { ...opts, method: "POST", data });
  },
  async request(url, opts) {
    const body =
      opts.data === undefined || typeof opts.data === "string" || Buffer.isBuffer(opts.data)
        ? opts.data
        : JSON.stringify(opts.data);
    const o = {
      method: opts.method,
      headers: opts.headers,
      body,
      timeout: opts.timeout || 60000,
      redirect: opts.maxRedirects === 0 ? "manual" : "follow",
    };
    const r = opts.httpsAgent ? await sendInsecure(url, o) : await send(url, o);
    const data = opts.responseType === "arraybuffer" ? r.buffer : opts.transformResponse ? r.text : parseBody(r.text);
    const res = { status: r.status, data, headers: r.headers };
    const ok = opts.validateStatus ? opts.validateStatus(r.status) : r.status >= 200 && r.status < 300;
    if (!ok) {
      const err = new Error(`Request failed with status code ${r.status}`);
      err.response = res;
      throw err;
    }
    return res;
  },
};

// Stores an answer in fixtures/ (only with saveFixtures, unless always); file may name a sub folder
function save(file, text, always = false) {
  if (!env.saveFixtures && !always) return;
  const f = path.join(FIXTURES, file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}

// XML helpers: entity decoding and an attribute of a start tag
const dec = (v) =>
  v
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const attr = (tag, n) => {
  const m = tag.match(new RegExp("\\s" + n + '="([^"]*)"'));
  return m ? dec(m[1]) : "";
};

// Assertions in the style expect(x).to.equal(y), the forms the tests use
const show = (v) =>
  typeof v === "string" ? JSON.stringify(v.length > 200 ? v.slice(0, 200) + "…" : v) : JSON.stringify(v);
const typeName = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
function expect(actual, msg) {
  let neg = false,
    deep = false;
  const check = (ok, text) => {
    if (ok === neg) assert.fail((msg ? msg + ": " : "") + "expected " + show(actual) + (neg ? " not " : " ") + text);
  };
  const has = (x) =>
    typeof actual === "string" ? actual.includes(x) : Array.isArray(actual) ? actual.includes(x) : false;
  const isDeep = (x) => {
    try {
      assert.deepStrictEqual(actual, x);
      return true;
    } catch {
      return false;
    }
  };
  const c = {
    equal: (x) => check(deep ? isDeep(x) : actual === x, "to equal " + show(x)),
    above: (n) => check(actual > n, "to be above " + n),
    most: (n) => check(actual <= n, "to be at most " + n),
    least: (n) => check(actual >= n, "to be at least " + n),
    below: (n) => check(actual < n, "to be below " + n),
    within: (a, b) => check(actual >= a && actual <= b, `to be within ${a}..${b}`),
    match: (re) => check(re.test(String(actual)), "to match " + re),
    include: (x) => check(has(x), "to include " + show(x)),
    contain: (x) => check(has(x), "to contain " + show(x)),
    a: (t) => check(typeName(actual) === t, "to be a " + t),
    an: (t) => check(typeName(actual) === t, "to be an " + t),
  };
  for (const w of ["to", "be", "at", "been", "is", "that", "which", "and", "has", "have", "with"])
    Object.defineProperty(c, w, { get: () => c });
  Object.defineProperty(c, "not", { get: () => ((neg = !neg), c) });
  Object.defineProperty(c, "deep", { get: () => ((deep = true), c) });
  Object.defineProperty(c, "true", { get: () => check(actual === true, "to be true") });
  Object.defineProperty(c, "false", { get: () => check(actual === false, "to be false") });
  Object.defineProperty(c, "ok", { get: () => check(!!actual, "to be truthy") });
  return c;
}

// One player request as a test: pre → request → post → tests
function request(name, def) {
  nodeTest.test(name, async (t) => {
    let skipped = false;
    const req = {
      method: def.method || "GET",
      url: def.url,
      headers: { ...(def.headers || {}) },
      body: def.body,
      timeout: def.timeout || 60000,
      skip: () => (skipped = true),
    };
    if (def.pre) await def.pre(req);
    if (skipped) return t.skip();
    // Form bodies, built only now: a multipart file may be written by an earlier request
    if (def.form && req.body === undefined) req.body = new URLSearchParams(def.form);
    if (def.multipart && req.body === undefined) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(def.multipart))
        if (typeof v === "object")
          fd.append(k, new Blob([fs.readFileSync(path.join(ROOT, v.file))]), path.basename(v.file));
        else fd.append(k, v);
      req.body = fd;
    }
    const r = await send(req.url, req);
    const res = {
      status: r.status,
      headers: r.headers,
      buffer: r.buffer,
      text: r.text,
      body: parseBody(r.text),
      time: r.time,
    };
    res.header = (n) => r.headers[n.toLowerCase()];
    // test(name, fn) runs fn at once (later code of the request may change the values it checks) and reports it as a subtest
    const subs = [];
    const test = (n, fn) => {
      let out;
      try {
        out = Promise.resolve(fn());
      } catch (e) {
        out = Promise.reject(e);
      }
      out.catch(() => {});
      subs.push(t.test(n, () => out));
    };
    if (def.post)
      try {
        await def.post(req, res, test);
      } catch (e) {
        test("post-response script", () => {
          throw e;
        });
      }
    if (def.tests) await def.tests(req, res, test);
    await Promise.all(subs);
  });
}

module.exports = { ROOT, FIXTURES, env, vars, send, http, save, dec, attr, expect, request };
