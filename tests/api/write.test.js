// Folder "2 Write (changes the player)": every command of the app (C), queue and playback commands (W01–W15),
// settings, playlist and name commands (S), autoplay URLs, favourites and moves (W16–W39), in this order.
// Playback is interrupted; every change is restored by the requests themselves, the queue position (C44 loads
// the queue from a playlist) by the last but one test. The last test compares the player state with a snapshot
// taken before the first request.
const { before, test } = require("node:test");
const assert = require("node:assert");
const { env, send, save } = require("./lib/player");
const { snapshot } = require("./lib/state");

const H = `http://${env.host}:11000`;
const val = (body, t) => (body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "";
let start, pos;
before(async () => {
  start = await snapshot();
  const st = (await send(H + "/Status")).text;
  pos = { song: val(st, "song"), secs: val(st, "secs"), state: val(st, "state"), service: val(st, "service") };
  save("state-before-write.json", JSON.stringify({ ...start, position: pos }, null, 2));
});

// The app reads (A) first: C05–C09 and C22–C25 use the album of A07 and A09
require("./read/app");
require("./write/commands");
require("./write/playback");
require("./write/settings");
require("./write/queue-favourites");

test("Queue position and play state as before the run", async (t) => {
  // Only when the player played from the queue at the start
  if (pos.song === "" || pos.service === "") return t.skip("no queue entry at the start");
  const playing = (s) => ["play", "stream"].includes(s);
  let r = await send(H + "/Play?seek=" + (pos.secs || "0") + "&id=" + pos.song);
  assert.strictEqual(r.status, 200);
  if (!playing(pos.state)) {
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await send(H + "/Pause");
    assert.strictEqual(r.status, 200);
  }
  // The player needs a moment until it plays again: up to 10 s
  let st = "";
  for (let i = 0; i < 10; i++) {
    await new Promise((ok) => setTimeout(ok, 1000));
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
