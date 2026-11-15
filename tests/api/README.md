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
| **1 Read (safe)** | Every read request of the app (A01–A26), album details, the variants the app uses and new candidates (E01–E21), the reference endpoints that only read (V01–V47, including the whole settings tree and the app screens `/ui/…`) | none |
| **2 Write (changes the player)** | Every command of the app (C01–C47), queue and playback commands of the reference (W01–W15), settings, playlist and name commands of the reference (S01–S40) | playback is interrupted; queue, position, pause state, volume, repeat, favourite and every changed setting are restored, test playlists deleted |
| **3 Manual (run on purpose)** | Doorbell, library rescan, test preset, reboot | skipped unless `runManual = true` |

After a firmware update, compare `23-api-version.xml` and `24-bluos-version.xml` in `fixtures/` with the versions in the reference and look at the failed tests.

CLI: `npm i -g @usebruno/cli`, then in this folder `bru run -r --env Home` (whole suite) or `bru run "1 Read (safe)" --env Home` (one folder).

## Folders in detail

Every request has a unique prefix: **A** app reads, **E** album details / new variants, **V** reference reads (folder 1); **C** app commands, **W** queue and playback, **S** settings and playlists (folder 2); **M** manual (folder 3). Fixture files of the app requests keep the number without the letter (`A19 Status` → `19-status.xml`).

### 1 Read (safe)
- **A01–A26** (app): every read request of the app. Later requests use keys found by earlier ones, so run the folder in order.
- **E01–E21**: more details of the first album (library album, songs, track context menu, technical info, track info) and the songs of a USB album (E07, E08). E01–E08 check only HTTP 200, the answers go to `fixtures/explore-*.xml`. E09–E13 check variants the app uses: the album track list without context menus (E09) and the albums of an artist through the artist's browse menu, for the library (E10, E11) and USB (E12, E13). E14–E21 check candidates that are not used yet: the albums of a genre without sections through `/ui/browseGrouped` with the genre album list as url, as the BluOS app asks them (E14 library, E15 + E16 USB; the browse key `Album/…genre=…` and `/library/v1/Albums?genre=…` without section answered empty); the artist list of the first favourite and whether it marks the favourite (E17); the album section of the first favourite without context menus, which must keep the favourite state (E18); New (E19), Favourites (E20) and a quality section (E21) as browse lists with the player's play URLs and context menus. Answers go to `fixtures/explore-14…21-*.xml`, counts and paging to the console. New API variants are tried here first.
- **V01–V12**: reference endpoints that only read: `/SyncStatus`, `/Presets`, `/RadioBrowse?service=Capture`, `/Services`, `/Settings?id=audio`, `/Settings?id=capture&schemaVersion=32`, `/sharecfg` (port 80), the first new library album with `/AddToPlaylistOptions` and `/library/v1/Playlists` (imported, favourites). V12 reads the whole settings tree (`/Settings?schemaVersion=36` and every menu page, no buttons) into `fixtures/settings/` with a list of all endpoints found in `_summary.txt`. V13–V20 read the screens of the BluOS app (`/ui/Home`, `/ui/Sources`, `/ui/Queue`, `/ui/presets`, `/ui/myPlaylistsRow`, `/ui/BrowseObjects`, `/ui/browseContext`, `/ui/ContextMenu`), V21–V25 `/ui/Favourites`, `/ui/RecentlyPlayed`, `/ui/queueItemCM`, `/AddToPlaylistOptions?saveQueue=1` and `/ui/Configuration`; V26–V31 `/ui/nowPlayingCM`, `/ui/Search`, `/ui/browseMenuGroup`, `/ui/browseGrouped`, `/ui/browseGenres` and `/Shares`; V32–V40 the diagnostics and support pages (`/diag`, `/diagnostics`, `/settings/sendSupportRequest` – only read, nothing is sent), `/Settings?view=web`, `/Dataexport`, `/error?1` (not cleared), `/ui/News`, `/ui/resolveSoviURL` and `/ui/prf` with a read request (`/Volume`); V41–V46 library answers for the response examples of the reference (`/library/v1/Artists`, `Composers`, `Search`, `Albums` with `artist` and with `album` + `artist`, `Folders`); V47 the lyrics of the playing track (`/Info?lyricsid=…`, only when `/Status` has a `lyricsid`, e.g. Radio Paradise). Not called: `/ui/prf` (runs a request), `/ui/action` (changes the display), `/ui/clearUsageHistory` (deletes the history). Answers go to `fixtures/verify-*`.

### 2 Write (changes the player)
- **C01–C47** (commands): every command the app uses: favourite, play album, pause, resume, skip, back, play queue entry, seek, add to queue, remove from queue, shuffle on / off, repeat (queue / track / off), volume (level, ±dB), clear, save / load / delete playlist. The queue is saved as `__bluos_album_player_test__` at the start and loaded again at the end; favourite, repeat and volume are restored, the test playlist is deleted. It also checks that the playlist id (`/Playlist` id = `<pid>` of `/Status`) changes after add, remove, shuffle on / off, clear and load – the app reloads the queue only on this change.
- **W01–W15**: moves the first queue entry and back (`/Move`), stops (`/Stop`), loads the next preset (`/Preset?id=+1`), skips on the radio station if it offers a skip action (`/Action`), returns to the former queue entry and position (`/Play?seek=…&id=…`), pauses again if it was not playing and restores the volume.
- **S01–S40**: reads a setting, changes it, checks the new value and restores it: indicator brightness (`/setting`), replay gain (`/audiomodes`), balance (`/alsa_setting`), trim of a fixed group member (`/SlaveVolume`, skipped without a fixed group). Reads through `/proxyToSlave`, the playlist backup `/download_playlists_api`, `/redirectToCp`, the web pages `/wificfg` and `/triggercfg` and `/Info?infourl=…` (only when the playing item has an info URL). Saves the queue as test playlist `__bluos_verify__`, adds an album with `/AddToPlaylist` and deletes the playlist; renames the player with `/Name?set=` and back (S31–S35); switches the USB server mode (`/setting?server=`) and back (S36–S40).

### 3 Manual (run on purpose)
Every request is skipped unless `runManual = true`. Set it, run the folder (or single requests), set it back.
- **M01**: doorbell chime (`/Doorbell`; players without a chime answer `Not supported`).
- **M02–M03**: library rescan (`/Reindex`); it runs in the background for minutes.
- **M04–M06**: stores a test preset `__bluos_verify__` (`/SetPreset`). No request to delete a preset is known – remove it in the BluOS app.
- **M09–M12**: saves a backup of the playlists (`/download_playlists_api`, to `fixtures/verify-playlists-backup.json`), uploads the same backup again (`/upload_playlists_api`) and checks that the playlists are unchanged. Needs `saveFixtures = true`; the upload is skipped without a fresh backup.
- **M14–M18**: switches the statistics collection (`/statistics?enable=0|1`, port 80) and back, read from the diagnostics page. While it is on, the player may send usage statistics to Bluesound.
- **M19–M20**: rebuild index (`/delete_index`, port 80) – the library index is deleted and the whole library is scanned again; then `/Status`.
- **M21**: `/UpdateDNS` (answers empty, no visible effect; purpose not known).
- **M13**: clears the recent stations (`/ui/clearUsageHistory?stations=1`) – the history is lost.
- **M07–M08**: soft reboot (`POST` to port 80 `/reboot`), then waits until `/SyncStatus` answers again (at most 5 minutes) and logs how long the restart took.

## Fixtures
With `saveFixtures = true` every request stores its answer in `fixtures/` (next to this README). The folder is ignored by git: the answers contain details of your network and library (IP addresses, share names, room name).

To use them for the UI tests, copy them without personal details (from the repository root):

```
node tests/tools/sanitize-fixtures.js
```

`23-api-version.xml` and `24-bluos-version.xml` record which player software the answers come from (API version from `/Version`, BluOS version from `/GitVersion`).
