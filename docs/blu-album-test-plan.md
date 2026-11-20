# BluAlbum – test plan

This plan lists every function of the app (`blualbum.html`) as test cases, grouped into test blocks, with inputs, expected outputs and how each case is covered today. It is the reference for extending the UI tests in `tests/ui/run.js`; the API behaviour of the player itself is tested by the Bruno collection (`tests/api`, see `docs/bluos-api.md`).

## 1. How to read this plan

- **ID**: `<block>-<number>`, e.g. `QUE-04`. Numbers give the order in which the cases are meant to run within a block: from the basic state to the actions that build on it. Every case starts from a fresh browser profile, connected to the player, in the default view (Favourites), unless the input says otherwise.
- **Input**: the start state, options of the test run and the user actions.
- **Expected output**: what the user sees and which requests / commands reach the player. Values are given as references to the test data (section 3.5), never as concrete artists, albums or numbers.
- **Real player**: whether the case also runs against the real player (environment ENV-4): **write** = the case sends a request that changes data on the player (player controls such as play, pause, skip, seek and volume; the queue; playlists; favourites; shuffle / repeat); it runs only with `--write`, and the state is restored afterwards. **read** = the case only reads from the player. **–** = mock only: it needs answers a real player does not give on demand (errors, delays, a second player, a patched status, a generated queue). "(part)" = some of the checks of this case are mock only.
- **Status**:
  - **Auto** – test automation: the case is checked automatically by the Playwright UI tests in `tests/ui/run.js`, in every test environment that runs them (section 3.1). The name of each UI test starts with the IDs it covers, so `node run.js --only QUE-04` runs the test of `QUE-04` and `node run.js --only QUE-` the whole block; `node run.js --list` lists every test with its mark (read / write / mock).
  - **Manual** – checked by hand (no case needs this today; the manual environments ENV-5 and ENV-6 look at the app as a whole).

## 2. Overview of the test blocks

| Block | Chapter | Scope | Cases | Auto | Real player |
|---|---|---|---|---|---|
| CON | 4.1 Connection & start | Start page, IP form, connect, errors, time limit, compact connection line, changing the player | 14 | 14 | 10 |
| SRC | 4.2 Music sources | Source detection, one switch per source, stored per player | 6 | 6 | 3 |
| CHP | 4.3 Chips & views | Chip row, All, Favourites, New, quality, genres, caching, outdated results | 14 | 14 | 10 |
| GRD | 4.4 Album grid | Tiles, lazy rendering, random album tile, hover buttons | 9 | 9 | 8 |
| FAV | 4.5 Favourites | Heart on the cover, toggling via the player, no local favourites | 6 | 6 | 5 |
| ART | 4.6 Artist view | Albums of an artist across sources, favourite state, cache | 4 | 4 | 4 |
| POP | 4.7 Album popup | Details, technical data, track list, playing a track, closing | 15 | 15 | 10 |
| SRH | 4.8 Search | Player search, albums of found composers, typing rules, empty field, errors | 9 | 9 | 3 |
| FTR | 4.9 Player footer | Now playing, quality tag, transport, progress, volume, listening mode, long polling | 18 | 18 | 10 |
| FUL | 4.10 Full screen | Full-screen now playing view, background from the cover, full-size cover | 7 | 7 | 5 |
| QUE | 4.11 Queue panel | Pinning, list, remove, shuffle, repeat, save, delete playlist, clear | 16 | 16 | 15 |
| PLS | 4.12 Playlist chips | Saved playlists as chips, loading a playlist | 5 | 5 | 3 |
| SET | 4.13 Settings panel | Panel, chip switches, cover size, design, library settings | 9 | 9 | 9 |
| ABT | 4.14 About popup | Content, statistics, versions, update check | 6 | 6 | 6 |
| ERR | 4.15 Error handling | Failed requests in the popup, expected failures not shown, request headers | 8 | 8 | 2 |
| SEC | 4.16 Security & robustness | Image URLs, blob covers, blocked storage, clean-up of old keys | 5 | 5 | 4 |
| LAY | 4.17 Layout & accessibility | Contrast, horizontal scrolling, control names, keyboard | 2 | 2 | 2 |
| REG | 4.18 Regression & session | No playback on load, request budget, no JavaScript errors | 3 | 3 | 3 |
| | | **Total** | **156** | **156** | **112** |

Test order across blocks: CON → SRC → CHP → GRD → FAV → ART → POP → SRH → FTR → FUL → QUE → PLS → SET → ABT → ERR → SEC → LAY → REG. A block only relies on blocks before it (e.g. FAV needs the grid, QUE needs the footer's long polling). `run.js` runs the tests in this order.

## 3. Test environment and test data

### 3.1 Test environments

The test cases of chapter 4 are the same in every environment; the environments differ in how they run, platform, scope and player.

| ID | Environment | Execution | Platform (OS, browsers) | Scope (window sizes, cases) | Player / data | State | Run |
|---|---|---|---|---|---|---|---|
| ENV-1 | Browsers, local, mock data | Automated | macOS (owner's Mac): Chrome and Edge (installed apps), Safari (Playwright's WebKit), Firefox (Playwright's build) | 1200x800 (other sizes with `--viewport`); all 147 cases | Mock player, fixtures | In place | `npm test` in `tests/ui` |
| ENV-2 | Browsers, remote (GitHub Actions), mock data | Automated | macOS: Safari (WebKit), Chrome · Windows: Edge, Chrome, Firefox · Linux: Chrome, Firefox | 1280x800, 1440x900@2, 1920x1080; all 147 cases; screenshots of the main views (`--shots`) as artifact | Mock player, fixtures | In place | `.github/workflows/ui-tests.yml`: push, pull request, Mondays, on demand |
| ENV-3 | Mobile browsers, mock data | Automated | Playwright device emulation: iPhone (WebKit), Android phone (Chromium); local and GitHub runners | Phone viewport, touch, no hover; cases to be adapted (section 3.2) | Mock player, fixtures | **Missing** | — |
| ENV-4 | Browsers, local, real player | Automated | macOS (owner's Mac, home network): Chrome, Edge, Safari (WebKit), Firefox | 1200x800; the cases marked read (with `--write` also write) – 110 of 147 (86 read, 24 write) | Owner's player, live answers | In place | `node run.js --player <ip>` (read) or `--player <ip> --write` |
| ENV-5 | Safari app, real player | Manual, before a release | macOS: the Safari app (Playwright's WebKit is its engine, not the app) | Main views; the Safari pitfalls of `CLAUDE.md`: popup track list of a long album (height 0), old cached file (reload with ⌥⌘R) | Owner's player | In place | By hand |
| ENV-6 | Phone, real player | Manual, before a release | A real phone (iOS Safari or Android Chrome) | Main views, touch without hover | Owner's player | In place | By hand |

Common to the automated environments:

- **App**: `blualbum.html` as a `file://` page in a fresh browser profile per case.
- **Player**: with mock data the mock player `tests/ui/mock-player.js` at the address `IP` of `run.js` (documentation range, never a real device; `IP2` is a second mock player for changing the player). It answers from the fixtures and records every request (`state.requests`, with time and `Accept-Language`) and every command (`state.commands`). With `--player` the requests go through to the real player and are recorded the same way (`createRecorder()`).
- **Mock options per test**: `usb: false`, `playing: false`, `listeningModes: false`, `statusPatch` (replaces tags of `/Status`, e.g. `quality`, `canSeek`, `volume`), `overrides` (answer a matching request with an HTTP status or body, edit the mock's answer, or answer later), `mock` (sets state, e.g. an empty or generated long queue).
- **Start options per test**: `connect: false` (start page), `storage` (localStorage before the start), `locale`, `dialog: "dismiss"` / `promptValue` (prompt and confirm), `unreachable` (every player request fails), `blockStorage` (localStorage throws), `appDefaults` (the app's own chip defaults; otherwise genre and quality chips are switched on in the fresh profile, as most cases use them).
- **GitHub API**: intercepted by `run.js` (`gh.answer`, `gh.delay`); without an answer the request fails.

### 3.2 Mobile browsers (ENV-3, missing)

Proposal: an option `--device "<Playwright device name>"` for `run.js` (e.g. `iPhone 15` with WebKit, `Pixel 7` with Chromium) that sets viewport, device pixel ratio, touch (`hasTouch`), `isMobile` and the user agent instead of `--viewport`. To be decided while building it:

- The cover buttons appear on hover (`@media (hover: hover)`); on a touch device the tests tap instead of hover, so the helpers of `run.js` need a touch variant.
- Layout cases on phone width: no horizontal scrolling, panels cover the grid instead of moving it aside (QUE-03 only on wide windows), full-screen view without the bottom-edge footer.
- In GitHub Actions: one more matrix entry per device (macOS for the iPhone, Linux for Android).

### 3.3 Real player (ENV-4)

`node run.js --player <ip>` runs the same UI tests against the owner's player (option A of section 5, decided 2026-11-17). Not in GitHub Actions: the runners cannot reach the home network.

- **Test data**: before the tests, `run.js` asks the player the same questions as the app (`buildTD()`: menus, genres, sections, all albums, New, favourites, an artist, playlists, status, queue, settings, versions, statistics) and builds `TD` from the answers. With the mock the same function asks the mock, so both environments use one set of rules.
- **Read tests** (default): change nothing on the player; only the browser's local storage changes.
- **Write tests** (`--write`): play albums and tracks, pause, skip, seek, change the volume by a few steps, change the queue (remove, shuffle, clear, load a playlist), repeat, favourites, save and delete a playlist. Before the first write test the queue is saved as playlist `__blualbum_ui_test__`. When no library title is playing or paused, or fewer than 3 tracks are queued, `prepare()` plays the first album of TD-ALL with 3 or more tracks and saves it as `__blualbum_ui_test_start__`. After every write test the queue the tests start from is loaded again and position, pause state, shuffle, repeat and volume are set back (like the Bruno folder "2 Write"); at the end the original queue is restored and both playlists are deleted. An input such as HDMI cannot be restored. Favourites and pause are toggled back in the test itself. Saving and deleting use a playlist of the test (`__blualbum_test_list__`); no saved playlist of the owner is deleted.
- **Requirements**: only the "Local Network" permission of the terminal on macOS; the player can be in any state. Cases that need something the player lacks are skipped with the reason (`needs` of the test): `usb` a USB drive with albums (without one "All" also keeps the order of the player's sections), `library` a library title playing or paused (TD-NOW-LIB), `queue` at least 3 tracks in TD-QUEUE, `playlist` at least one entry in TD-PL. With `--write`, `prepare()` provides library, queue and playlist. A library that is indexing during the run can change counts.
- **Expected values on a real player**: request counts that depend on paging (longer lists come in several pages) are checked as "at least" instead of "exactly"; now playing is read again at the start of every test.
- **Mock only**: error answers, delays, a patched status, a second player, generated queues.

### 3.4 Rule: no hard-coded test data

Fixtures are re-recorded after firmware updates or library changes (`tests/ui/README.md` → "Update the fixtures"), and the real player's library changes all the time. Expected values are therefore **derived at test time**: `run.js` builds the test data (object `TD`, IDs as in section 3.5) by asking the player the tests run against (`buildTD()`; the mock answers from the fixtures and exports the data it adds itself: `USB_GENRES`, `USB_SECTIONS`, `VERSIONS`).

- Counts: count the elements in the answer (e.g. number of albums in `TD-FAV`), do not write the number.
- Names (artist, album, genre, playlist, room): pick them from the answers by a rule (e.g. "a genre that only the library has", "the artist of the first favourite that has albums").
- Technical data (year, format, bit depth, sample rate, bitrate): computed from `TD-SONGS` with the rules of the album popup (`songDetails()` in `run.js`).
- Only values that are part of the app itself may be literal: texts of the UI ("Random album", "Repeat: off"), `APP` constants, the batch size of 60, `SEARCH_MIN` / `SEARCH_DELAY`, endpoint names; and test values the test sets itself (TD-SETVAL).

### 3.5 Test data dictionary

Built by `buildTD()` from the answers of the player the tests run against (mock: the fixtures named in the second column).

| ID | Source (fixture of the mock) | Content (derived at test time) |
|---|---|---|
| TD-IP | `run.js` (`IP`) | Address of the player: the mock's, or the one given with `--player` |
| TD-TOP | Top menu (01) | Source links (library / USB icon), the saved playlists link; without USB the mock removes the USB item (`usb: false`) |
| TD-SRC | TD-TOP | Sources = link items with `LibraryIcon` / `USBIcon`; name = `text`, key = `browseKey` |
| TD-GEN | Genre lists of every source (04 + mock) | Genre names of every source; chip row = sorted union; TD-GEN-ONE = a genre of the library only |
| TD-SEC | Album sections of every source (06) | A–Z sections with album counts (`text2`); "filled" = `text2` ≠ 0; USB: the mock keeps only some sections |
| TD-ALL | Albums of the filled sections (07) | Albums of the first filled library section; ALL_COUNT = albums of every filled section of every source (the mock answers albums only for one section) |
| TD-TRK | Track list of TD-ALB-LIB (08) | Tracks with `text` ("N. Title") and `duration`, in the order of TD-SONGS |
| TD-CM | Context menu of an album (09) | Favourite state follows `isFavourite=1` in the key |
| TD-NEW | `/library/v1/Albums?recent=1` per source (11, 14) | Recently added albums, newest first, at most 200 per source |
| TD-FAV | `/library/v1/Albums?category=FAVOURITES` (12) | Favourite albums of the library; USB has none |
| TD-QCD | Quality lists (13, 15) | Albums in CD quality per section (only counted through the requests) |
| TD-DEC | Decade index per source (mock: counted from TD-YEARS) | Decades of `/ui/browseGrouped` with `sort=decade` (keys like `1980`), union of the sources, sorted; chip label "80s" (full decade when two share the short form) |
| TD-YEARS | `/library/v1/Albums` per filled section without a filter (13; mock: section A of the library, `USB_YEARS` in USB section S) | Albums with a year (`date`) of every source as {title, year} |
| TD-PL | Saved playlists (16) | Saved playlists with play URL (`/Load…`) |
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
| TD-SETVAL | — | Values the test sets itself: prompt answer for saving the queue (`__blualbum_test_list__`), search terms of SRH-03 (length below / at `SEARCH_MIN`), a GitHub release tag higher than `APP.version`, a second track artist, error answers and delays of the mock |

## 4. Test blocks

### 4.1 Connection & start (CON)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| CON-01 | Start page without stored IP | Open the app, no `ip` in localStorage | Settings panel open, IP field empty with placeholder, help text visible, status line asks to connect; no request to the player | read | Auto |
| CON-02 | Stored IP is restored | localStorage `ip` = TD-IP, open the app | IP field contains TD-IP, panel open; no automatic connect | read | Auto |
| CON-03 | Connect with the button | Enter TD-IP, click **Connect** | `/Browse` (top menu), sources opened, chips built, default view loaded; `ip` stored; panel closed | read | Auto |
| CON-04 | Connect with Enter | Enter TD-IP, press Enter in the IP field | Same as CON-03 | read | Auto |
| CON-05 | IP input is normalised | Enter `http://<TD-IP>:11000/x` | Field shows only TD-IP; requests go to `http://<TD-IP>:11000` | read | Auto |
| CON-06 | Empty IP | Clear the field, click Connect | Error "Please enter the IP address of your player."; panel stays open, IP field focused; no request | read | Auto |
| CON-07 | Player not reachable | Mock aborts every request | Status line shows the LAN permission message (`LAN_MSG`); popup "Connecting to the player did not succeed" with the `/Browse` request, status "No answer – …" and `LAN_MSG` as answer; IP form and help text stay visible; panel open | read | Auto |
| CON-08 | No music source | Top menu without library / USB links | Error "No USB or library source found …"; panel open | – | Auto |
| CON-09 | Compact connection line | After CON-03, open the panel | Line with room name (TD-SET `zonename`) and TD-IP; IP form hidden | read | Auto |
| CON-10 | Change the player | Click **Change** in the connection line | IP form visible, IP field focused and selected | read | Auto |
| CON-11 | Room name as tab title | After CON-03 | `document.title` = room name of TD-SET (fallback: `displayName` of the player menu group, then "BluAlbum") | read | Auto |
| CON-12 | Changing the player forgets the previous one | Connect, start a slow All, pin the queue, connect to a second mock player (`IP2`) | Chips, grid, queue, search field, statistics, playlists and listening mode are reset; no results of the first connection appear | – | Auto |
| CON-13 | Player does not answer | Mock holds the top menu `/Browse` longer than `CONNECT_TIMEOUT` (5 s) | After about 5 s: status line `NO_REPLY_MSG`; popup "Connecting to the player did not succeed" with the `/Browse` request, status "No answer – timed out after 5 s" and `NO_REPLY_MSG` as answer; IP form visible, panel open | – | Auto |
| CON-14 | Timeout of the previous IP | Connect to a player that does not answer, then at once to a second mock player (`IP2`) | The second player's default view stays after the first one's time limit; no error popup; connection line shows `IP2` | – | Auto |

### 4.2 Music sources (SRC)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| SRC-01 | One switch per source | Connect with TD-TOP (library + USB) | Settings list one row per source of TD-SRC, named as the player names them, all switched on | read | Auto |
| SRC-02 | Without USB drive | Option `usb: false` | Only the library row | – | Auto |
| SRC-03 | Switch a source off | Switch USB off | Chips rebuilt from the remaining source; New contains no album of TD-NEW (USB); default view loads again | read | Auto |
| SRC-04 | Switch state is stored per player | Switch USB off, reload, connect again | USB still off (`srcoff:<player URL>`); a different player IP starts with all sources on | – | Auto |
| SRC-05 | All sources off | Switch every source off | Status line "No music source enabled …"; no genre chips; playlist chips stay | read | Auto |
| SRC-06 | Two sources with the same name | Top menu with two USB links of the same name | Rows show name plus key, e.g. "USB (<key>)" | – | Auto |

### 4.3 Chips & views (CHP)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| CHP-01 | Chip row | Connect (quality and genre chips switched on, as in most tests) | Order: All, Favourites (heart icon), New, HD, CD, MQA, separator, genres of TD-GEN sorted A–Z, separator, playlists of TD-PL (decade chips off by default) | read | Auto |
| CHP-02 | Default view Favourites | Connect | Favourites chip pressed; tiles = albums of TD-FAV (count and titles); request `/library/v1/Albums?…category=FAVOURITES` per source | read | Auto |
| CHP-03 | No favourites | Fixture 12 without albums | Status line "No favourite albums yet." | – | Auto |
| CHP-04 | New | Click **New** | Tiles = TD-NEW library albums (newest first) followed by the USB albums; status "N albums recently added, newest first"; at most 200 per source | read | Auto |
| CHP-05 | Quality CD | Click **CD** | One request per filled section of TD-SEC per source (`quality=cd&limit=500&section=…`), at most 6 in parallel; tiles = TD-QCD joined A–Z; status "… in CD quality" | read | Auto |
| CHP-06 | Quality HD / MQA | Click **HD**, then **MQA** | Filter `quality=hr` / `quality=mqa`; empty result: "No HD albums." / "No MQA albums." | – | Auto |
| CHP-07 | Quality result is cached | CD, All, CD again | Second CD click sends no quality request; sections asked once per source and shared with All | read | Auto |
| CHP-08 | All | Click **All** | Albums of every filled section of every source, 3 sections in parallel, progress "Loading all albums … n/N"; with two sources sorted A–Z; status "N albums" | read | Auto |
| CHP-09 | Genre | Click a genre of TD-GEN | Genre menu → sections → albums of the filled sections, all sources joined; status "N albums" | read | Auto |
| CHP-10 | Genre only on one source | Click a genre that exists only on the library | Albums of that source only; no request for the other source | read | Auto |
| CHP-11 | Views are cached in the session | Genre, All, genre again | Second genre click sends no request | read | Auto |
| CHP-12 | Outdated result is dropped | Click All, click New before All has finished | Grid and status line show New; the late All result does not replace it; All loading stops | – | Auto |
| CHP-13 | Selecting a chip clears the search | Search, then click a chip | Search field empty, chip pressed, its view shown | read | Auto |
| CHP-14 | Loading error | Mock answers HTTP 500 for the view | Status line "Loading failed: Player responded with 500" in red; popup "Loading the albums did not succeed" with request, HTTP 500 and the answer | – | Auto |
| CHP-15 | Default chip switches | Fresh profile (app defaults), connect, open the settings | Quality, Decades, Genres off, Playlists on; visible chips: All, Favourites, New, playlists of TD-PL; no `/ui/browseGrouped` request | read | Auto |
| CHP-16 | Decade chips switched on | Switch "Decade chips" on | One request per source with album sections (`/ui/browseGrouped…url=…sort=decade`); chips of TD-DEC behind a separator after the quality chips, tooltip "Albums from the 1980s"; no album request yet; switched off → hidden; stored, built again after reload + connect | read | Auto |
| CHP-17 | Decade | Decade chips on, click the first decade of TD-DEC, then the last | One request per filled section of TD-SEC per source (`limit=500&section=…`, no filter), at most 6 in parallel; tiles = TD-YEARS of that decade; status "N albums from the 1980s"; second decade sends no request | read | Auto |

### 4.4 Album grid (GRD)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| GRD-01 | Tile content | Any view | Per album: cover, title, artist (button "Albums by <artist>"); cover and title open the popup | read | Auto |
| GRD-02 | Random album tile | Any view with albums | First tile "Random album", "from N albums" (N = albums of the view), dice icon, no popup on click | read | Auto |
| GRD-03 | Random album: play | Hover the random tile, click play | `/Add?playnow=1…` of one album of the current view; toast "Playing: <title> – <artist>" | write | Auto |
| GRD-04 | Random album: add last | Click the add button of the random tile | `addAll-last` URL of one album of the view (`where=last`); toast "Added to queue: …"; album without that URL: toast "Could not add …" | write | Auto |
| GRD-05 | No random tile for search results and empty lists | Search; empty view | No random tile | – | Auto |
| GRD-06 | Lazy rendering | View with more than 60 albums | Tiles added in batches of 60 when the end comes near; never everything at once | read | Auto |
| GRD-07 | Hover buttons | Hover a library tile | Play, add last and heart visible | read | Auto |
| GRD-08 | Play an album | Click play on a tile | The album's play URL (from `/Browse` or `libAlbum()`); toast "Playing: <title>" | write | Auto |
| GRD-09 | Add an album last | Click add on a tile | `addAll-last` URL with `where=last`; toast "Added to queue: <title>" | write | Auto |
| GRD-10 | Long title and artist | Mock favourites with a title and an artist longer than a tile; hover the tile, leave it; again with reduced motion | Title and artist one line each, cut lines fade out (`.cut`), short lines not cut; hover (after 300 ms) scrolls both cut lines, leaving stops it; reduced motion: no scrolling, full text as tooltip | – | Auto |

### 4.5 Favourites (FAV)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| FAV-01 | Favourite shows a filled heart | Favourites view, hover the first tile | Heart `aria-pressed=true`, label "Remove from favourites: <title>" | read | Auto |
| FAV-02 | Remove a favourite | Click the filled heart | `/DeleteFavourite?…` sent; toast "Removed from favourites"; heart empty; context menu read again without `isFavourite=1` | write | Auto |
| FAV-03 | Add a favourite | Library album that is no favourite (e.g. from TD-ALL), click the empty heart | `/AddFavourite?…`; toast "Added to favourites"; heart filled; context menu read again with `isFavourite=1` | write | Auto |
| FAV-04 | USB album has no heart | New view, hover TD-ALB-USB | Heart hidden | read | Auto |
| FAV-05 | Failed toggle | Mock answers HTTP 500 for `/DeleteFavourite` | Popup "The player command did not succeed" with the `/DeleteFavourite` request; heart unchanged | – | Auto |
| FAV-06 | No local favourites | After FAV-02 / FAV-03 | No `fav:` key in localStorage | write | Auto |

### 4.6 Artist view (ART)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| ART-01 | Albums of an artist | Favourites view, click the artist of TD-ART | Status "N albums by <artist>"; tiles = albums of TD-ART from every source; per source: artist menu + albums link (2 `/Browse`); the All list is not loaded; play and add URLs from the player | read | Auto |
| ART-02 | Favourite state in the artist view | Same as ART-01 | Favourites of the library asked once; context menu read only for TD-FAV-ART (`&isFavourite=1`); those hearts filled, the others empty; remove URL from the player | read | Auto |
| ART-03 | Artist view from the popup | Open an album popup, click the artist link | Popup closes, artist view as ART-01, page scrolled to the top | read | Auto |
| ART-04 | Artist view is cached | Artist, another chip, same artist again | No `/Browse` request the second time | read | Auto |

### 4.7 Album popup (POP)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| POP-01 | Open from the cover or the title | Click the cover of TD-ALB-LIB; close; click its title | Popup with cover, title, artist link, source line (icon of the player from the `image` of TD-SRC, inverted in the light design, + source name of TD-SRC); "Loading tracks …" until the tracks arrive | – | Auto |
| POP-02 | Track list | Popup of TD-ALB-LIB | One row per track of TD-TRK: number without dot in its own column, some space, title, duration m:ss; no summary line above the tracks, no disc header; total time of TD-TRK in the album details (`#dlen`); request `/Browse` with `withContextMenuItems=0` | read | Auto |
| POP-03 | No action buttons, no genre line | Popup open | No play / queue / heart button; no genre line | read | Auto |
| POP-04 | Year | Popup of TD-ALB-LIB | Year = `date` of TD-SONGS on the artist line ("Artist · year"); different years shown as range "first–last" | read (part) | Auto |
| POP-05 | Quality tag and technical data (lossless) | Popup of TD-ALB-LIB | Tag from `quality` (cd → CD, hd/hr → HD, mqa → MQA, dolby → Dolby) before the data line "<format> · <bits> bit / <kHz> kHz · <Mono/Stereo/n ch> · Ø <avg bitrate> kbit/s", all computed from TD-SONGS | read | Auto |
| POP-06 | Lossy album (MP3) | Popup of TD-ALB-USB | Tag "MP3"; data line without bit depth | read | Auto |
| POP-07 | Mixed album | Songs with two formats / sample rates | Formats joined with " / ", ranges for bits and kHz, one tag per quality | – | Auto |
| POP-08 | Track artist | Mock state `songArtists`: one track of TD-SONGS gets another artist | That track shows the artist below its title; all others none (song and track matched by position) | – | Auto |
| POP-16 | Multi-disc album | Mock state `discs`: TD-TRK split into disc 1 (first half) and disc 2, numbers start again at 1 per disc (like Bruno E32) | Header "Disc N" (shown in capitals) before the tracks of each disc; numbers as in TD-TRK per disc; album details "2 discs · total time"; a click on the first track of disc 2 plays it | – | Auto |
| POP-17 | Multi-disc album numbered across the discs | Like POP-16, mock state `discRunOn`: numbers run on over both discs | Disc 2 header before the first song with `discno` 2; numbers run on | – | Auto |
| POP-18 | Same title on two discs | Like POP-16; the first track of disc 2 gets the title of track 1 and another artist | Artist shown only on the first track of disc 2 (song of the same position) | – | Auto |
| POP-09 | Play a track | Click a track row | Its `autoplayURL` (else `playURL`) sent; toast "Track started" | write | Auto |
| POP-10 | Popup cache | Open, close, open the same album | No second `/Browse` / `/library/v1/Songs` request | read | Auto |
| POP-11 | Browser in another language | Option `locale: de-DE` | Track list still filled (requests send `Accept-Language: en`) | read | Auto |
| POP-12 | Close the popup | Close button; click on the backdrop; Esc | Popup closed each time; Esc does not close the settings panel behind it | read | Auto |
| POP-14 | Page behind stays still | Page scrollable; popup open; mouse wheel over the backdrop and over the track list (also past its end) | Only the popup content scrolls; the page keeps its scroll position; after closing the page scrolls again | – | Auto |
| POP-15 | Full-size cover | Open the popup of TD-ALB-LIB | Cover asked with `&width=3000&height=3000&followRedirects=1` (`COVER_FULL`); grid covers without a size | read | Auto |
| POP-13 | Track list fails | Mock answers HTTP 500 for the album's `/Browse` | Empty list, popup "Loading the tracks did not succeed" with the `/Browse` request; songs missing (`/library/v1/Songs` fails) → popup "Loading the album details did not succeed", no year / technical data, tracks still shown | – | Auto |

### 4.8 Search (SRH)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| SRH-01 | Search with Enter | Type a term, press Enter | `/Browse?key=<searchKey>&q=<term>` per source; albums link of TD-SEARCH followed; tiles = albums; status "N albums for “<term>”"; no chip pressed; no random tile | read | Auto |
| SRH-02 | One album request per search | Same as SRH-01 | Albums list read once per source (no second request for the same list) | – | Auto |
| SRH-03 | Search only from `SEARCH_MIN` characters | Type fewer than `SEARCH_MIN` characters; then reach `SEARCH_MIN`; wait less / more than `SEARCH_DELAY`; Enter with fewer characters, then with `SEARCH_MIN` | No search below `SEARCH_MIN`, also not with Enter (hint "Type at least 3 characters to search."); while typing one search after the pause; Enter searches at once from `SEARCH_MIN` | read | Auto |
| SRH-04 | Empty field restores the view | Search, then clear the field | Previous chip pressed again, its albums shown, status "N albums"; no request | read | Auto |
| SRH-05 | Sectioned search result | Albums link answers with sections | Albums of every filled section | – | Auto |
| SRH-06 | Direct album items | Search answer contains album items | These albums shown without following a link | – | Auto |
| SRH-07 | Only the newest search counts | Two searches quickly after each other, the first answers late | Grid shows the second result | – | Auto |
| SRH-08 | Search error / not possible | Mock fails the search; source without `searchKey` | "Search failed: …" in red and popup "The search did not succeed" with the search request; without search key: "Connect first – or the player offers no search." | – | Auto |
| SRH-09 | Albums of the composers found | Search answer with a composers list (2 pages, 2 composers); the albums of both composers overlap with each other and with the albums list | Composers list followed over its pages; per composer its browse menu and its albums link read; tiles = albums of the albums list plus the composers' albums, each album once per source, A–Z by title; status counts them | – | Auto |

### 4.9 Player footer (FTR)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| FTR-01 | Now playing | Connect, TD-STATUS playing | Line 1 = `title1` (else `name`), line 2 = `title2 – title3`; cover from `image` | read | Auto |
| FTR-02 | Quality tag | TD-STATUS with `quality` cd / hd / hr / mqa / dolby, `streamFormat` MP3 | Tag CD / HD / HD / MQA / Dolby / MP3 (MP3 wins); tooltip = `streamFormat`; no tag for other values | – | Auto |
| FTR-03 | No source icon | Footer | No USB / library icon in the player bar | read | Auto |
| FTR-04 | Nothing playing | Mock `playing: false` | Line 1 "Nothing playing", line 2 empty, no cover, no quality tag; full screen cannot open | – | Auto |
| FTR-05 | Play / pause | Click play/pause | `/Pause?toggle=1`; icon follows the returned `state` (SVG, play ≠ pause icon) | write | Auto |
| FTR-06 | Previous / next | Click previous, next | `/Back`, `/Skip`; new track arrives through long polling | write | Auto |
| FTR-07 | Progress strip | TD-STATUS with `secs`, `totlen` | Strip width = secs / totlen, advancing while playing (4× per second), standing while paused; `aria-valuenow` / `aria-valuemax` | – | Auto |
| FTR-08 | Seek by click | `canSeek` = 1, click in the strip | `/Play?seek=<seconds at the click position>` (limited to 0 … totlen − 1) | write | Auto |
| FTR-09 | Seek by keyboard | Focus the strip, ArrowRight / ArrowLeft | Seek +5 s / −5 s | write | Auto |
| FTR-10 | Seek not possible | `canSeek` = 0 | No seek request; `aria-disabled=true` | – | Auto |
| FTR-11 | Position tooltip | Move the pointer over the strip | Tooltip "m:ss / m:ss" (position under the pointer / total) | read | Auto |
| FTR-12 | Volume slider | Drag the slider | `/Volume?level=<value>` at most every 150 ms while dragging and once on release; slider not overwritten by status while dragging | write | Auto |
| FTR-13 | Volume buttons | Click volume down / up | `/Volume?db=-2` / `/Volume?db=2`; slider follows the answer | write | Auto |
| FTR-14 | Fixed volume | `<volume>-1</volume>` in status | Slider and both buttons disabled | – | Auto |
| FTR-15 | Listening mode icon | TD-LM | Icon = `iconActive` of the current mode (blob URL, inverted in the light design), alt text = its `displayName`, tooltip = setting `displayName`: mode `displayName`; right before volume down; grey (dimmed) in a frame with square corners in the line colour, so it is not taken for a button; on hover icon and frame brighten (frame in the text colour), no button effect; display only | read | Auto |
| FTR-16 | Listening mode follows syncStat | Change the mode in the mock and raise `syncStat` | `/audioPreset` read once on connect and again only after the change; icon shows the new mode; no command sent | – | Auto |
| FTR-17 | Player without listening modes | Option `listeningModes: false` (404) | Icon and its frame hidden, no image; no error popup; no JavaScript error | – | Auto |
| FTR-18 | Long polling | Connect; mock answers with an error once | `/Status?timeout=100`, then with `&etag=` of the last answer; at least 1 s between requests, 5 s after an error; no one-off `/Status` / `/Volume` | – | Auto |

### 4.10 Full screen (FUL)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| FUL-01 | Open from the footer cover | Something playing, click the footer cover | Full-screen view with cover and `title1` / `title2` / `title3` of TD-STATUS; cover not requested again | read | Auto |
| FUL-02 | Footer only at the bottom edge | Full screen open, pointer in the middle, then at the bottom edge, then over the footer | Footer hidden; shown at the last 4 px; stays while the pointer is over it; hidden when the pointer leaves the window | read | Auto |
| FUL-03 | Close | Esc; click anywhere in the view; click the footer cover again | Closed each time | read | Auto |
| FUL-04 | Keyboard | Focus the footer cover, Enter / Space | Opens / closes the view; label changes "Show / Close full-screen player" | read | Auto |
| FUL-05 | Playback stops | Full screen open, status without title | View closes by itself; cannot be opened while nothing plays | – | Auto |
| FUL-06 | Background from the cover | Something playing (mock cover with one colour); new cover while the view is open; cover fails (`/Artwork` 404) | Ambient colour `--amb` = colour of the cover, view background is a gradient of it mixed with the theme background; follows the new cover; without a readable cover (also covers of other hosts, e.g. radio) no colour, plain theme background | – | Auto |
| FUL-07 | Full-size cover | Something playing (TD-STATUS) | Cover asked with `&width=3000&height=3000&followRedirects=1` (`COVER_FULL`), one request for the footer and the full screen | read | Auto |
| FUL-08 | Year next to the album | Something playing from the queue (TD-STATUS `song`), open the view; close and open again; new track while open (mock: `song` 2 with year 1999); stream outside the queue (`streamUrl`) | Album line "`title3` · year", year = `<date>` of `/Playlist?start=<song>&end=<song>`; not read while the view is closed, once per track; follows the new track; no year for a stream | read | Auto |

### 4.11 Queue panel (QUE)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| QUE-01 | Pin the panel | Click the queue button | Panel open, button label "Unpin queue", `qpin=1` stored; `/Playlist?start=0&end=199` | read | Auto |
| QUE-02 | Pinned panel survives reload | Pin, reload | Panel open again and loaded | read | Auto |
| QUE-03 | Pinned panel stays open | Click outside the panel | Panel stays open; on wide windows the grid moves aside | read | Auto |
| QUE-04 | Queue list | Panel open | One row per song of TD-QUEUE: number (id + 1), title, "artist – album", duration m:ss when `time` > 0; footer "N tracks" and total time | read | Auto |
| QUE-05 | Current track | TD-STATUS `song` | Matching row highlighted and scrolled into view | read | Auto |
| QUE-06 | Play a queue entry | Click a row | `/Play?id=<id>` | write | Auto |
| QUE-07 | Remove button | Hover a row, click ✕ | ✕ replaces the duration of that row only; `/Delete?id=<id>` | write | Auto |
| QUE-08 | Queue reloads once after a change | Remove, shuffle, clear | Exactly one `/Playlist` load per change, triggered by the new `pid` in `/Status` | write | Auto |
| QUE-09 | Shuffle | Click shuffle twice | `/Shuffle?state=1`, then `0`; button follows `<shuffle>` of `/Status`; toast "Shuffle on / off" | write | Auto |
| QUE-10 | Repeat | Click repeat three times | off → queue → track → off; `/Repeat?state=0`, `1`, `2`; label "Repeat: …", pressed unless off | write | Auto |
| QUE-11 | Save as playlist | Click save, answer the prompt with TD-SETVAL | Prompt default "Queue YYYY-MM-DD HH:MM"; `/Save?name=<answer>`; toast "Saved playlist “<name>” (N tracks)"; playlist chips reloaded | write | Auto |
| QUE-12 | Save cancelled / failed | Cancel the prompt; mock answers `<saved><entries>0</entries></saved>` | Cancel: no request; failure: popup "Saving the playlist did not succeed" with request, status and raw answer | read (part) | Auto |
| QUE-13 | Delete the loaded playlist | Load a playlist of TD-PL (chip), confirm delete | Delete button visible only for a queue from a saved playlist; confirm text names it; `/Delete?service=BluOS&name=<name>`; toast; button hidden; chips reloaded | write | Auto |
| QUE-14 | Delete cancelled / failed | Cancel the confirm; mock answers with `<error>` | Cancel: no request; failure: popup "Deleting the playlist did not succeed" | write (part) | Auto |
| QUE-15 | Clear the queue | Click clear, confirm / cancel | Confirm: `/Clear`; cancel: nothing sent | write | Auto |
| QUE-16 | Empty queue, long queue, error | Empty `/Playlist`; more than 200 songs; HTTP 500 | Empty: save, clear, shuffle, repeat disabled, no count; long: loaded in pages of 200, at most 2000; error: "Could not load queue" and popup "Loading the queue did not succeed" with the `/Playlist` request | – | Auto |

### 4.12 Playlist chips (PLS)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| PLS-01 | Chips for saved playlists | Connect | One chip per playlist of TD-PL with icon and name, after a separator at the end of the row; tooltip "Play playlist “<name>”" | read | Auto |
| PLS-02 | Play a playlist | Click a playlist chip | Its play URL (`/Load…` or the "play" action of the context menu); toast "Playing playlist: <name>"; open queue reloaded after 1.5 s if the playlist id did not change | write (part) | Auto |
| PLS-03 | Player without playlists | Top menu without the playlists link | No playlist chips, no separator; statistics without "Playlists" | – | Auto |
| PLS-04 | Chips survive a source change | Switch a source off and on | Playlist chips again at the end of the row | read | Auto |
| PLS-05 | Paging | Playlists answer with `nextKey` | All pages read (at most 20) | – | Auto |

### 4.13 Settings panel (SET)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| SET-01 | Open and close | Menu button opens; back button, click on the scrim, Esc close | Opens / closes; `aria-expanded` follows; Esc with an open popup closes only the popup (POP-12) | read | Auto |
| SET-02 | Chip switches | Section "Filter chips" (Quality, Decades, Genres, Playlists, in the order of the chip row): switch genre, quality and playlist chips off; decade chips on and off (CHP-16) | Only All, Favourites, New visible; switched on again → chips back; decade chips hidden when switched off | read | Auto |
| SET-03 | Switches are stored | After SET-02 / CHP-16, reload | Switches keep their state (decade chips on → built again after connecting) | read | Auto |
| SET-04 | Cover size | Select S, M, L | Tile width and spacing between tiles S < M < L, more space between rows than columns; stored as `tile`; pressed segment follows | read | Auto |
| SET-05 | Design | Day, Night, System with light / dark system scheme | Background light / dark accordingly; stored as `theme` | read | Auto |
| SET-06 | Stored size and design are restored | Set L and Night, reload | L and Night active before connecting | read | Auto |
| SET-07 | Invalid stored values | localStorage `theme=x`, `tile=x` | System design and size M | read | Auto |
| SET-08 | Library settings | Connect with TD-SET | Section "Music Library Settings": network shares (description, "None" when empty), "Optimize artwork" and "Server mode" as On / Off; rows without a value left out | read (part) | Auto |
| SET-09 | Version in the panel footer | Open the panel | "About" button with "v" + `APP.version` | read | Auto |

### 4.14 About popup (ABT)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| ABT-01 | Content | Open About | App name, "Version v<APP.version>", copyright line, GitHub link (`APP.repo`, new tab), independence notice, player rows: room, BluOS version and API version of TD-VER | read | Auto |
| ABT-02 | Statistics loaded on opening, once | Open About twice | No versions / statistics before opening; then `/GitVersion`, `/Version` and four section lists per source; none on the second opening | read | Auto |
| ABT-03 | Statistic values | Open About | Albums = sum of the section counts (TD-SEC) of all sources; Artists / Songs / Composers summed per source; Genres = number of TD-GEN names; Playlists = number of TD-PL; "…" while loading, "–" when not available | read (part) | Auto |
| ABT-04 | Statistics reload after a source change | Open About, switch a source off, open again | Statistics loaded again for the new selection | read | Auto |
| ABT-05 | Update check | Click "Check for updates" with a newer tag, the same version, HTTP 403 | No GitHub request before the click; one request to the latest release; "Update available: <tag>" with link (new tab) / "You have the latest version." / "Update check failed (HTTP 403)."; button disabled while checking | read | Auto |
| ABT-06 | Update check without network / without tag | GitHub request fails; answer without `tag_name` | "Update check failed (…)." | read | Auto |

### 4.15 Error handling (ERR)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| ERR-01 | Failed command | Mock answers HTTP 500 for `/Add` (tile play) | Popup "The player command did not succeed" with request (without host), HTTP 500 and the answer; no other change | – | Auto |
| ERR-02 | Command before connecting | Not connected, click play/pause or save the queue | Toast "Connect first"; no request | read | Auto |
| ERR-03 | Player error answer | Mock answers `<e><message>…</message></e>` | Treated as failure: the player's message in the status line, the raw `<e>` answer (HTTP 200) in the popup; also for commands (`/Shuffle`) | – | Auto |
| ERR-04 | Popup for unsuccessful answers | See QUE-12 / QUE-14 | Title, request path without host, HTTP status, raw body ("(empty response)" when empty); close button not focused | – | Auto |
| ERR-05 | English answers | Any request | Header `Accept-Language: en` on every player request except the images (covers `/Artwork` and source icons `/images/…`, read with a plain `fetch()`) | read | Auto |
| ERR-06 | No genres | Genre lists empty | Error "No genres found. Has the library finished indexing?"; panel open | – | Auto |
| ERR-07 | Every failed player request is shown | See CON-07, CON-13, CHP-14, FAV-05, POP-13, SRH-08, QUE-16, ERR-01, ERR-03 | Popup with a title per action, request path without host, status (HTTP status or "No answer – …") and raw answer; status line messages stay | – | Auto |
| ERR-08 | Expected failures are not shown | Player without listening modes (FTR-17); statistic list not available (ABT-03); missing cover (SEC-03); aborted or failed status polling (FTR long polling) | No error popup | – | Auto |

### 4.16 Security & robustness (SEC)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| SEC-01 | Image URLs | `imgUrl()` with a player path, `/Artwork` path, https URL, protocol-relative URL, `javascript:`, `data:`, empty | Player path → player URL (`/Artwork` + `followRedirects=1`); https kept; everything else "" | read | Auto |
| SEC-02 | Covers as blob URLs | Grid, popup and footer covers | Read with `fetch()` and shown as `blob:` (works in Firefox on `file://`); now playing cover requested once for footer and full screen | read | Auto |
| SEC-03 | Broken cover | `/Artwork` answers HTTP 404 | Grid: image removed, tile stays; footer: cover hidden | – | Auto |
| SEC-04 | Blocked storage | localStorage throws (private mode) | App works; conveniences are not kept | read | Auto |
| SEC-05 | Old stored values removed | localStorage with `fav:…`, `src:…`, `genres:…` | Keys removed on start | read | Auto |

### 4.17 Layout & accessibility (LAY)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| LAY-01 | Readable titles, no horizontal scrolling | Every cover size in every design; Day and Night with pinned queue and open popup | Contrast ≥ 4.5 (WCAG AA) of album titles, now playing title, queue titles, popup title and tracks; no horizontal scrolling | read | Auto |
| LAY-02 | Keyboard and screen reader labels | Queue pinned; all visible controls; Tab on the chip row | Every control has a name (`aria-label`, text, title or label); chips have `aria-pressed`, switches `aria-checked`, menu and queue button `aria-expanded`; Tab moves to the next chip (Safari: Option-Tab, its default for buttons) | read | Auto |
| LAY-03 | Favicon | Open the app (no connection) | `link rel="icon"` is an embedded SVG (`data:` URI, no request): double note knocked out of a circle, dark in light mode and cream in dark mode (`prefers-color-scheme`); the image loads; the tab shows it in Chrome, Edge and Firefox (Safari shows no favicon for `file://` pages) | read | Auto |

### 4.18 Regression & session (REG)

| ID | Test case | Input | Expected output | Real player | Status |
|---|---|---|---|---|---|
| REG-01 | No playback on page load | Connect, wait | No `/Add`, `/Play` or `/Load` command | read | Auto |
| REG-02 | Request budget of the first view | Connect, wait | No genre crawl, no statistics, no version requests, no one-off `/Status` / `/Volume`; long polling and `/Settings` run | read | Auto |
| REG-03 | Full session without JavaScript errors | Click All, New, CD and a genre of TD-GEN | No page error | read | Auto |

## 5. Options considered for the real player (ENV-4)

Goal: the same browsers as ENV-1 talk to the owner's player instead of the mock, to find what the mock cannot show (a firmware that answers differently, a library that grew, timing of a real player). Common conditions for every option:

- **Read-only by default.** Tests that change the player (play, queue, favourites, playlists, volume, shuffle / repeat) run only with an explicit switch and restore the previous state (save and reload the queue, toggle a favourite twice, set the volume back).
- **No personal data in the repository**: player IP from the command line or the Bruno environment "Home" (git-ignored values), answers of the player only in git-ignored folders.
- **Local network permission**: on macOS the terminal (or Node) needs the "Local Network" permission so that Playwright's browsers reach the player.
- Not in GitHub Actions: the runners cannot reach the home network.

| Option | How it works | Expected values | Effort | Pros | Cons |
|---|---|---|---|---|---|
| A. Real-player mode of `run.js` | `node run.js --player <ip>`: no `page.route` for the player, the app talks to the real player; each test is marked `real: "read"`, `"write"` or `false` (mock only, e.g. error answers, generated queues); `--write` enables the write tests | Built live: before the run, `run.js` reads the same endpoints from the player (Node `fetch`) and builds `TD` from these answers instead of the fixtures | Medium: `TD` from a source function, marks per test, restore steps for write tests | One set of tests and test cases for mock and real player; checks the real answers and the real timing | Request-count assertions need the app's own requests (Playwright `page.on("request")` instead of the mock's log); error cases stay mock only |
| B. Pass-through proxy | The mock forwards every request to the real player (`route.fetch()`), records it like now and returns the real answer; overrides still work on top | Live, as in A, from the answers the proxy sees | Medium | All request assertions keep working; error injection on top of real answers possible | Two moving parts (proxy + player); write tests still need restore steps |
| C. Record, then run against the mock | Bruno folder "1 Read" with `saveFixtures = true`, sanitize, then `npm test` (the existing workflow after a firmware update) | From the fresh fixtures (already the case) | None (in place) | Safe, repeatable, no changes to the player | Not a live test: finds differences only in the recorded answers, not in timing or commands |
| D. Separate smoke test | A small script (e.g. `tests/ui/real-player.js`) with a few read-only flows: connect, favourites, All count = sum of the sections, popup of an album, search, about statistics | Live from the player's answers | Low | Quick to build, no change to `run.js` | A second set of tests that drifts away from the test plan |
| E. Real Safari app via WebDriver | `safaridriver` (built into macOS, enabled with `safaridriver --enable`) driven by a WebDriver client; combinable with A or D | As in A / D | Medium | The real Safari app instead of WebKit: covers the Safari pitfalls | Another test tool next to Playwright; one session at a time |

Decision (2026-11-17): **A**, built as described in section 3.3; **C** stays the routine after firmware updates. E can follow later if the Safari app (ENV-5) keeps showing problems that WebKit does not.

## 6. Keeping the plan and the tests in step

- A new or changed function of the app gets a test case here and a UI test whose name starts with its ID.
- A new test gets a mark `real: "read"` or `"write"` when it can run against the real player, otherwise it stays mock only; the column "Real player" follows from `node run.js --list`.
- The UI tests derive their expected values from the player's answers (section 3.4); after recording new fixtures, run `npm test` in `tests/ui` without changing `run.js`.
