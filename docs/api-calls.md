# BluAlbum – clicks and API calls

Every user action of the app and the player requests it sends, with endpoint, parameters and
purpose. State: after steps A, B and C of the request reduction (November 2026, unreleased after 0.8.0),
from the code of `blualbum.html` and measurements on the real player.

All player requests are HTTP GET on `http://<player>:11000` with XML answers. Endpoint reference
with all parameters and response structures: [`api-endpoints.md`](api-endpoints.md).

Legend: **S** = per music source (library and USB drive are both asked, so ×2 with two sources).

## Measurements (2026-11-14, Powernode, library + USB, 37 genres, Chrome)

Read-only actions; cover images (`/Artwork`) are not counted.

| Action | Before | After steps A–C | Note |
|---|---:|---:|---|
| Connect, fresh browser | 585 | **9** | before: 564 for the genre crawl |
| Connect again | 21 | **9** | |
| Chip New | 5 | 5 | `/library/v1/Albums` with follow-up pages |
| Chip Favourites | 2 | 2 | |
| Chip CD, first time | 54 | **38** | 2 section lists + 27 library + 9 USB sections |
| Chip CD, second time | 0 | 0 | session cache |
| Chip All (after CD) | 38 | **36** | section lists already loaded |
| Genre chip | 38 | **36** | no trial request for an unsectioned list |
| Artist name (All not loaded) | ≈ 36 | **4** | artist menu + albums link per source, 152 ms |
| Album popup | 2 (≈ 21 KB) | 2 (≈ 11 KB), same album again: **0** | track list without context menus, session cache |
| Search "love" (Enter) | 6 | 6 | |
| Open queue panel | 1 | 1 | |
| Open about popup (once per connection / source selection) | 0 | 8 | versions + statistics, moved from connect |
| Play, ＋, track, skip, back, queue entry | 3 | **1** | no `/Status` + `/Volume` afterwards |
| 60 s idle | 0 | 0 | the long-poll request stays open (up to 100 s) |

Write check on the player (2026-11-14): without the extra `/Status` + `/Volume`, the footer
follows skip / pause within 80–170 ms through the long polling. During playback the player keeps
each long-poll request open for the full 100 s (≈ 36 requests per hour); only around a track
change it answers several times in a row.

## 1. Load the page

| Action | API calls | Purpose |
|---|---|---|
| Open the file | none | settings from localStorage, the settings panel opens |

## 2. Connect ("Connect" button or Enter in the IP field)

| # | Endpoint and parameters | Count | Purpose |
|---|---|---|---|
| 1 | `/Browse` (no key) | 1 | top menu: music sources (library, USB) and the key of the saved playlists |
| 2 | `/Browse?key=<playlists>` | 1 (+ `nextKey` pages) | playlist chips |
| 3 | `/Settings` | 1 | room name (title, connection line), network shares, artwork optimisation, server mode (settings panel) |
| 4 | `/Status?timeout=100&etag=…` | continuous | long polling "now playing" (section 9) |
| 5 | `/Browse?key=<source>:` | S | source menu: keys for genres, albums, search |
| 6 | `/Browse?key=<source>:GG/Genres` | S | genre list → genre chips |
| 7 | `/library/v1/Albums?service=<svc>&category=FAVOURITES` (+ `nextlink` pages) | S | default view "Favourites" |
| 8 | `/Playlist?start=0&end=199` | 1 (only with a pinned queue) | load the queue as soon as `/Status` reports the playlist id |

The browser also loads the covers (`/Artwork?service=…&album=…&artist=…&followRedirects=1`) of the
visible tiles (lazy, from the browser cache when already loaded). They are not counted.

## 3. Chips (filter row)

| Click | API calls | Count | Cache | Purpose |
|---|---|---|---|---|
| **All** | album sections `/Browse?key=…bySection:Album…` (once per source, shared), then per filled section `/Browse?key=…&section=X` (+ `nextKey` pages) | ≈ S + filled sections | session | all albums A–Z |
| **♥ Favourites** | `/library/v1/Albums?service=<svc>&category=FAVOURITES` | S | none, always fresh | favourites of the player |
| **New** | `/library/v1/Albums?service=<svc>&recent=1` (+ `nextlink`, at most 200 albums) | S+ | none | recently added albums |
| **HD / CD / MQA** | album sections (shared), then `/library/v1/Albums?service=<svc>&quality=hr\|cd\|mqa&limit=500&section=X` per filled section | filled sections | session | quality filter (works only per section) |
| **Genre** | `/Browse` genre menu → genre album sections → albums of every filled section | 2 × S + filled sections | session | albums of a genre |
| **Playlist chip** | play URL of the playlist from `/Browse` (e.g. `/Load?service=BluOS&name=…`); with an open queue the new playlist id reloads the queue, otherwise (broken playlist, id unchanged) `/Playlist?start=0&end=199` after 1.5 s | 1 + 1 | – | play the playlist |

## 4. Album tile in the grid

| Click | API calls | Count | Purpose |
|---|---|---|---|
| Cover or title | `/Browse?withContextMenuItems=0&key=<svc>:MG/LocalMusic-Album?album=…&artist=…` and in parallel `/library/v1/Songs?service=<svc>&album=…&artist=…`; none when the album was opened before in this session | 2 or 0 | album popup: track list with play URLs and durations; year, quality, format, bit depth / sample rate, bitrate, artist per track |
| ▶ Play (hover) | `/Add?playnow=1&service=<svc>&album=…&artist=…` | 1 | play the album now |
| ＋ (hover) | `/Add?album=…&artist=…&playnow=-1&service=<svc>&where=last` | 1 | add the album to the end of the queue |
| ♥ (hover, library only) | `/AddFavourite?album=…&artist=…&service=<svc>` or `/DeleteFavourite?…`, then `/Browse?key=<svc>:CM/LocalMusic-Album?…[&isFavourite=1]` | 2 | set / remove the favourite, then read the context menu again (current state + URL for the next click) |
| Artist name | `/Browse?key=<svc>:MG/LocalMusic-Artist?artist=…` (artist menu), then its "Albums" link `/Browse?key=<svc>:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=…&service=<svc>`; none when the artist was shown before in this session | 2 × S or 0 | all albums of the artist with the player's play URLs and context menus (Bruno E10–E13) |
| Random album ▶ / ＋ | like ▶ / ＋ | 1 | random album of the current view |

### Album popup in detail (example "Brothers In Arms", library)

Two requests run in parallel when the popup opens; the browser also loads the cover:

1. `/Browse?withContextMenuItems=0&key=LocalMusic%3AMG%2FLocalMusic-Album%3Falbum%3DBrothers%2BIn%2BArms%26artist%3DDire%2BStraits`
   (key = `LocalMusic:MG/LocalMusic-Album?album=Brothers+In+Arms&artist=Dire+Straits`, 7.2 KB;
   16.8 KB with `withContextMenuItems=1`)
   - `<browse type="tracks" playURL="/Add?service=LocalMusic&album=…&artist=…&playnow=1" serviceName="Library" searchKey="LocalMusic:Search">`
   - one `<item type="track">` per track with `text` ("1. So Far Away"), `duration` (seconds),
     `playURL` (`/Add?playnow=1&file=…`), `autoplayURL`
     (`/Add?service=…&listindex=0&nextlist=1&where=last&cursor=last&playnow=1&album=…&artist=…`),
     `image`, `contextMenuKey` (`…CM/LocalMusic-Song?…&filename=…&title=…`); with
     `withContextMenuItems=1` also a `<contextMenu>` per song (`favourite-add`, `add-now`,
     `add-next`, `add-last`)
   - **used:** `text`, `duration`, `autoplayURL` (else `playURL`) for the track click
2. `/library/v1/Songs?service=LocalMusic&album=Brothers+In+Arms&artist=Dire+Straits` (4.1 KB)
   - `<songs album artist id service>`
   - per song: attributes `samplerate`, `samplebits`, `channels`, `bitrate`, `atype`; elements
     `songID`, `art`, `alb`, `title`, `track`, `date`, `time`, `quality`, `fn` (file path)
   - **used:** `date` (year), `quality`, `atype`, `samplebits`, `samplerate`, `channels`,
     `bitrate` (technical line), `art` (artist per track when it differs), `title` (match with the track)
3. Cover: `/Artwork?service=LocalMusic&album=…&artist=…&followRedirects=1` (image, usually cached)

**No genre** in either answer, nor in the album or song context menu, nor in `/library/v1/Albums`.
The popup therefore has no genre line (decided 2026-11-14).

## 5. Album popup

| Click | API calls | Count | Purpose |
|---|---|---|---|
| Track | `autoplayURL` or `playURL` of the track from `/Browse` (`/Add?…`) | 1 | play from this track |
| Artist name | like the artist name in section 4 | 2 × S or 0 | |
| Close ✕ / click outside | none | | |

## 6. Search (field at the top)

| Action | API calls | Count | Purpose |
|---|---|---|---|
| Typing (from 3 characters, 800 ms pause) or Enter (always) | `/Browse?key=<searchKey>&q=<text>` | S | the player's search |
| … when the result holds no albums directly | `/Browse?key=<albums link>` and per section `/Browse?key=…&section=X` (+ `nextKey`) | + 1 + sections | albums of the search result |
| Clear the field | none | | show the previous view again |

Older results are dropped, but their requests still run to the end.

## 7. Player bar (footer) and full screen

| Click | API calls | Count | Purpose |
|---|---|---|---|
| ⏯ Play/Pause | `/Pause?toggle=1` | 1 | toggle; the answer holds the new state |
| ⏮ Back | `/Back` | 1 | previous track (restarts the current one after a few seconds) |
| ⏭ Skip | `/Skip` | 1 | next track |
| Progress bar / arrow keys | `/Play?seek=<seconds>` | 1 | seek within the track |
| Drag the volume slider | `/Volume?level=<0–100>` | at most 1 per 150 ms, + 1 on release | volume |
| Volume − / + | `/Volume?db=-2` or `/Volume?db=2` | 1 | volume in 2 dB steps |
| Cover in the footer | none | | open full screen |
| Click into full screen / Esc | none | | close full screen |

## 8. Queue (button top right)

| Click | API calls | Count | Purpose |
|---|---|---|---|
| Pin (open) | `/Playlist?start=0&end=199` (+ further pages of 200, at most 2000 entries) | 1+ | load the queue |
| Unpin (close) | none | | |
| Entry | `/Play?id=<n>` | 1 | play this entry |
| ✕ Remove | `/Delete?id=<n>`; the new playlist id reloads the list | 1 + 1 | remove the entry |
| Shuffle | `/Shuffle?state=0\|1`; the new playlist id reloads the list | 1 + 1 | shuffle |
| Repeat | `/Repeat?state=0\|1\|2` | 1 | repeat (queue / track / off) |
| Save | `/Save?name=<name>`, then `/Browse?key=<playlists>` | 2 | save as playlist, reload the playlist chips |
| Delete playlist | `/Delete?service=BluOS&name=<name>`, then `/Browse?key=<playlists>` | 2 | delete the saved playlist |
| Clear | `/Clear`; the new playlist id reloads the list | 1 + 1 | clear the queue |

The playlist id (`<pid>` in `/Status`, `id` of `/Playlist`) changes on add, remove, shuffle on /
off, clear and load (Bruno, 2 Write); the long polling reports it and the open queue is loaded
once.

## 9. Background (no click)

| Trigger | API calls | Purpose |
|---|---|---|
| Continuous loop after connecting | `/Status?timeout=100&etag=<etag>` | The player holds the request up to 100 s and answers at once on a change (title, position, volume, shuffle, repeat, playlist id). At least 1 s between requests, 5 s after errors |
| Playlist id in `/Status` changed, queue pinned | `/Playlist?start=0&end=199` | update the queue |

## 10. Settings and about

| Click | API calls | Count | Purpose |
|---|---|---|---|
| Gear, close, design, cover size, chip switches | none | | display / localStorage only |
| "Change" (change the IP) | none | | then "Connect" = full connect (section 2) |
| Source switch (Library / USB) | source menus, genre lists, favourites (like connect #5–#7) | 3 × S | open the sources again |
| About (first time per connection / source selection) | `/GitVersion`, `/Version`; per source `/Browse` artist, song and composer section lists (album count from the shared album sections) | 2 + 3 × S (+ S when the album sections are not loaded yet) | player versions and library statistics |
| "Check for updates" | `https://api.github.com/repos/ogig33/blu-album/releases/latest` (not the player) | 1 | latest version on GitHub |

## 11. Reduction proposals

| # | Proposal | Saving | Effort / risk | State |
|---|---|---|---|---|
| 1 | Remove the genre crawl on connect (only for the genre line in the album popup; the player offers no genre per album) | 564 on the first connect | low | ✅ done, genre line removed |
| 2 | No trial request for an unsectioned genre list (it was too short for all 37 genres – a fallback) | 37 per crawl, 2 per genre chip | low | ✅ done |
| 3 | Load statistics and versions when the about popup opens | 10 per connect | low | ✅ done |
| 4 | Remove `sync()` (`/Status` + `/Volume` on connect and after every command); the long polling reports every change, `/Status` also holds `<volume>` | 2 per connect, 2 per command | low | ✅ done, checked on the player |
| 5 | Load the queue only once after ✕, shuffle, clear and playlist chip (today: the click reloads it *and* the changed playlist id in the long poll does) | 1 per such click (open queue) | medium; checked in Bruno | ✅ done |
| 6 | Genre chip after a page reload re-loaded the genre albums | up to 38 | – | ✅ obsolete (no crawl) |
| 7 | Search from 3 characters and after 800 ms instead of 500 ms; Enter always | ≈ 6 per avoided intermediate search | – | ✅ done |
| 8 | All and statistics share the album section list | S on the first All | low | ✅ done |
| 9 | Favourites chip from the cache until ♥ is clicked in BluAlbum | 2 per click | changes made in the BluOS app would show only after reconnecting | ⏸ deferred |
| 10 | Heart: do not read the context menu again after toggling (the opposite URL is derived already) | 1 per ♥ click | the next click would use a self-built URL (rule: URLs from the player) | ✖ not done |
| 11 | Cache the album popup per album for the session | 2 per re-opening | low | ✅ done |
| 12 | Quality chips and All cached across sessions in localStorage | 38 / 36 per session | data may become stale | ⏸ deferred |
| 13 | Quality chips ask only filled sections (USB: 9 of 27) | 18 per quality chip | low | ✅ done |
| 14 | Album popup track list with `withContextMenuItems=0` | ≈ 60 % of the data | low (Bruno E09) | ✅ done |
| 15 | Artist click via the `/Browse` artist key `MG/LocalMusic-Artist?artist=…` instead of the All list (keeps the player's URLs) | ≈ 32 when All is not loaded (36 → 4) | low (Bruno E10–E13) | ✅ done |
