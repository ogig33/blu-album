// Block "2 Write" (test-cases.md): every command of the app (C), queue and playback commands (W01–W15),
// settings, playlist and name commands (S), autoplay URLs, favourites and moves (P01–P24), in this order.
// Playback is interrupted; every change is restored by the requests themselves, the queue position (C44 loads
// the queue from a playlist) by the last but one test. The last test compares the player state with a snapshot
// taken before the first request.
// Start state: the requests need a queue of at least MIN_QUEUE entries playing or paused. When the player lacks
// it, prepare() saves the queue as START_NAME, queues library albums and plays them; the queue is loaded again
// at the end.
const { before, test } = require("node:test");
const assert = require("node:assert");
const { env, send, save, attr, dec } = require("./lib/player");
const { snapshot } = require("./lib/state");

const H = `http://${env.host}:11000`;
const START_NAME = "__bluos_api_test_start__";
const MIN_QUEUE = 11; // P10 plays the second page of the saved queue (10 entries per page)
const val = (body, t) => (body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "";
const get = async (p) => (await send(H + p, { timeout: 15000 })).text;
const items = (xml) => xml.match(/<item\b[^>]*>/g) || [];
const queueLength = async () =>
  +attr((await get("/Playlist?start=0&end=0")).match(/<playlist\b[^>]*>/)?.[0] || "", "length") || 0;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let start, pos, prepared;

// Sets up the start state when the player lacks it; returns { saved } (the original queue was saved) or null
async function prepare() {
  const st = await get("/Status");
  const len = await queueLength();
  const fromQueue = !/<streamUrl>/.test(st) && val(st, "song") !== "" && ["play", "pause"].includes(val(st, "state"));
  if (fromQueue && len >= MIN_QUEUE) return null;
  if (len && !/<entries>[1-9]/.test(await get("/Save?name=" + START_NAME)))
    throw new Error("could not save the queue as " + START_NAME);
  // Library albums, section by section, through /Browse (the player's own "Add last" URLs)
  const lib = items(await get("/Browse")).find((t) => /LibraryIcon/.test(attr(t, "image")));
  if (!lib) throw new Error("no library source to set up the queue");
  const albumsLink = items(await get("/Browse?key=" + encodeURIComponent(attr(lib, "browseKey")))).find((t) =>
    /bySection:Album/.test(attr(t, "browseKey")),
  );
  const sections = albumsLink
    ? items(await get("/Browse?key=" + encodeURIComponent(attr(albumsLink, "browseKey")))).filter(
        (t) => attr(t, "type") === "section" && attr(t, "text2") !== "0",
      )
    : [];
  await get("/Clear");
  for (const sec of sections) {
    const list = await get("/Browse?withContextMenuItems=1&key=" + encodeURIComponent(attr(sec, "browseKey")));
    for (const m of list.matchAll(/<item actionURL="([^"]*)"[^>]*type="addAll-last"/g)) {
      await get(dec(m[1]));
      if ((await queueLength()) >= MIN_QUEUE) break;
    }
    if ((await queueLength()) >= MIN_QUEUE) break;
  }
  if ((await queueLength()) < MIN_QUEUE) throw new Error(`the library has fewer than ${MIN_QUEUE} tracks`);
  await get("/Play?id=0");
  await sleep(2000);
  console.log(
    `Start state set up: ${await queueLength()} library tracks queued and playing` +
      (len ? `, queue saved as ${START_NAME}` : ""),
  );
  return { saved: len > 0 };
}

before(async () => {
  start = await snapshot();
  const st = (await send(H + "/Status")).text;
  pos = { song: val(st, "song"), secs: val(st, "secs"), state: val(st, "state"), service: val(st, "service") };
  save("state-before-write.json", JSON.stringify({ ...start, position: pos }, null, 2));
  prepared = await prepare();
});

// The app reads (A) first: C05–C09 and C22–C25 use the album of A07 and A09
require("./read/app");
require("./write/commands");
require("./write/playback");
require("./write/settings");
require("./write/queue-favourites");

test("Queue as before the run (set up by the run)", async (t) => {
  if (!prepared) return t.skip("the start state was there already");
  assert.strictEqual((await send(H + "/Clear")).status, 200);
  if (prepared.saved) {
    assert.strictEqual((await send(H + "/Load?service=BluOS&name=" + START_NAME)).status, 200);
    await sleep(1500);
    assert.strictEqual((await send(H + "/Delete?service=BluOS&name=" + START_NAME)).status, 200);
  }
});

test("Queue position and play state as before the run", async (t) => {
  // Only when the player played from the queue at the start
  if (pos.song === "" || pos.service === "") return t.skip("no queue entry at the start");
  const playing = (s) => ["play", "stream"].includes(s);
  let r = await send(H + "/Play?seek=" + (pos.secs || "0") + "&id=" + pos.song);
  assert.strictEqual(r.status, 200);
  if (!playing(pos.state)) {
    await sleep(1500);
    r = await send(H + "/Pause");
    assert.strictEqual(r.status, 200);
  }
  // The player needs a moment until it plays again: up to 10 s
  let st = "";
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    st = (await send(H + "/Status")).text;
    if (val(st, "song") === pos.song && playing(val(st, "state")) === playing(pos.state)) break;
  }
  assert.strictEqual(val(st, "song"), pos.song);
  assert.strictEqual(playing(val(st, "state")), playing(pos.state));
});

test("Player state as before the run", async (t) => {
  const now = await snapshot();
  save("state-after-write.json", JSON.stringify(now, null, 2));
  for (const k of Object.keys(start)) await t.test(k, () => assert.strictEqual(now[k], start[k]));
});
