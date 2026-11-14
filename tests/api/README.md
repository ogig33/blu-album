# BluAlbum – API tests (Bruno)

Contract tests for every player request the app uses and for the endpoints of the API reference [`docs/bluos-api.md`](../../docs/bluos-api.md). They check the **structure** of the answers (elements, attributes), not concrete albums or numbers.

## Setup
1. Bruno: *Open Collection* → choose this folder.
2. Select the environment **Home** (top right). Set `host` to the IP address of your player.
3. Collection settings → *JavaScript sandbox* → **Developer mode** (needed for writing fixtures and for the requests that ask the player several times). Or set `saveFixtures` to `false`.
4. `runManual` stays `false`; set it to `true` only to run the manual folder.

## Before a run
- A queue with at least 2 entries, playing or paused (not a radio stream).
- At least one preset.
- A USB drive is optional; USB requests are skipped without one.

## Run the whole suite (e.g. after a firmware update)
Run the **whole collection** in the Runner (or `bru run -r --env Home` in this folder). The folders run in order:

| Folder | What it does | Effect on the player |
|---|---|---|
| **1 Read (safe)** | Every read request of the app (01–26), album details and the variants the app uses (E01–E13), the reference endpoints that only read (V01–V25, including the whole settings tree and the app screens `/ui/…`) | none |
| **2 Write (changes the player)** | Every command of the app (01–47), queue and playback commands of the reference (W01–W15), settings and playlist commands of the reference (S01–S33) | playback is interrupted; queue, position, pause state, volume, repeat, favourite and every changed setting are restored, test playlists deleted |
| **3 Manual (run on purpose)** | Doorbell, library rescan, test preset, reboot | skipped unless `runManual = true` |

After a firmware update, compare `23-api-version.xml` and `24-bluos-version.xml` in `fixtures/` with the versions in the reference and look at the failed tests.

CLI: `npm i -g @usebruno/cli`, then in this folder `bru run -r --env Home` (whole suite) or `bru run "1 Read (safe)" --env Home` (one folder).

## Folders in detail

### 1 Read (safe)
- **01–26**: every read request of the app. Later requests use keys found by earlier ones, so run the folder in order.
- **E01–E13**: more details of the first album (library album, songs, track context menu, technical info, track info) and the songs of a USB album (E07, E08). E01–E08 check only HTTP 200, the answers go to `fixtures/explore-*.xml`. E09–E13 check variants the app uses: the album track list without context menus (E09) and the albums of an artist through the artist's browse menu, for the library (E10, E11) and USB (E12, E13). New API variants are tried here first.
- **V01–V12**: reference endpoints that only read: `/SyncStatus`, `/Presets`, `/RadioBrowse?service=Capture`, `/Services`, `/Settings?id=audio`, `/Settings?id=capture&schemaVersion=32`, `/sharecfg` (port 80), the first new library album with `/AddToPlaylistOptions` and `/library/v1/Playlists` (imported, favourites). V12 reads the whole settings tree (`/Settings?schemaVersion=36` and every menu page, no buttons) into `fixtures/settings/` with a list of all endpoints found in `_summary.txt`. V13–V20 read the screens of the BluOS app (`/ui/Home`, `/ui/Sources`, `/ui/Queue`, `/ui/presets`, `/ui/myPlaylistsRow`, `/ui/BrowseObjects`, `/ui/browseContext`, `/ui/ContextMenu`), V21–V25 `/ui/Favourites`, `/ui/RecentlyPlayed`, `/ui/queueItemCM`, `/AddToPlaylistOptions?saveQueue=1` and `/ui/Configuration`. Not called: `/ui/prf` (runs a request), `/ui/action` (changes the display), `/ui/clearUsageHistory` (deletes the history). Answers go to `fixtures/verify-*`.

### 2 Write (changes the player)
- **01–47**: every command the app uses: favourite, play album, pause, resume, skip, back, play queue entry, seek, add to queue, remove from queue, shuffle on / off, repeat (queue / track / off), volume (level, ±dB), clear, save / load / delete playlist. The queue is saved as `__bluos_album_player_test__` at the start and loaded again at the end; favourite, repeat and volume are restored, the test playlist is deleted. It also checks that the playlist id (`/Playlist` id = `<pid>` of `/Status`) changes after add, remove, shuffle on / off, clear and load – the app reloads the queue only on this change.
- **W01–W15**: moves the first queue entry and back (`/Move`), stops (`/Stop`), loads the next preset (`/Preset?id=+1`), skips on the radio station if it offers a skip action (`/Action`), returns to the former queue entry and position (`/Play?seek=…&id=…`), pauses again if it was not playing and restores the volume.
- **S01–S33**: reads a setting, changes it, checks the new value and restores it: indicator brightness (`/setting`), replay gain (`/audiomodes`), balance (`/alsa_setting`), trim of a fixed group member (`/SlaveVolume`, skipped without a fixed group). Reads through `/proxyToSlave`, the playlist backup `/download_playlists_api`, `/redirectToCp`, the web pages `/wificfg` and `/triggercfg` and `/Info?infourl=…` (only when the playing item has an info URL). Saves the queue as test playlist `__bluos_verify__`, adds an album with `/AddToPlaylist` and deletes the playlist.

### 3 Manual (run on purpose)
Every request is skipped unless `runManual = true`. Set it, run the folder (or single requests), set it back.
- **S26**: doorbell chime (`/Doorbell`; players without a chime answer `Not supported`).
- **S27–S28**: library rescan (`/Reindex`); it runs in the background for minutes.
- **S34–S36**: stores a test preset `__bluos_verify__` (`/SetPreset`). No request to delete a preset is known – remove it in the BluOS app.
- **R01–R02**: soft reboot (`POST` to port 80 `/reboot`), then waits until `/SyncStatus` answers again (at most 5 minutes) and logs how long the restart took.

## Fixtures
With `saveFixtures = true` every request stores its answer in `fixtures/` (next to this README). The folder is ignored by git: the answers contain details of your network and library (IP addresses, share names, room name).

To use them for the UI tests, copy them without personal details (from the repository root):

```
node tests/tools/sanitize-fixtures.js
```

`23-api-version.xml` and `24-bluos-version.xml` record which player software the answers come from (API version from `/Version`, BluOS version from `/GitVersion`).
