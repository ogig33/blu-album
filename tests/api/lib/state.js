// Snapshot of the player state that the write requests change and restore, read only.
// write.test.js takes one before the first request and compares it with one after the last.
const { env, send, attr } = require("./player");

const H = () => `http://${env.host}:11000`;
const text = async (p) => (await send(H() + p, { timeout: 15000 })).text;
const val = (body, t) => (body.match(new RegExp("<" + t + ">([^<]*)</" + t + ">")) || [])[1] || "";
const tags = (body, name) => body.match(new RegExp("<" + name + "\\b[^>]*>", "g")) || [];
// Answer without values that change on every request (etag, library and queue ids)
const stable = (body) => body.replace(/\s(etag|id)="[^"]*"/g, "");

async function snapshot() {
  const st = await text("/Status");
  const s = {
    status: ["state", "volume", "db", "mute", "repeat", "shuffle", "song", "service"]
      .map((t) => t + "=" + val(st, t))
      .join(" "),
    name: val(await text("/Name"), "name"),
  };
  // Queue: length and every file (first 1000 entries)
  const q = await text("/Playlist?start=0&end=999");
  s.queue =
    "length " +
    attr(tags(q, "playlist")[0] || "", "length") +
    ": " +
    [...q.matchAll(/<fn>([^<]*)<\/fn>/g)].map((m) => m[1]).join(" | ");
  // Settings pages the write requests change: every setting with a value
  for (const id of ["player", "audio"]) {
    const x = await text(`/Settings?schemaVersion=36&id=${id}`);
    s["settings " + id] = tags(x, "setting")
      .filter((t) => / value="/.test(t))
      .map((t) => attr(t, "id") + "=" + attr(t, "value"))
      .join(" ");
  }
  s.listeningMode = attr(tags(await text("/audioPreset"), "setting")[0] || "", "value");
  s.playlists = [...(await text("/Playlists")).matchAll(/<name\b[^>]*>([^<]*)<\/name>/g)].map((m) => m[1]).join(" | ");
  s.presets = tags(await text("/Presets"), "preset")
    .map((t) => attr(t, "id") + ":" + attr(t, "name"))
    .join(" | ");
  for (const ep of ["Albums", "Songs", "Artists"])
    s["favourite " + ep.toLowerCase()] = stable(await text(`/library/v1/${ep}?service=LocalMusic&category=FAVOURITES`));
  return s;
}

module.exports = { snapshot };
