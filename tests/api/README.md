# BluAlbum – API tests (Bruno)

Contract tests for every player request the app uses. They check the **structure**
of the answers (elements, attributes), not concrete albums or numbers.

## Setup
1. Bruno: *Open Collection* → choose this folder.
2. Select the environment **Home** (top right). Set `host` to the IP address of your player.
3. For saving fixtures: Collection settings → *JavaScript sandbox* → **Developer mode**
   (needed for writing files). Or set `saveFixtures` to `false`.

## Run
- **1 Read (safe)**: only reads. Run the whole folder (Runner), in order –
  later requests use keys found by earlier ones. USB requests are skipped
  when no drive is connected.
- **2 Write (changes the player)**: run on purpose, after the Read folder, with a
  non-empty queue. Sends every command the app uses: favourite, play album, pause,
  resume, skip, back, play queue entry, seek, add to queue, remove from queue,
  shuffle on / off, repeat (queue / track / off), volume (level, +/- dB), clear,
  save / load / delete playlist. Playback is
  interrupted. Afterwards the queue is restored (saved as `__bluos_album_player_test__` at the start,
  loaded again at the end), the favourite, repeat and the volume are restored and the
  test playlist is deleted.

CLI (optional): `npm i -g @usebruno/cli`, then in this folder
`bru run "1 Read (safe)" --env Home`.

- **3 Explore album details (safe)**: only reads. Asks the player for more details
  of the first album from the Read folder (library album, songs, track context menu,
  technical info, track info) and the songs of a USB album (E07, E08; skipped
  without a USB drive). No checks besides HTTP 200; the answers go to the
  console and to `fixtures/explore-*.xml`.

## Fixtures
With `saveFixtures = true` every request stores its answer in `fixtures/` (next to
this README). The folder is ignored by git: the answers contain details of your
network and library (IP addresses, share names, room name).

To use them for the UI tests, copy them without personal details (from the repository root):

```
node tests/tools/sanitize-fixtures.js
```

`23-api-version.xml` and `24-bluos-version.xml` record which player software the
answers come from (API version from `/Version`, BluOS version from `/GitVersion`).
