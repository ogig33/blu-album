# Changelog

All notable changes to BluAlbum. Versions follow [semantic versioning](https://semver.org/):
PATCH for fixes and visual changes, MINOR for new features.

## Unreleased
- Docs: column "Verified" in every endpoint overview of `docs/bluos-api.md`; Bruno folder "4 Verify reference (safe)" checks the endpoints that are not verified yet (read-only ones first); folder "5 Verify reference (changes the player)" checks `/Move`, `/Stop`, `/Preset`, `/Action` and `/Play?seek=…&id=…` and restores the player afterwards. More endpoints found in `/Services` and `/Settings` (`/AddToPlaylistOptions`, `/library/v1/Playlists`, `/SlaveVolume`, `/redirectToCp`) and in the whole settings tree (Bruno V12: `/wificfg`, `/triggercfg`, `/download_playlists_api`, `/upload_playlists_api`, all `/setting` names); `/Info` back in the reference with its variants from `/Services`. Bruno folder "6 Verify reference (settings and system)" checks the remaining endpoints (settings with restore, port-80 pages, doorbell, reindex, add to playlist, set preset). Bruno folder "7 Reboot (restarts the player)" checks `/reboot` and waits for the player. Bruno collection reorganised into three folders – "1 Read (safe)", "2 Write (changes the player)" and "3 Manual (run on purpose)" (skipped unless `runManual = true`) – so the whole collection can run as one suite after a firmware update. Endpoints from a Wireshark capture of the BluOS app: alarm create / switch off (`/Alarms`), preset edit / delete (`/SetPreset`), `/RadioBrowse` for presets and alarm sources, new section "App UI" (`/ui/…`). Second capture: alarm delete, settings sent as POST with a JSON body, playlist restore (`/upload_playlists_api`, multipart) and backup format; Bruno V13–V25 read the app screens. Bruno requests renamed with unique prefixes (A, E, V in Read; C, W, S in Write; M in Manual). Third capture (playback, search, queue, presets, alarms, settings): `/Name?set=`, `/error`, `/Shares`, `/Save?create=1`, `/SetPreset?…&delete=1`, radio browsing and favourites, library paging, more `/ui` screens; Bruno V26–V31 and S31–S35. Reference: HTTP method before every endpoint (GET / POST), test player and BluOS version named at the top; endpoint-specific hints moved from "Basics" to the endpoints.
- Docs: new BluOS API reference `docs/bluos-api.md` (official Custom Integration API v1.7 and
  unofficial endpoints, grouped by category, with source tags); the BluAlbum-specific part moved
  to `docs/blu-album-api-usage.md` (was `api-calls.md`).

## 0.8.1
- Security: cover image URLs from player answers are checked (only on the player or http(s)),
  fixes the GitHub code scanning alerts "DOM text reinterpreted as HTML".
- Search while typing starts only from 3 characters and after a pause of 800 ms (was 500 ms),
  fewer player requests; Enter still searches at once.
- Fewer player requests (first connect 585 → 9 on the test library):
  - Album popup: no genre line any more, so the genre crawl on connect (and its "Reload" button)
    is gone; the player offers no genre per album.
  - Library statistics and player versions load when the about popup opens, not on connect.
  - No extra `/Status` + `/Volume` after commands; the status long polling reports the change.
  - Quality chips ask only the A–Z sections that contain albums (USB drive: 9 instead of 27);
    the section list is loaded once and shared with All and the statistics.
  - Genre albums: no more trial request for an unsectioned list.
  - Album popup reads the track list without the unused per-song context menus (about 60 % less data).
  - Artist click loads the artist's albums through the player's artist menu (2 requests per source)
    instead of the whole All list (≈ 36 requests).
  - The queue is loaded once after remove, shuffle and clear (through the new playlist id that the
    status reports); after a playlist chip only when the playlist id did not change.
  - Album popup: an album opened again in the same session needs no request.

## 0.8.0
- About popup: link to the GitHub repository.
- About popup: "Check for updates" asks GitHub for the latest release (only on click).

## 0.7.6
- Queue: larger remove button (x), same size as the queue controls.

## 0.7.5
- Queue: durations at the right edge; on hover the remove button replaces the duration.

## 0.7.4
- Queue: remove button (x) only shown on hover (always on touch screens).

## 0.7.3
- Album popup: "9 tracks · 41:42" with a middle dot.

## 0.7.2
- Album popup: order artist, year, genres, quality tag with technical data, source.

## 0.7.1
- Album popup: no request for the favourite state any more (shown on the cover only).

## 0.7.0
- Album popup: year, quality tag, technical data (format, bit depth, sample rate, channels,
  average bitrate) and artist per track from `/library/v1/Songs`. The year is no longer
  taken from the folder name.

## 0.6.30
- New library icon: folder with music notes.

## 0.6.29
- Album popup: track list sized without flexbox (empty track list in Safari).

## 0.6.28
- About: player section with room name, BluOS version (`/GitVersion`) and API version (`/Version`).

## 0.6.27
- Queue: icons of "clear queue" and "delete playlist" swapped.

## 0.6.26
- Queue: square save icon; delete-playlist icon in the style of the playlist icon.

## 0.6.25
- Queue: remove-track icon is an x in a circle instead of a bin.

## 0.6.24
- Queue status: number of tracks and duration on two lines.

## 0.6.23
- Queue: repeat button (off, queue, track) via `/Repeat`.

## 0.6.21 – 0.6.22
- Queue: shuffle button shows its "on" state as a small rounded square.

## 0.6.20
- Queue: shuffle button via `/Shuffle`.

## 0.6.19
- Queue: no gap above the first track.

## 0.6.18
- Queue: heading removed; number of tracks and duration in the status bar.

## 0.6.17
- Quality chip "Hi-Res" renamed to "HD", like the tag in the player bar.

## 0.6.16
- Player bar: source icon (library / USB) removed.

## 0.6.15
- Player bar: play/pause as drawn icons (centred in every browser).

## 0.6.11 – 0.6.12
- New playlist icon (list with a music note) for playlist chips and the queue button.

## 0.6.10
- Thin separator between chip groups in the accent colour.

## 0.6.9
- Cover: "add to queue" shown as a plain +.

## 0.6.5 – 0.6.8
- Album popup: no buttons (actions are on the cover), larger two-column layout with the cover
  left, details below the cover, tracks right, number of tracks and playing time above the tracks.

## 0.6.3 – 0.6.4
- Renamed to **BluAlbum** (file `blualbum.html`), trademark notice in the about popup.

## 0.6.2
- Code restructured into modules (no change in behaviour): one request layer, state in one place,
  version set in one place.

## 0.1.0 – 0.6.1
Initial development: album wall with lazy loading, genre / favourites / new / quality / playlist
chips, search, cover actions, random album, album popup, queue panel with save / load / delete
playlists, player bar with seek and volume, full-screen view, music source switches, settings
(cover size, design), about popup with library statistics.
