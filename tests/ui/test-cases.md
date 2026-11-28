# BluAlbum – UI test cases

Every function of the app (`blualbum.html`) as a test case, grouped into test blocks, with input, expected output and the scope of its UI test in `run.js`. Test concept, environments and rules: [`tests/README.md`](../README.md); running the UI tests: [`README.md`](README.md).

## 1. How to read the test cases

- **ID**: `<block>-<number>`, e.g. `QUE-04`; IDs of removed cases are not reused. Every case starts from a fresh browser profile, connected to the player, in the default view (Favourites), unless the input says otherwise.
- **Input**: start state, options of the test run and user actions.
- **Expected output**: what the user sees and which requests / commands reach the player. Values refer to the test data (chapter 3), never to concrete artists, albums or numbers.
- **Automation**: every case is checked by a Playwright UI test whose name starts with the case ID: `node run.js --only QUE-04` runs it, `node run.js --only QUE-` the block, `node run.js --list` lists every test with its marks.
- **Real player**: whether the case also runs against the real player (ENV-3). **read** = only reads from the player; **write** = changes data on the player (playback, volume, queue, playlists, favourites, shuffle / repeat), runs only with `--write` and restores the state; **–** = mock only (errors, delays, a second player, a patched status, a generated queue); "(part)" = some checks are mock only.
- **Local**: **local** = run by `npm test` (the main functions, at most 50 tests); **–** = only with `--all` and on GitHub Actions, which run every case. `run.js` reads this column and stops when more than 50 tests are local or a test has no mark.

## 2. Overview of the test blocks

| Block | Chapter | Scope | Cases | Real player | Local |
|---|---|---|---|---|---|
| CON | 4.1 Connection & start | Start page, IP form, connect, errors, time limit, compact connection line, changing the player | 14 | 10 | 4 |
| SRC | 4.2 Music sources | Source detection, one switch per source, stored per player | 6 | 3 | 1 |
| CHP | 4.3 Chips & views | Chip row, All, Favourites, New, quality, genres, caching, outdated results, sort order, library changes | 22 | 14 | 9 |
| GRD | 4.4 Album grid | Tiles, rows near the screen, random album tile, hover buttons, status line, loading the covers | 16 | 10 | 3 |
| FAV | 4.5 Favourites | Heart on the cover, toggling via the player, no local favourites | 6 | 5 | 2 |
| ART | 4.6 Artist view | Albums of an artist across sources, favourite state, cache, artist links (several artists, track artists) | 5 | 4 | 1 |
| POP | 4.7 Album popup | Details, technical data, track list, playing a track, closing, cover in full screen | 22 | 11 | 4 |
| SRH | 4.8 Search | Player search, albums of found composers, groups by album title / artist / composer, search areas, search button, typing rules, empty field, errors | 13 | 4 | 3 |
| FTR | 4.9 Player footer | Now playing, quality tag, transport, progress, volume, listening mode, long polling | 20 | 11 | 4 |
| FUL | 4.10 Full screen | Full-screen now playing view, background from the cover, full-size cover | 7 | 5 | 1 |
| QUE | 4.11 Queue panel | Pinning, list, remove, reorder (drag and drop, keyboard), shuffle, repeat, save as playlist, clear | 18 | 16 | 5 |
| PLS | 4.12 Playlists | Playlists chip, playlists as tiles, random playlist, playing / queueing / deleting a playlist, playlist popup, favourite library playlist | 13 | 10 | 3 |
| SET | 4.13 Settings panel | Panel, chip switches, cover size, design, library settings | 9 | 9 | 1 |
| ABT | 4.14 About popup | Content, statistics, versions, update check | 6 | 6 | 1 |
| ERR | 4.15 Error handling | Failed requests in the popup, expected failures not shown, request headers | 8 | 2 | 2 |
| SEC | 4.16 Security & robustness | Image URLs, blob covers, blocked storage, clean-up of old keys | 5 | 4 | 1 |
| LAY | 4.17 Layout & accessibility | Contrast, horizontal scrolling, control names, keyboard, favicon, header logo | 4 | 4 | 1 |
| REG | 4.18 Regression & session | No playback on load, request budget, no JavaScript errors | 3 | 3 | 3 |
| | | **Total** | **197** | **131** | **49** |

Test order across blocks: CON → SRC → CHP → GRD → FAV → ART → POP → SRH → FTR → FUL → QUE → PLS → SET → ABT → ERR → SEC → LAY → REG. A block only relies on blocks before it (e.g. FAV needs the grid, QUE needs the footer's long polling). `run.js` runs the tests in this order.

## 3. Test data dictionary


Built by `buildTD()` from the answers of the player the tests run against (mock: the fixtures named in the second column), following the rule "no hard-coded test data" of [`tests/README.md`](../README.md#rules). The mock exports the data it adds itself: `USB_GENRES`, `USB_SECTIONS`, `VERSIONS`.

| ID | Source (fixture of the mock) | Content (derived at test time) |
|---|---|---|
| TD-IP | `run.js` (`IP`) | Address of the player: the mock's, or the one given with `--player` |
| TD-TOP | Top menu (01) | Source links (library / USB icon), the BluOS playlists link; without USB the mock removes the USB item (`usb: false`) |
| TD-SRC | TD-TOP | Sources = link items with `LibraryIcon` / `USBIcon`; name = `text`, key = `browseKey` |
| TD-GEN | Genre lists of every source (04 + mock) | Genre names of every source; chip row = sorted union; TD-GEN-ONE = a genre of the library only |
| TD-GEN-ALB | Genre menu, sections and album lists of TD-GEN-ONE through `/Browse` (04, 05, 06, 07) | Albums of TD-GEN-ONE with key, title, artist, context menu key, play and cover URL |
| TD-SEC | Album sections of every source (06) | A–Z sections with album counts (`text2`); "filled" = `text2` ≠ 0; USB: the mock keeps only some sections |
| TD-ALL | Albums of the filled sections (07) | Albums of the first filled library section; ALL_COUNT = albums of every filled section of every source (the mock answers albums only for one section) |
| TD-TRK | Track list of TD-ALB-LIB (08) | Tracks with `text` ("N. Title") and `duration`, in the order of TD-SONGS |
| TD-CM | Context menu of an album (09) | Favourite state follows `isFavourite=1` in the key |
| TD-NEW | `/library/v1/Albums?recent=1` per source (11, 14) | Recently added albums, newest first, at most 200 per source |
| TD-FAV | `/library/v1/Albums?category=FAVOURITES` (12) | Favourite albums of the library; USB has none |
| TD-QCD | Quality lists (13, 15) | Number of albums in CD quality, counted through the lists per section of every source |
| TD-DEC | Decade index per source (mock: counted from TD-YEARS) | Decades of `/library/v1/Albums` with `section=all&length=1&sort=decade` (section names like `1980`), union of the sources, sorted; chip label "80s" (full decade when two share the short form) |
| TD-YEARS | `/library/v1/Albums` per filled section without a filter (13; mock: section A of the library, `USB_YEARS` in USB section S) | Albums with a year (`date`) of every source as {title, year} |
| TD-PL | BluOS playlists (16) | BluOS playlists with name, cover (`image`), browse key and play URL (`/Load…`) |
| TD-PL-TRK | Track list of the first playlist of TD-PL (28; the mock adds a second page) | Tracks of every page (`nextKey`) with `text`, `text2` ("artist • album"), `duration`, `autoplayURL` (or `playURL` on later pages) |
| TD-LPL | Library playlists of every source (29; link "Playlists" of the source menu; the mock: library only) | Library playlists with name, cover, browse key, play URL (`/Load?service=LocalMusic…`), context menu without `delete` |
| TD-LPL-TRK | Track list of the first playlist of TD-LPL (30) | All tracks in one answer with `text`, `text2`, `duration`, `autoplayURL` |
| TD-SEARCH | Search answer (18) | Search result menu with links to artists / albums / songs / composers |
| TD-STATUS | `/Status` (19 + mock state) | Now playing (`title1`–`title3`, `image`, `quality`, `streamFormat`, `secs`, `totlen`, `canSeek`, `volume`, `pid`, `song`, `shuffle`, `repeat`, `syncStat`); with the real player read again at the start of every test |
| TD-NOW-LIB | `/Status` | A title of a source of TD-SRC is playing or paused |
| TD-QUEUE | `/Playlist` (20) | Play queue (`<song id>` with `time`), at most 2000 entries |
| TD-SET | `/Settings` (21) | Room name (`zonename`), network shares (`sharecfg`), `resizeall`, `server` |
| TD-SONGS | `/library/v1/Songs` of TD-ALB-LIB and TD-ALB-USB (25, 26) | Songs of an album (`date`, `atype`, `quality`, `samplebits`, `samplerate`, `channels`, `bitrate`, `art`, `title`; `discno` on multi-disc albums, mock state `discs`) |
| TD-LM | `/audioPreset` (27) | Listening mode: setting `displayName`, current `value`, list of modes; empty on a player without listening modes |
| TD-VER | `/GitVersion`, `/Version` (mock: `VERSIONS`) | BluOS and API version |
| TD-ALB-LIB | TD-ALL | The first album of TD-ALL |
| TD-ALB-USB | TD-NEW | The first USB album of TD-NEW |
| TD-ART | TD-FAV + artist menus | The artist of the first favourite that has albums (artist menu → albums link on every source); expected albums = that list |
| TD-FAV-ART | TD-FAV ∩ albums of TD-ART | The favourites among the albums of TD-ART |
| TD-STATS | Statistics lists of every source | Albums (section counts), Artists / Songs / Composers (counted like the app), Genres, Playlists |
| TD-TERM | Album titles of TD-ALL / TD-FAV | Search term: the first word of 3 or more letters in an album title (so the real player finds a few albums, not the whole library) |
| TD-SETVAL | — | Values the test sets itself: name entered in the question popup for saving the queue (`__blualbum_test_list__`), search terms of SRH-03 (length below / at `SEARCH_MIN`), a GitHub release tag higher than `APP.version`, a second track artist, error answers and delays of the mock |

## 4. Test blocks

### 4.1 Connection & start (CON)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| CON-01 | Start page without stored IP | Open the app, no `ip` in localStorage | Settings panel open, IP field empty with placeholder, help text visible, status line asks to connect; IP field with `inputmode="url"` (touch keyboard with a dot) and `autocapitalize="off"`; no request to the player | read | local |
| CON-02 | Stored IP is restored | localStorage `ip` = TD-IP, open the app | IP field contains TD-IP, panel open; no automatic connect | read | – |
| CON-03 | Connect with the button | Enter TD-IP, click **Connect** | `/Browse` (top menu), sources opened, chips built, default view loaded; `ip` stored; panel closed | read | local |
| CON-04 | Connect with Enter | Enter TD-IP, press Enter in the IP field | Same as CON-03 | read | – |
| CON-05 | IP input is normalised | Enter `http://<TD-IP>:11000/x` | Field shows only TD-IP; requests go to `http://<TD-IP>:11000` | read | – |
| CON-06 | Empty IP | Clear the field, click Connect | Error "Please enter the IP address of your player."; panel stays open, IP field focused; no request | read | – |
| CON-07 | Player not reachable | Mock aborts every request | Status line shows the LAN permission message (`LAN_MSG`); popup "Connecting to the player did not succeed" with the `/Browse` request, status "No answer – …" and `LAN_MSG` as answer; IP form and help text stay visible; panel open | read | local |
| CON-08 | No music source | Top menu without library / USB links | Error "No USB or library source found …"; panel open | – | – |
| CON-09 | Compact connection line | After CON-03, open the panel | Line with room name (TD-SET `zonename`) and TD-IP; IP form hidden | read | – |
| CON-10 | Change the player | Click **Change** in the connection line | IP form visible, IP field focused and selected | read | – |
| CON-11 | Room name as tab title | After CON-03 | `document.title` = room name of TD-SET (fallback: `displayName` of the player menu group, then "BluAlbum") | read | – |
| CON-12 | Changing the player forgets the previous one | Connect, start a slow All, pin the queue, connect to a second mock player (`IP2`) | Chips, grid, queue, search field, statistics, playlists and listening mode are reset; no results of the first connection appear | – | local |
| CON-13 | Player does not answer | Mock holds the top menu `/Browse` longer than `CONNECT_TIMEOUT` (5 s) | After about 5 s: status line `NO_REPLY_MSG`; popup "Connecting to the player did not succeed" with the `/Browse` request, status "No answer – timed out after 5 s" and `NO_REPLY_MSG` as answer; IP form visible, panel open | – | – |
| CON-14 | Timeout of the previous IP | Connect to a player that does not answer, then at once to a second mock player (`IP2`) | The second player's default view stays after the first one's time limit; no error popup; connection line shows `IP2` | – | – |

### 4.2 Music sources (SRC)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| SRC-01 | One switch per source | Connect with TD-TOP (library + USB) | Settings list one row per source of TD-SRC, named as the player names them, all switched on | read | – |
| SRC-02 | Without USB drive | Option `usb: false` | Only the library row | – | – |
| SRC-03 | Switch a source off | Switch USB off | Chips rebuilt from the remaining source; New contains no album of TD-NEW (USB); default view loads again | read | local |
| SRC-04 | Switch state is stored per player | Switch USB off, reload, connect again | USB still off (`srcoff:<player URL>`); a different player IP starts with all sources on | – | – |
| SRC-05 | All sources off | Switch every source off | Status line "No music source enabled …"; no genre chips; the Playlists chip stays | read | – |
| SRC-06 | Two sources with the same name | Top menu with two USB links of the same name | Rows show name plus key, e.g. "USB (<key>)" | – | – |

### 4.3 Chips & views (CHP)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| CHP-01 | Chip row | Connect (quality and genre chips switched on, as in most tests) | Order: All, Favourites (heart icon), New, Playlists, separator, HD, CD, MQA, separator, genres of TD-GEN sorted A–Z (decade chips off by default) | read | local |
| CHP-02 | Default view Favourites | Connect | Favourites chip pressed; tiles = albums of TD-FAV (count and titles); request `/library/v1/Albums?…category=FAVOURITES` per source | read | local |
| CHP-03 | No favourites | Fixture 12 without albums | Status line "No favourites yet." | – | – |
| CHP-04 | New | Click **New** | Tiles = TD-NEW library albums (newest first) followed by the USB albums; status "N albums recently added, newest first"; at most 200 per source | read | local |
| CHP-05 | Quality CD | Click **CD** | One request per source with album sections (`quality=cd&section=all`), no album section request; number of tiles = TD-QCD; status "… in CD quality" | read | local |
| CHP-06 | Quality HD / MQA | Click **HD**, then **MQA** | Filter `quality=hr` / `quality=mqa`; empty result: "No HD albums." / "No MQA albums." | – | – |
| CHP-07 | Quality result is cached | CD, All, CD again | Second CD click sends no quality request; album sections asked once per source (by All) | read | – |
| CHP-08 | All | Click **All** | Albums of every filled section of every source, 3 sections in parallel, progress "Loading all albums … n/N"; with two sources sorted A–Z; status "N albums" | read | local |
| CHP-09 | Genre | Click a genre of TD-GEN-ONE | One request `/library/v1/Albums?service=<svc>&genre=…&section=all` with the `genre=` of the genre's browse key; albums, favourite state, play and cover URLs = TD-GEN-ALB; status "N albums in the genre <genre>" | read | local |
| CHP-10 | Genre only on one source | Click a genre that exists only on the library | Albums of that source only; no request for the other source | read | – |
| CHP-11 | Views are cached in the session | Genre, All, genre again | Second genre click sends no request | read | – |
| CHP-12 | Outdated result is dropped | Click All, click New before All has finished | Grid and status line show New; the late All result does not replace it; All loading stops | – | – |
| CHP-13 | Selecting a chip clears the search | Search, then click a chip | Search field empty, chip pressed, its view shown | read | – |
| CHP-14 | Loading error | Mock answers HTTP 500 for the view | Status line "Loading failed: Player responded with 500" in red; popup "Loading the albums did not succeed" with request, HTTP 500 and the answer | – | local |
| CHP-15 | Default chip switches | Fresh profile (app defaults), connect, open the settings | Quality, Decades, Genres off (no switch for Playlists); visible chips: All, Favourites, New, Playlists; no decade index request | read | – |
| CHP-16 | Decade chips switched on | Switch "Decade chips" on | One request per source with album sections (`/library/v1/Albums?service=<svc>&section=all&length=1&sort=decade`), no `/ui` request; chips of TD-DEC behind a separator after the quality chips, tooltip "Albums from the 1980s"; no album request yet; switched off → hidden; stored, built again after reload + connect | read | – |
| CHP-17 | Decade | Decade chips on, click the first decade of TD-DEC, then the last | One request per source with album sections (`section=all`, no filter); tiles = TD-YEARS of that decade; status "N albums from the 1980s"; second decade sends no request | read | local |
| CHP-18 | Outdated genre failure | Delayed HTTP 500 for a genre; meanwhile click New, or open the sources again and click the genre again | Current view and status line stay; no error popup | – | – |
| CHP-19 | Outdated failure of All or an artist | Delayed HTTP 500 for All (sections, albums) or the favourite state of an artist; meanwhile click New. All failing while selected | New stays, no error popup. Selected All: the error stays in the status line | – | – |
| CHP-20 | Outdated source selection | Delayed failure of Favourites or delayed answer of CD; meanwhile open the sources again | No error over the new selection; old list not in its cache | – | local |
| CHP-21 | Sort order of the album views | App defaults; default view Favourites; choose every sort order; All with "Year, newest first" and "Year, oldest first"; New; search and clear; Playlists; reload + connect | Select at the right of the status line, options of `SORTS`, default "Random" (every album of the view); album title A–Z / Z–A, album artist A–Z / Z–A (an artist's albums by year), year newest / oldest first (albums without a year last), equal values by album title; status line unchanged; stored (`sort`). Album artist and year orders: the tiles show "<year> · <artist>" (without a year only the artist), other orders only the artist; years of Favourites and All from `/library/v1/Albums?service=<svc>&section=all` (1 request per source, once), years = TD-YEARS. New: newest first, select disabled with "Newest added". Hidden in the search results and in Playlists, shown again after clearing the search; after reload + connect the stored order | read | – |
| CHP-22 | Library changed | CD and Favourites; another client changes a favourite (`mid` of `/Status` raised); CD again, own heart, New; rescan: `indexing` > 0 with the old `mid`, then 0 with a new one; window focused | Session caches dropped (CD not cached); genre chips and playlists read again; tiles and pressed chip unchanged. Own heart: caches kept. Rescan: caches kept while indexing, dropped with the new `mid`. No request `/library/v1/Albums?service=LocalMusic&section=all&length=1` | – | – |

### 4.4 Album grid (GRD)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| GRD-01 | Tile content | Any view | Per album: cover, title, artist (button "Albums by <artist>"); cover and title open the popup | read | – |
| GRD-02 | Random album tile | Any view with albums | First tile "Random album", "from N albums" (N = albums of the view), dice icon, no popup on click | read | – |
| GRD-03 | Random album: play | Hover the random tile, click play | `/Add?playnow=1…` of one album of the current view; toast "Playing: <title> – <artist>" | write | – |
| GRD-04 | Random album: add last | Click the add button of the random tile | `addAll-last` URL of one album of the view (`where=last`); toast "Added to queue: …"; album without that URL: toast "Could not add …" | write | – |
| GRD-05 | No random tile for search results and empty lists | Search; empty view | No random tile | – | – |
| GRD-06 | Rows near the screen | New rendered ten times over; scroll to the end; back to the top | Fewer tiles in the grid than albums, the first ones in order; every tile with `role=listitem`, `aria-setsize` = albums + random tile, `aria-posinset` its position; the grid as high as all rows; at the end the last album on the screen, the last tiles in order; at the top the random tile again | read | local |
| GRD-07 | Hover buttons | Hover a library tile | Play, add last and heart visible | read | local |
| GRD-08 | Play an album | Click play on a tile | The album's play URL (`/Add?playnow=1…`); toast "Playing: <title>" | write | local |
| GRD-09 | Add an album last | Click add on a tile | `addAll-last` URL with `where=last`; toast "Added to queue: <title>" | write | – |
| GRD-10 | Long title and artist | Mock favourites with a title and an artist longer than a tile; hover the tile, leave it; again with reduced motion | Title and artist one line each, cut lines fade out (`.cut`), short lines not cut; hover (after 300 ms) scrolls both cut lines, leaving stops it; reduced motion: no scrolling, full text as tooltip | – | – |
| GRD-11 | Status line with a fine line | Favourites view; pin the queue (window 800 px or wider) | A fine line under the status line (with the sort order), from the left to the right edge of the grid's tiles; with the pinned queue it ends where the grid ends, with space to the queue | – | – |
| GRD-12 | Covers in tile size | All; then cover size L | Grid covers asked with `&width=<px>&height=<px>&followRedirects=1`, px = column width × pixel ratio rounded up to 50 (from 600 px without a size); after L the covers on and just below the screen are asked again in the larger size | read | – |
| GRD-13 | Covers two at a time | Mock: covers answer after 300 ms, nothing playing; All | At most 2 cover requests at the same time; the covers of the tiles on the screen are asked first | – | – |
| GRD-14 | Covers of a former view | Mock: covers answer after 600 ms, nothing playing; All, at once Favourites | At most the 2 covers of All asked before the switch; no further cover of All asked; the Favourites covers are shown | – | – |
| GRD-15 | Covers of tiles scrolled past | Mock: generated library of 1,500 albums (`big-library.js`), covers after 100 ms; All, scroll 15 screens quickly | The covers on the screen are shown; covers asked for fewer than half of the tiles scrolled past (their row now more than 800 px above the screen) | – | – |
| GRD-16 | Rows change | New rendered ten times over, scroll down 3 screens; cover size S, then L (desktop) | The album at the top of the screen stays there (within one row) | read | – |

### 4.5 Favourites (FAV)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| FAV-01 | Favourite shows a filled heart | Favourites view, hover the first tile | Heart `aria-pressed=true`, label "Remove from favourites: <title>" | read | – |
| FAV-02 | Remove a favourite | Click the filled heart | `/DeleteFavourite?…` sent; toast "Removed from favourites"; heart empty; context menu read again without `isFavourite=1` | write | local |
| FAV-03 | Add a favourite | Library album that is no favourite (e.g. from TD-ALL), click the empty heart | `/AddFavourite?…`; toast "Added to favourites"; heart filled; context menu read again with `isFavourite=1` | write | local |
| FAV-04 | USB album has no heart | New view, hover TD-ALB-USB | Heart hidden | read | – |
| FAV-05 | Failed toggle | Mock answers HTTP 500 for `/DeleteFavourite` | Popup "The player command did not succeed" with the `/DeleteFavourite` request; heart unchanged | – | – |
| FAV-06 | No local favourites | After FAV-02 / FAV-03 | No `fav:` key in localStorage | write | – |

### 4.6 Artist view (ART)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| ART-01 | Albums of an artist | Favourites view, click the artist of TD-ART | Status "N albums by <artist>"; tiles = albums of TD-ART from every source; per source: artist menu + albums link (2 `/Browse`); the All list is not loaded; play and add URLs from the player | read | local |
| ART-02 | Favourite state in the artist view | Same as ART-01 | Favourites of the library asked once; context menu read only for TD-FAV-ART (`&isFavourite=1`); those hearts filled, the others empty; remove URL from the player | read | – |
| ART-03 | Artist view from the popup | Open an album popup, click the artist link | Popup closes, artist view as ART-01, page scrolled to the top | read | – |
| ART-04 | Artist view is cached | Artist, another chip, same artist again | No `/Browse` request the second time | read | – |
| ART-05 | Several artists (comma), track artists | App defaults; album artist "Harold Budd ,Brian Eno, Earth"; click "Brian Eno" in the tile, switch Album and Composer on, then click "Harold Budd" in the album popup; mock state `songArtists`: track 2 of TD-ALB-LIB by "Harold Budd, Brian Eno"; click a track artist in the album popup, the playlist popup (TD-PL), the queue and the player bar | Tile and popup: one link per artist (trimmed, separated by ", "), none for the whole name. A click closes the popup and searches the artist once per source with only the search area Artist on (stored, also after Album and Composer were switched on again); no composer request. Track artists get the same links: album popup (when not the album artist), playlist popup (`text2` before " • "), queue ("artist – album"), player bar (`title2` = `artist`); a click plays nothing and moves no queue entry | – | – |

### 4.7 Album popup (POP)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| POP-01 | Open from the cover or the title | Click the cover of TD-ALB-LIB; close; click its title | Popup with cover, title, artist link, source line (icon of the player from the `image` of TD-SRC, inverted in the light design, + source name of TD-SRC); "Loading tracks …" until the tracks arrive | – | – |
| POP-02 | Track list | Popup of TD-ALB-LIB | One row per track of TD-TRK: number without dot in its own column, some space, title, duration m:ss; no summary line above the tracks, no disc header; total time of TD-TRK in the album details (`#dlen`); request `/Browse` with `withContextMenuItems=0` | read | local |
| POP-03 | No action buttons, no genre line | Popup open | No play / queue / heart button; no genre line | read | – |
| POP-04 | Year | Popup of TD-ALB-LIB | Year = `date` of TD-SONGS on the artist line ("Artist · year"); different years shown as range "first–last" | read (part) | local |
| POP-05 | Quality tag and technical data (lossless) | Popup of TD-ALB-LIB | Tag from `quality` (cd → CD, hd/hr → HD, mqa → MQA, dolby → Dolby) before the data line "<format> · <bits> bit / <kHz> kHz · <Mono/Stereo/n ch> · Ø <avg bitrate> kbit/s", all computed from TD-SONGS | read | – |
| POP-06 | Lossy album (MP3) | Popup of TD-ALB-USB | Tag "MP3"; data line without bit depth | read | – |
| POP-07 | Mixed album | Songs with two formats / sample rates | Formats joined with " / ", ranges for bits and kHz, one tag per quality | – | – |
| POP-08 | Track artist | Mock state `songArtists`: one track of TD-SONGS gets another artist | That track shows the artist below its title; all others none (song and track matched by position) | – | – |
| POP-09 | Play a track | Click a track row | Its `autoplayURL` (else `playURL`) sent; toast "Track started" | write | local |
| POP-10 | Popup cache | Open, close, open the same album | No second `/Browse` / `/library/v1/Songs` request | read | – |
| POP-11 | Browser in another language | Option `locale: de-DE` | Track list still filled (requests send `Accept-Language: en`) | read | – |
| POP-12 | Close the popup | Close button; click on the backdrop; Esc | Popup closed each time; Esc does not close the settings panel behind it | read | – |
| POP-13 | Track list fails | Mock answers HTTP 500 for the album's `/Browse` | Empty list, popup "Loading the tracks did not succeed" with the `/Browse` request; songs missing (`/library/v1/Songs` fails) → popup "Loading the album details did not succeed", no year / technical data, tracks still shown | – | – |
| POP-14 | Page behind stays still | Page scrollable; popup open; mouse wheel over the backdrop and over the track list (also past its end) | Only the popup content scrolls; the page keeps its scroll position; after closing the page scrolls again | – | – |
| POP-15 | Full-size cover | Open the popup of TD-ALB-LIB | Cover asked with `&width=3000&height=3000&followRedirects=1` (`COVER_FULL`); grid covers: GRD-12 | read | – |
| POP-16 | Multi-disc album | Mock state `discs`: TD-TRK split into disc 1 (first half) and disc 2, numbers start again at 1 per disc (like API test E32) | Header "Disc N" (shown in capitals) before the tracks of each disc; numbers as in TD-TRK per disc; album details "2 discs · total time"; a click on the first track of disc 2 plays it | – | – |
| POP-17 | Multi-disc album numbered across the discs | Like POP-16, mock state `discRunOn`: numbers run on over both discs | Disc 2 header before the first song with `discno` 2; numbers run on | – | – |
| POP-18 | Same title on two discs | Like POP-16; the first track of disc 2 gets the title of track 1 and another artist | Artist shown only on the first track of disc 2 (song of the same position) | – | – |
| POP-19 | Outdated popup failure | Delayed HTTP 500 for the track list or songs of album A; meanwhile open album B | Tracks of B stay; no error popup | – | local |
| POP-20 | Closed popup | Delayed HTTP 500 for album tracks, songs or playlist tracks; close the popup. Close and open another album at once | No error popup; the album opened at once still loads | – | – |
| POP-21 | Cover in full screen | Popup of TD-ALB-LIB, click the loaded cover; click anywhere; Enter on the cover, Esc | Cover is a button (cursor zoom-in); the view shows it drawn in its own size, on a background in its colour, without a new `/Artwork` request; a click or Esc closes only the view, the popup stays open; with Enter the focus is on its close button | read | – |
| POP-22 | Empty track list | Mock answers the album's `/Browse` once without tracks; close, open the album again | "No tracks" in the list, no error popup; opened again: `/Browse` requested again, tracks shown | – | – |

### 4.8 Search (SRH)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| SRH-01 | Search with Enter | Show the search field (search button), type a term, press Enter | `/Browse?key=<searchKey>&q=<term>` per source; albums link of TD-SEARCH followed; tiles = albums; status line "N albums with “<term>” …" (first group, see SRH-10); no chip pressed; no random tile | read | local |
| SRH-02 | One album request per search | Same as SRH-01 | Albums list read once per source (no second request for the same list) | – | – |
| SRH-03 | Search only from `SEARCH_MIN` characters | Type fewer than `SEARCH_MIN` characters; then reach `SEARCH_MIN`; wait less / more than `SEARCH_DELAY`; Enter with fewer characters, then with `SEARCH_MIN` | No search below `SEARCH_MIN`, also not with Enter (hint "Type at least 3 characters to search."); while typing one search after the pause; Enter searches at once from `SEARCH_MIN` | read | – |
| SRH-04 | Empty field restores the view | Search, then clear the field | Previous chip pressed again, its albums shown, status line of the view (e.g. "N albums in favourites"); no request | read | – |
| SRH-05 | Sectioned search result | Albums link answers with sections | Albums of every filled section | – | – |
| SRH-06 | Direct album items | Search answer contains album items | These albums shown without following a link | – | – |
| SRH-07 | Only the newest search counts | Two searches quickly after each other, the first answers late | Grid shows the second result | – | – |
| SRH-08 | Search error / not possible | Mock fails the search; source without `searchKey` | "Search failed: …" in red and popup "The search did not succeed" with the search request; without search key: "Connect first – or the player offers no search." | – | – |
| SRH-09 | Albums of the composers found | Search answer with a composers list (2 pages, 2 composers); the albums of both composers overlap with each other and with the albums list | Composers list followed over its pages; per composer its browse menu and its albums link read; tiles = albums of the albums list plus the composers' albums, each album once per source; the composer group line counts the composers' new albums, all group lines together count every album | – | – |
| SRH-10 | Result grouped by album title, album artist, track artist and composer | Albums list with the term at a word start in the title, with an accented letter in the title, inside a word of the title, and in the artist only; every album of the library (`section=all`) with one album only found by its album artist, one already in the albums list, one with the term inside a word of the album artist; one composer album, one composer album that is also in the albums list | Groups in this order, each A–Z by title, empty groups left out: album title (term at a word start, case and accents ignored), album artist (library albums whose album artist has the term at a word start), track artist (rest of the albums list), composer (composers' albums not in a group before); each album in one group only; the library album list read once. Status line = line of the first group ("N albums with “<term>” in the album title"); a line of the same style with a fine line below before every further group ("… as an album artist", "… as a track artist", "… as a composer"); no random tile | – | local |
| SRH-11 | Search areas | Chips Album / Artist / Composer in the search field; search “fugue” (data of SRH-10); switch Artist on, then Album off, then Artist off, then Composer on; reload; a chip with an empty field | Default only Album: title group, no library album list, no composer request. A chip change searches again at once: + Artist → title, album artist and track artist groups, library album list read once; − Album → album artist and track artist groups, list not read again; all off → hint “Select at least one search area.”, no search; only Composer → composer group, no albums list. Chip states stored across a reload; with an empty field a chip starts no search | – | – |
| SRH-12 | Search button | Start; click the search button; search; Esc in the field; click the button, search, click the button again; show the field, search, click the clear button (×) of the field (Safari, Chrome) | Field hidden at the start, search, filter and queue button in this order. The button shows field and search areas with focus in the field and is highlighted in the accent colour while the field is shown; Esc or the button hides the field (focus back on the button), clears the term and restores the selected view (chip pressed, status line of the view, no request). Clear button (×): filled circle in the dim text colour in both designs; empties the field and restores the view, the field stays | read | – |
| SRH-13 | View finishes during a search | Delayed answer or failure of artist (TD-ART), genre, CD, All, New, HD, Playlists; meanwhile search, then clear | Results stay; clearing shows the view or its error (with popup) | – | local |

### 4.9 Player footer (FTR)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| FTR-01 | Now playing | Connect, TD-STATUS playing | Line 1 = `title1` (else `name`), line 2 = "by `title2` from `title3`" (`title2` / `title3` = `artist` / `album`), artist and album in the text colour of line 1, not bold; cover from `image` | read | local |
| FTR-02 | Quality tag | TD-STATUS with `quality` cd / hd / hr / mqa / dolby, `streamFormat` MP3 | Tag CD / HD / HD / MQA / Dolby / MP3 (MP3 wins); tooltip = `streamFormat`; no tag for other values | – | – |
| FTR-03 | No source icon | Footer | No USB / library icon in the player bar | read | – |
| FTR-04 | Nothing playing | Mock `playing: false` | Line 1 "Nothing playing", line 2 empty, no cover, no quality tag; full screen cannot open | – | – |
| FTR-05 | Play / pause | Click play/pause | `/Pause?toggle=1`; icon follows the returned `state` (SVG, play ≠ pause icon) | write | local |
| FTR-06 | Previous / next | Click previous, next | `/Back`, `/Skip`; new track arrives through long polling | write | local |
| FTR-07 | Progress strip | TD-STATUS with `secs`, `totlen` | Strip width = secs / totlen, advancing while playing (4× per second), standing while paused; `aria-valuenow` / `aria-valuemax` | – | – |
| FTR-08 | Seek by click | `canSeek` = 1, click in the strip | `/Play?seek=<seconds at the click position>` (limited to 0 … totlen − 1) | write | – |
| FTR-09 | Seek by keyboard | Focus the strip, ArrowRight / ArrowLeft | Seek +5 s / −5 s | write | – |
| FTR-10 | Seek not possible | `canSeek` = 0 | No seek request; `aria-disabled=true` | – | – |
| FTR-11 | Position tooltip | Move the pointer over the strip | Tooltip "m:ss / m:ss" (position under the pointer / total) | read | – |
| FTR-12 | Volume slider | Drag the slider | `/Volume?level=<value>` at most every 150 ms while dragging and once on release; slider not overwritten by status while dragging | write | – |
| FTR-13 | Volume buttons | Click volume down / up | `/Volume?db=-2` / `/Volume?db=2`; slider follows the answer | write | local |
| FTR-14 | Fixed volume | `<volume>-1</volume>` in status | Slider and both buttons disabled | – | – |
| FTR-15 | Listening mode icon | TD-LM | Icon = `iconActive` of the current mode (blob URL, inverted in the light design), alt text = mode `displayName`, tooltip "<setting displayName>: <mode displayName>"; before volume down; dimmed in a frame in the line colour with the corners of a tag (not round); no hover effect; display only | read | – |
| FTR-16 | Listening mode follows syncStat | Change the mode in the mock and raise `syncStat` | `/audioPreset` read once on connect and again only after the change; icon shows the new mode; no command sent | – | – |
| FTR-17 | Player without listening modes | Option `listeningModes: false` (404) | Icon and its frame hidden, no image; no error popup; no JavaScript error | – | – |
| FTR-18 | Long polling | Connect; mock answers with an error once | `/Status?timeout=100`, then with `&etag=` of the last answer; at least 1 s between requests, 5 s after an error; no one-off `/Status` / `/Volume` | – | – |
| FTR-19 | Long polling after sleep / hanging request | Hold a `/Status` long poll; the page clock jumps 60 s ahead (sleep); hold the next one while the clock runs fast without a jump | After the jump at once a new `/Status?timeout=100` without etag, footer shows the new state; a request open longer than 115 s is replaced the same way; no error popup | – | – |
| FTR-20 | Year after the album, words of line 2 | Something playing from the queue (TD-STATUS `song`); open and close the full screen; new track (mock: `song` 2 with year 1999); stream outside the queue (`streamUrl`) with `title2` ≠ `artist` | Line 2 "… from `title3` (year)", year = `<date>` of `/Playlist?start=<song>&end=<song>`, once per track, also with the full screen closed; follows the new track; stream: no year, line 2 `title2 – title3` without "by" / "from" | read | – |

### 4.10 Full screen (FUL)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| FUL-01 | Open from the footer cover | Something playing, click the footer cover | Full-screen view with cover and the lines `title1`, "by `title2`", "from `title3`" of TD-STATUS (artist and album bold), no year; cover not requested again | read | local |
| FUL-02 | No player controls | Full screen open, pointer at the bottom edge | The view covers the footer, also at the bottom edge; the footer is inert while the view is open and usable again after closing | read | – |
| FUL-03 | Close | Esc; click anywhere in the view; close button at the top right | Closed each time; the close button shows on opening and on mouse movement, hides after 2.5 s without movement | read | – |
| FUL-04 | Keyboard | Focus the footer cover, Enter; Space on the close button | Opens the view with the focus on the close button; Space closes it, the focus returns to the footer cover | read | – |
| FUL-05 | Playback stops | Full screen open, status without title | View closes by itself; cannot be opened while nothing plays | – | – |
| FUL-06 | Background from the cover | Something playing (mock cover with one colour); new cover while the view is open; cover fails (`/Artwork` 404) | Ambient colour `--amb` = colour of the cover, view background is a gradient of it mixed with the theme background; follows the new cover; without a readable cover (also covers of other hosts, e.g. radio) no colour, plain theme background | – | – |
| FUL-07 | Full-size cover | Something playing (TD-STATUS) | Cover asked with `&width=3000&height=3000&followRedirects=1` (`COVER_FULL`), one request for the footer and the full screen | read | – |

### 4.11 Queue panel (QUE)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| QUE-01 | Pin the panel | Click the queue button | Panel open, button label "Unpin queue", highlighted in the accent colour, `qpin=1` stored; `/Playlist?start=0&end=199` | read | local |
| QUE-02 | Pinned panel survives reload | Pin, reload | Panel open again and loaded | read | – |
| QUE-03 | Pinned panel stays open | Click outside the panel | Panel stays open; on wide windows the grid moves aside | read | – |
| QUE-04 | Queue list | Panel open | One row per song of TD-QUEUE: number (id + 1), title, "artist – album", duration m:ss when `time` > 0; footer "N tracks" and total time | read | – |
| QUE-05 | Current track | TD-STATUS `song` | Matching row highlighted and scrolled into view | read | – |
| QUE-06 | Play a queue entry | Click a row | `/Play?id=<id>` | write | local |
| QUE-07 | Remove button | Hover a row, click ✕ | ✕ replaces the duration of that row only; `/Delete?id=<id>` | write | local |
| QUE-08 | Queue reloads once after a change | Remove, shuffle, clear | Exactly one `/Playlist` load per change, triggered by the new `pid` in `/Status` | write | – |
| QUE-09 | Shuffle | Click shuffle twice | `/Shuffle?state=1`, then `0`; button follows `<shuffle>` of `/Status`; toast "Shuffle on / off" | write | – |
| QUE-10 | Repeat | Click repeat three times | off → queue → track → off; `/Repeat?state=0`, `1`, `2`; label "Repeat: …", pressed unless off | write | – |
| QUE-11 | Save as BluOS playlist | Click save, enter TD-SETVAL in the question popup | Question popup of the app "Save the queue as BluOS playlist:" with a name field, default "Queue YYYY-MM-DD HH:MM", button "Save"; `/Save?name=<answer>`; toast "Saved BluOS playlist “<name>” (N tracks)"; playlists reloaded | write | local |
| QUE-12 | Save cancelled / failed | Cancel the question popup; mock answers `<saved><entries>0</entries></saved>` | Cancel: no request; failure: popup "Saving the playlist did not succeed" with request, status and raw answer | read (part) | – |
| QUE-15 | Clear the queue | Click clear, confirm / cancel in the question popup | Popup "Clear the whole queue?", button "Clear"; confirm: `/Clear`; cancel: nothing sent | write | – |
| QUE-16 | Empty queue, long queue, error | Empty `/Playlist`; more than 200 songs; HTTP 500 | Empty: save, clear, shuffle, repeat disabled, no count; long: loaded in pages of 200, at most 2000; error: "Could not load queue" and popup "Loading the queue did not succeed" with the `/Playlist` request | – | – |
| QUE-17 | Reorder by drag and drop | Open queue; drag entry 1 by its number below the middle of entry 4; drag entry 5 above the middle of entry 2; drag the playing entry (TD-STATUS `song`); on a touch screen drag entry 1 by its title, then by its number | While dragging: row dimmed, a line marks where it lands; on release `/Move?new=3&old=0` / `/Move?new=1&old=4` / `/Move?new=<to>&old=<song>`; rows reordered and numbered again at once; no `/Play`; the playing entry keeps its mark at its new position (checked after the queue reload, `/Status` `song` = the new position); the queue loads once (new `pid`) in the player's order; touch screen: the number is the drag handle (above the play button, `touch-action: none`), a drag from the title sends nothing, the rows select no text | write (part) | – |
| QUE-18 | Click or drag | Pointer moved less than 6 px; a drag that ends at the same place | Short movement: a click (`/Play?id=`); same place: no `/Move`, no `/Play` | write | – |
| QUE-19 | Reorder with the keyboard | Focus entry 1, Alt+↑, Alt+↓ | First entry: Alt+↑ sends nothing; Alt+↓ `/Move?new=1&old=0`, rows reordered, focus stays on the entry | write | local |
| QUE-20 | Move not successful | Mock answers `/Move` with HTTP 500 | Popup "The player command did not succeed" with the `/Move` request; queue read again in the player's order | – | – |

### 4.12 Playlists (PLS)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| PLS-01 | Playlists chip and view | Connect; click the Playlists chip | Chip "Playlists" (text) right after New, tooltip "BluOS and library playlists". Click: chip pressed, playlists read again; status line "N BluOS playlists", grid line "N library playlists"; random playlist tile ("from N playlists" of both groups), then the tiles of TD-PL and TD-LPL in the player's order with cover, name and "Playlist" (no artist link). Hover: BluOS playlist play, add, delete; library playlist play, add, heart | read | local |
| PLS-02 | Play a playlist | Play button of a playlist tile | Its play URL (`/Load…` or the "play" action of the context menu); toast "Playing playlist: <name>"; open queue reloaded after 1.5 s if the playlist id did not change | write (part) | – |
| PLS-03 | Player without playlists | Top menu without the playlists link, no library playlists; top menu without the playlists link only | None: no Playlists chip, statistics without "Playlists"; library playlists only: chip, status line "N library playlists", no group line, the tiles of TD-LPL | – | – |
| PLS-04 | Chip survives a source change | Switch a source off and on | The Playlists chip again right after New | read | – |
| PLS-05 | Paging | Playlists answer with `nextKey` | All pages read (at most 20), tiles of every page | – | – |
| PLS-06 | Add a playlist to the queue | Add button of a playlist tile | The `add-last` URL of the playlist's context menu; toast "Added to queue: <name>" | write | – |
| PLS-07 | Playlist popup | Click the cover of the first playlist of TD-PL; close, open again; the cover of the first playlist of TD-LPL | Name, line "Playlist" (no link), "N tracks · total time"; tracks of TD-PL-TRK of every page: position, title, "artist • album", duration; no year, no quality; read again on every opening (not cached); library playlist: its source (e.g. "Library") and the tracks of TD-LPL-TRK | read | local |
| PLS-08 | Play a playlist track | Click the last track of the popup | Its `autoplayURL` (later pages: `playURL` with `offset`); toast "Track started" | write | – |
| PLS-09 | Search and the Playlists view | Playlists view, search TD-TERM, empty the field | Playlists view back: chip pressed, random playlist tile and playlist tiles of both groups, "N BluOS playlists" | read | – |
| PLS-10 | Delete a playlist | Delete button (trash icon) of a playlist tile (real player: `__blualbum_test_list__`, saved for the test), confirm in the question popup | Button label "Delete playlist <name>"; question names it, button "Delete"; the "delete" action of its context menu (`/Delete?name=<name>&service=BluOS`); toast "Deleted playlist “<name>”"; playlists reloaded, its tile gone | write | local |
| PLS-11 | Delete cancelled / failed | Cancel the question popup; mock answers with `<error>` | Cancel: no request, all tiles stay; failure: popup "Deleting the playlist did not succeed" | read (part) | – |
| PLS-12 | Random playlist | Playlists view: play button, add button of the random playlist tile | Play: label "Play a random playlist", the play URL of a playlist of TD-PL or TD-LPL, toast "Playing playlist: <name>"; add: its `add-last` URL, toast "Added to queue: <name>" | write | – |
| PLS-13 | Favourite a library playlist | Favourites; Playlists view, heart of the first playlist of TD-LPL (mock: no favourite); Favourites; Playlists, click again; Favourites | Favourites without a group line. Empty heart, label "Add to favourites: <name>"; click: `/AddFavourite?playlistid=…&service=LocalMusic` of its context menu, toast "Added to favourites", heart filled, context menu read again with `isFavourite=1`. Favourites: the albums, then the group line "1 library playlist in favourites" and the playlist's tile; random tile "Random album"; no playlist request. Again: `/DeleteFavourite?playlistid=…`, toast "Removed from favourites", heart empty; Favourites without the group | – | – |

### 4.13 Settings panel (SET)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| SET-01 | Open and close | Settings button opens; back button, click on the scrim, Esc close | Opens / closes; `aria-expanded` follows; Esc with an open popup closes only the popup (POP-12) | read | – |
| SET-02 | Chip switches, filter button | Section "Filter chips" (Quality, Decades, Genres, in the order of the chip row): switch genre and quality chips off; decade chips on and off (CHP-16); click the filter button in the header, reload, connect, click it again | No switch for the Playlists chip; only All, Favourites, New, Playlists visible, no separator; switched on again → chips back; decade chips hidden when switched off. Filter button: chip row shown by default (button highlighted in the accent colour); a click hides the whole chip row, the status line stays, button not highlighted; stored across a reload; a click shows the row again | read | local |
| SET-03 | Switches are stored | After SET-02 / CHP-16, reload | Switches keep their state (decade chips on → built again after connecting) | read | – |
| SET-04 | Cover size | Select S, M, L | Tile width and spacing between tiles S < M < L (phones: 3, 2, 1 columns), more space between rows than columns; stored as `tile`; pressed segment follows | read | – |
| SET-05 | Design | Day, Night, System with light / dark system scheme | Background light / dark accordingly; stored as `theme` | read | – |
| SET-06 | Stored size and design are restored | Set L and Night, reload | L and Night active before connecting | read | – |
| SET-07 | Invalid stored values | localStorage `theme=x`, `tile=x` | System design and size M | read | – |
| SET-08 | Library settings | Connect with TD-SET | Section "Music Library Settings": network shares (description, "None" when empty), "Optimize artwork" and "Server mode" as On / Off; rows without a value left out | read (part) | – |
| SET-09 | Version in the panel footer | Open the panel | "About" button with "v" + `APP.version` | read | – |

### 4.14 About popup (ABT)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| ABT-01 | Content | Open About | App logo (double note in a circle, text colour) above the app name, app name, "Version v<APP.version>", copyright line, GitHub link (`APP.repo`, new tab), no independence notice, player rows: room, BluOS version and API version of TD-VER | read | local |
| ABT-02 | Statistics loaded on opening, once | Open About twice | No versions / statistics before opening; then `/GitVersion`, `/Version` and four section lists per source; none on the second opening | read | – |
| ABT-03 | Statistic values | Open About | Albums = sum of the section counts (TD-SEC) of all sources; Artists / Songs / Composers summed per source; Genres = number of TD-GEN names; Playlists = number of TD-PL and TD-LPL; "…" while loading, "–" when not available | read (part) | – |
| ABT-04 | Statistics reload after a source change | Open About, switch a source off, open again | Statistics loaded again for the new selection | read | – |
| ABT-05 | Update check | Click "Check for updates" with a newer tag, the same version, HTTP 403 | No GitHub request before the click; one request to the latest release; "Update available: <tag>" with link (new tab) / "You have the latest version." / "Update check failed (HTTP 403)."; button disabled while checking | read | – |
| ABT-06 | Update check without network / without tag | GitHub request fails; answer without `tag_name` | "Update check failed (…)." | read | – |

### 4.15 Error handling (ERR)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| ERR-01 | Failed command | Mock answers HTTP 500 for `/Add` (tile play) | Popup "The player command did not succeed" with request (without host), HTTP 500 and the answer; no other change | – | local |
| ERR-02 | Command before connecting | Not connected, click play/pause or save the queue | Toast "Connect first"; no request | read | – |
| ERR-03 | Player error answer | Mock answers `<e><message>…</message></e>` | Treated as failure: the player's message in the status line, the raw `<e>` answer (HTTP 200) in the popup; also for commands (`/Shuffle`) | – | – |
| ERR-04 | Popup for unsuccessful answers | See QUE-12 / PLS-11 | Title, request path without host, HTTP status, raw body ("(empty response)" when empty); close button not focused | – | – |
| ERR-05 | English answers | Any request | Header `Accept-Language: en` on every player request except the images (covers `/Artwork` and source icons `/images/…`, read with a plain `fetch()`) | read | local |
| ERR-06 | No genres | Genre lists empty | Error "No genres found. Has the library finished indexing?"; panel open | – | – |
| ERR-07 | Every failed player request is shown | See CON-07, CON-13, CHP-14, FAV-05, POP-13, SRH-08, QUE-16, ERR-01, ERR-03 | Popup with a title per action, request path without host, status (HTTP status or "No answer – …") and raw answer; status line messages stay | – | – |
| ERR-08 | Expected failures are not shown | Player without listening modes (FTR-17); statistic list not available (ABT-03); missing cover (SEC-03); aborted or failed status polling (FTR long polling) | No error popup | – | – |

### 4.16 Security & robustness (SEC)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| SEC-01 | Image URLs | `imgUrl()` with a player path, `/Artwork` path, https URL, protocol-relative URL, `javascript:`, `data:`, empty | Player path → player URL (`/Artwork` + `followRedirects=1`); https kept; everything else "" | read | local |
| SEC-02 | Covers as blob URLs | Grid, popup and footer covers | Read with `fetch()` and shown as `blob:` (works in Firefox on `file://`); now playing cover requested once for footer and full screen | read | – |
| SEC-03 | Broken cover | `/Artwork` answers HTTP 404 | Grid: image removed, tile stays; footer: cover hidden | – | – |
| SEC-04 | Blocked storage | localStorage throws (private mode) | App works; conveniences are not kept | read | – |
| SEC-05 | Old stored values removed | localStorage with `fav:…`, `src:…`, `genres:…`, `plchips` | Keys removed on start | read | – |

### 4.17 Layout & accessibility (LAY)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| LAY-01 | Readable texts, no horizontal scrolling | Every cover size in every design; Day and Night with pinned queue and open popup | Contrast ≥ 4.5 (WCAG AA) of album titles, now playing title, queue titles and artists, track count of the queue, status line, text of the selected chip, popup title and tracks; first track 8 px or more below the close button; no horizontal scrolling | read | local |
| LAY-02 | Keyboard and screen reader labels | Queue pinned; all visible controls; Tab on the chip row | Every control has a name (`aria-label`, text, title or label); chips have `aria-pressed`, switches `aria-checked`, menu, filter and queue button `aria-expanded`; Tab moves to the next chip (Safari: Option-Tab, its default for buttons) | read | – |
| LAY-03 | Favicon | Open the app (no connection) | `link rel="icon"` is an embedded SVG (`data:` URI, no request): double note knocked out of a circle, dark in light mode and cream in dark mode (`prefers-color-scheme`); the image loads; the tab shows it in Chrome, Edge and Firefox (Safari shows no favicon for `file://` pages) | read | – |
| LAY-04 | Header logo | Open the app (no connection) | Settings button first, then the app logo (double note in a circle, text colour) left of the title "BluAlbum" | read | – |

### 4.18 Regression & session (REG)

| ID | Test case | Input | Expected output | Real player | Local |
|---|---|---|---|---|---|
| REG-01 | No playback on page load | Connect, wait | No `/Add`, `/Play` or `/Load` command | read | local |
| REG-02 | Request budget of the first view | Connect, wait | No genre album lists, no statistics, no version requests, no one-off `/Status` / `/Volume`; long polling and `/Settings` run | read | local |
| REG-03 | Full session without JavaScript errors | Click All, New, CD and a genre of TD-GEN | No page error | read | local |
