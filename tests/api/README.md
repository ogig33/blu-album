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
  without a USB drive). E01–E08 check only HTTP 200; the answers go to the
  console and to `fixtures/explore-*.xml`. E09–E13 check variants the app uses:
  the album track list without context menus (E09) and the albums of an artist
  through the artist's browse menu, for the library (E10, E11) and USB (E12, E13).
- **4 Verify reference (safe)**: only reads. Checks endpoints of the API reference [`docs/bluos-api.md`](../../docs/bluos-api.md) that are not verified yet (column "Verified"): `/SyncStatus`, `/Presets`, `/RadioBrowse?service=Capture`, `/Services`, `/Settings?id=audio`, `/Settings?id=capture&schemaVersion=32` and the network shares page `/sharecfg` on port 80; V08–V11 the first new library album, `/AddToPlaylistOptions` for it and `/library/v1/Playlists` (imported, favourites); V12 reads the whole settings tree (`/Settings?schemaVersion=36` and every menu page with `?id=`, no buttons) into `fixtures/settings/` with a list of all endpoints found in `_summary.txt`. Every answer goes to the console and to `fixtures/verify-*`. Runs on its own, no other folder needed.
- **5 Verify reference (changes the player)**: run on purpose, while the player plays (or is paused) from a queue with at least 2 entries and at least one preset exists. Moves the first queue entry and back (`/Move`), stops (`/Stop`), loads the next preset (`/Preset?id=+1`), skips on the radio station if the player offers a skip action (`/Action`), then returns to the former queue entry and position (`/Play?seek=…&id=…`), pauses again if it was not playing and restores the volume. Answers go to `fixtures/verify-*`.
- **6 Verify reference (settings and system)**: run on purpose, with a non-empty queue and at least one preset. Reads a setting, changes it, checks the new value and restores it: indicator brightness (`/setting`), replay gain (`/audiomodes`), balance (`/alsa_setting`) and the trim of a fixed group member (`/SlaveVolume`, skipped without a fixed group). Reads through `/proxyToSlave`, the playlist backup `/download_playlists_api`, `/redirectToCp`, the web pages `/wificfg` and `/triggercfg` and `/Info?infourl=…` (only when the playing item has an info URL). Then, with noticeable effects: plays the doorbell chime (`/Doorbell`), starts a library rescan (`/Reindex`), saves the queue as test playlist `__bluos_verify__`, adds an album with `/AddToPlaylist` (the playlist parameter `name` is a guess) and deletes the playlist, and stores a test preset `__bluos_verify__` with `/SetPreset` – no request to delete a preset is known, remove it in the BluOS app.
- **7 Reboot (restarts the player)**: run on purpose only. Sends the official soft reboot (`POST` to port 80 `/reboot` with the form field `yes=1`), then waits until `/SyncStatus` answers again (at most 5 minutes) and logs how long the restart took. Playback stops; the player is unreachable during the restart.
- The Write folder also checks that the playlist id (`/Playlist` id = `<pid>` of
  `/Status`) changes after adding, removing, shuffle on / off, clear and load –
  the app reloads the queue only on this change.

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
