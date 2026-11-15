# BluAlbum – notes for Claude

## Project
- BluAlbum: single-file app (`blualbum.html`) that browses the **albums of the music library** of a BluOS player and controls playback
- Motivation is to provide an alternative to the vendor app "BluOS Controller" 
  - uses a time-consuming and visually unattractive way of finding and selecting locally stored music via hierarchical browsing
- Talks directly to the BluOS Custom Integration API: HTTP GET on port 11000, XML answers. 
- expects music library to be tagged and with cover art
- minimalistic design - less is more, only show relevant information, but in an appealing way
- No build step, no dependencies
- Opened locally in a Web browser (file) - optional server hosting if users have an HTTP server
- Owner: Ingmar Gebert. MIT licence. Repository: `blu-album`.
- Independent project, not affiliated with Lenbrook / Bluesound (notice in README, file header and about popup – keep it).
- Owner's test setup: Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share plus a USB drive. Main browser: Safari on macOS; Chrome as second browser.

## Scope
Focus: music albums of the locally stored music library. 
Other player features and settings stay in the BluOS Controller app.

Out of scope (do not build, suggest the alternative):
- Streaming services - already have good support from native apps "Connect" option
- Radio - not following album concept
- Inputs – not following the album concept
- Presets – not following the album concept
- Mute / unmute button – use pause instead
- Artist browser – use search instead, browsing visually not attractive due to missing pictures
- Composer browser – use search instead, browsing visually not attractive due to missing pictures
- Song browser – use search instead, with any meaningful local library there will be too many songs to browse
- Folder browser – not compatible with main requirement of BluAlbum of a tagged music library

## Rules
- **One file.** No extra files (favicon, logo, fonts, libraries). Icons are inline SVG constants.
- **API reference for development: `docs/bluos-api.md`.** Before using or changing a player request in the app, look up the endpoint there (parameters, answer format, verified or not); prefer verified endpoints. When the app needs an endpoint or variant that is missing or not verified, verify it with Bruno first and then add or update it in the reference.
- **No fallbacks: one implementation per feature.** Variants of an API call are checked first against the real player with the Bruno collection (`tests/api`, folder "1 Read", E requests); only the verified variant is implemented.
- **Favourites are managed by the player only**, never locally (no localStorage for favourites).
- **Values come from the API**, not hard-coded: source names, play / action URLs, quality, etc.
- UI language: English
- **project documents: English** (README, CHANGELOG, `docs/`, test READMEs, Bruno and code comments)
- **No default IP address** in the app.
- **Semantic versioning, set only for a GitHub release:** every delivered change of the app gets a line under `## Unreleased` at the top of `CHANGELOG.md`; `APP.version` stays as it is. **One short line per change**: what changed for the user, in about one sentence (e.g. "Fix: no album covers in Firefox."), no cause, no request counts, no implementation details – those belong in the commit message or `docs/`. Changes to the documentation (`docs/`, READMEs, CLAUDE.md) or only to the tests (`tests/`) get no CHANGELOG line. When the owner asks for a release, Claude calculates the version once from all collected changes (MINOR if any new feature, else PATCH; MAJOR only when the owner says so), sets it in `APP.version` (the only place; shown in the settings footer and the about popup), renames `Unreleased` to the version, then commits, tags `vX.Y.Z` (annotated, message "BluAlbum X.Y.Z") and creates the release with `blualbum.html` as download. The release notes list the CHANGELOG lines of that version word for word – no longer or reworded bullets.
- Do not publish anything (GitHub release, artifact, pages) without asking the owner first.
- Check layout changes in Safari as well (see "Known pitfalls").

## Code structure (`blualbum.html`)
- Order: `<style>` (colour tokens for light / dark / system at the top), HTML, `<script>`.
- The script starts with a module overview; modules in this order: Configuration, Helpers, State,
  Player API, Connection & sources, Albums from /Browse, Albums from /library/v1/Albums, Views,
  Album grid, Favourites, Popups, Playlists, Queue panel, Player footer & full screen, Search,
  Settings panel, Event wiring & start (all start-up code, runs once, in order).
- **State** only in the State module (`let`s); `resetPlayerState()` forgets everything of the
  previous player on connect, `resetLibrary()` everything of the source selection.
- **Requests** only through `api(path)` (parsed XML, throws on network / HTTP / `<e>` errors) and
  `apiRaw(path)` (`{ok, status, body}` for the popup that shows unsuccessful answers);
  `browse(key, q)`, `xml(path)` (toast on failure) and `cmd(url, label)` build on them.
- **Outdated async results** are dropped: `ctx()` (player + source selection), `activeKey`
  (current view) and counters `plSeq`, `qSeq`, `dlgSeq`, `searchSeq`, `lazyTok`.
- Settings switches / segments: `bindSwitch()`, `bindSegment()`; localStorage only for
  conveniences (IP, design, cover size, chip groups, pinned queue, disabled sources).
- Configuration constants: `APP`, `SVC_LIBRARY = "LocalMusic"`, `SVC_PLAYLISTS = "BluOS"`,
  `QUALITIES`, `FORMATS`, `LOSSY`, `REPEAT`, icons (`ICON_PLAY`, `ICON_PAUSE`, `ICON_PLAYLIST`,
  `ICON_USB`, `ICON_LIB`, `HEART`).

## BluOS API – verified with the player
Used endpoints:
- `/Browse?withContextMenuItems=1&key=…&q=…` – menus, album lists, genres, tracks of an album
  (`type="track"`, `duration`, `playURL`, `autoplayURL`), search. Album keys:
  `<svc>:MG/LocalMusic-Album?album=…&artist=…`, context menu `<svc>:CM/LocalMusic-Album?…`
  (with `&isFavourite=1` when it is a favourite). `withContextMenuItems=0` drops only the
  `contextMenu` children (album popup track list; Bruno E09). The album section list
  (`…bySection:Album…`) has the album count per section in `text2`; USB lists only filled sections.
- `/library/v1/Albums?service=<svc>&recent=1` (New), `&category=FAVOURITES` (Favourites),
  `&quality=hr|cd|mqa&limit=500&section=X` (quality filter; only with `section`; the app asks
  only the sections with albums; answer has `<album tracks date>`).
- `/library/v1/Songs?service=<svc>&album=…&artist=…` – songs of an album with `art`, `date`,
  `quality`, `time`, `fn` and attributes `atype`, `samplerate`, `samplebits`, `channels`,
  `bitrate` (works for library and USB).
- `/Status?timeout=100&etag=…` (long polling), `/Playlist?start=&end=` (queue),
  `/Playlists`, `/Add` (play / add album or track), `/Play?seek=|id=`, `/Pause?toggle=1`,
  `/Skip`, `/Back`, `/Volume?level=|db=±2`, `/Shuffle?state=0|1`, `/Repeat?state=0|1|2`
  (0 = queue, 1 = track, 2 = off), `/Save?name=` (`<saved><entries>N`), `/Load?service=BluOS&name=`,
  `/Clear`, `/AddFavourite`, `/DeleteFavourite`, `/Settings`, `/Services`, `/Version` (API
  version), `/GitVersion` (BluOS version), `/Artwork?service=…&album=…&artist=…`, `/audioPreset` (listening mode for the footer tag; read on connect and when `<syncStat>` of `/Status` changes – the mode itself is not in `/Status`, Bruno E23 / S44).

Outside the player (only on click): `https://api.github.com/repos/ogig33/blu-album/releases/latest`
(`tag_name`, `html_url`; CORS `*`, works from a local file) – update check in the about popup.

Pitfalls:
- `/Delete?id=N` removes a **queue track**; `/Delete?service=BluOS&name=…` deletes a **saved playlist**.
- USB albums have no favourite actions (no heart on USB covers).
- The artist albums list (`<svc>:Album/…Albums?artist=…`) does not mark favourites (Bruno E17); the artist view takes the state from the favourites list and the remove URL from the context menu with `&isFavourite=1`. Section, New, Favourites and quality lists do mark them.
- All albums of a genre without sections only via `/ui/browseGrouped` (30 per page, no add-to-queue URL, no favourite state); `/library/v1/Albums?genre=…` without `section` and the browse key `Album/…genre=…` answer empty (Bruno E14).
- Quality is `hd` in `/Status` but `hr` in the library filter; both are shown as "HD".
  MP3 files report their **bitrate** as `quality` – recognise MP3 by `atype` / `streamFormat`.
- Every request sends `Accept-Language: en` (`PLAYER_HEADERS` in `api()` / `apiRaw()`): with the browser's language, e.g. German, `/Browse` answers the track list of some albums with an empty menu (Bruno E25 / E26).
- Covers are read with `fetch()` and shown as blob URLs (`showImg()`): Firefox upgrades `<img src="http://…">` on a `file://` page to https (mixed content); `/Artwork` allows `fetch()` (`Access-Control-Allow-Origin: *`, Bruno E24).
- `/Playlists` names carry an `image` attribute: `<name image="…">X</name>`.
- `/Info?…` (album / track info) redirects to last.fm – not usable.
  `/Info?category=technical&filename=…` answered empty.
- The player offers **no genre per album** (not in `/Browse` album / context menu,
  `/library/v1/Songs`, `/library/v1/Albums`); the album popup has no genre line (decided
  2026-11-14, the former genre crawl cost ≈ 560 requests).
- `/Artists`, `/Albums`, `/Songs`, `/Genres`, `/Composers`, `/Folders` are only 302 redirects to
  `/library/v1/…` on port 11004. BluOS API reference (official v1.7 + unofficial endpoints, by
  category, with source tags): `docs/bluos-api.md`; BluAlbum's clicks, their requests and endpoint
  choices: `docs/blu-album-api-usage.md` (private, local only, not in git – see `.gitignore`).
- URLs for play / queue / favourites come from `/Browse`; only the `/library/v1` lists (New,
  Favourites, quality) build them by the fixed pattern in `libAlbum()` (decided 2026-11-14: no
  further self-built URLs).
- Bruno: URLs are built by the scripts with `encodeURIComponent`; `settings { encodeUrl: false }`
  avoids double encoding (HTTP 400).

## Known pitfalls
- Safari collapses a flex child with an indefinite height to 0 (happened with the popup track
  list) – avoid flex sizing for scrolling lists, use a max-height.
- Safari may keep an old version of the local file: reload without cache (⌥⌘R) before
  chasing a "bug".

## Tests
- `tests/api` – Bruno collection, environment "Home" (`host` = player IP, `saveFixtures`, `runManual`). Three folders, the whole collection is the suite to run after a firmware update: "1 Read (safe)" only reads (app requests A01–A27, album details and new variants E01–E21, E23–E26, reference endpoints V01–V47); "2 Write (changes the player)" sends every command of the app (C01–C47) and of the reference (W01–W15, S01–S47) and restores queue, position, volume, settings etc. afterwards; "3 Manual (run on purpose)" (M01–M21: doorbell, reindex, test preset, reboot, playlist restore, clear history, statistics, rebuild index, UpdateDNS) is skipped unless `runManual = true`. Fixtures go to `tests/api/fixtures/` (git-ignored, personal data).
- `tests/tools/sanitize-fixtures.js` – copies fixtures to `tests/ui/fixtures` without IPs,
  room name, share / mount paths and USB ids.
- `tests/ui` – Playwright tests (`npm test` in `tests/ui`) of the app against `mock-player.js`,
  which answers from the fixtures and records all commands. Runs in Chrome and Edge (installed
  apps, Playwright channels), Safari (Playwright WebKit) and Firefox (Playwright build);
  `--browser chrome|safari|edge|firefox`, `--viewport WxH[@scale]` (default 1200x800), `--shots`
  (screenshots of the main views to `test-results/views/`), `UI_SLOW=<factor>` stretches the fixed waits.
  Tests must not assume a window size (use `VIEWPORT`).
- `.github/workflows/ui-tests.yml` – the UI tests on GitHub runners, one job per OS, browser and
  window size (macOS: Safari/WebKit, Chrome; Windows: Edge, Chrome, Firefox; Ubuntu: Chrome,
  Firefox; each at 1280x800, 1440x900@2, 1920x1080 = 21 jobs); screenshots as artifacts (14 days);
  on push / PR touching the app or `tests/ui`, weekly on Mondays and on demand.
- `.github/workflows/lint.yml` – ESLint (recommended rules) for the script in `blualbum.html`,
  `tests/ui` and `tests/tools`; config `.github/lint/eslint.config.mjs`. Runs **only on GitHub**
  (ESLint is installed on the runner with fixed versions); the owner does not lint locally.
- `.github/workflows/format.yml` – Prettier (`printWidth` 120, config `.github/lint/prettier.json`)
  for the test scripts `tests/**/*.js` only; `blualbum.html` keeps its compact style (decided
  2026-11-15). Push / PR: `--check`. Run by hand with input `fix`: formats, commits as
  github-actions[bot] and starts UI tests and lint for that commit. Only on GitHub, like lint.
- Workflow for a change: verify unknown API behaviour in Bruno → adapt or add the UI test (and
  the mock) → change the code → all UI tests green → CHANGELOG line under `Unreleased` (only for changes of the app).

## Backlog / ideas
- Not done on purpose: the heart re-reads the album context menu after toggling (1 request) –
  without it the next click would use a self-built URL (rule above).
