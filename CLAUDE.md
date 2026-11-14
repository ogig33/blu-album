# BluAlbum – notes for Claude

## Project
- BluAlbum: single-file browser app (`blualbum.html`) that browses the **albums of the music
  library** (network share = "Library", and USB drive) of a BluOS player and controls playback.
- Talks directly to the BluOS Custom Integration API: HTTP GET on port 11000, XML answers.
  No server, no build step, no dependencies.
- Opened locally (file). Not hostable on GitHub Pages: an HTTPS page may not reach the player
  over HTTP in the home network.
- Owner: Ingmar Gebert. MIT licence. Repository: `blu-album`.
- Independent project, not affiliated with Lenbrook / Bluesound (notice in README, file header
  and about popup – keep it).
- Owner's test setup: Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network
  share plus a USB drive. Main browser: **Safari** on macOS; Chrome as second browser.

## Scope
Focus: music albums of the music library. Other player features stay in the BluOS app.

Out of scope (do not build, suggest the alternative):
- Streaming services, radio, inputs – not part of the album concept
- Presets (select / create) – nothing to do with the album concept
- Mute / unmute button – use pause instead
- Artist browser – use search instead
- Composer browser – use search instead
- Song browser – use search instead (to be confirmed)
- Folder browser – music without tags is not compatible with the album concept

## Rules
- **One file.** No extra files (favicon, logo, fonts, libraries). Icons are inline SVG constants.
- **No fallbacks: one implementation per feature.** Variants of an API call are checked first
  against the real player with the Bruno collection (`tests/api`, folder "1 Read", E requests); only the
  verified variant is implemented.
- **Favourites are managed by the player only**, never locally (no localStorage for favourites).
- **Values come from the API**, not hard-coded: source names, play / action URLs, quality, etc.
- UI language English, minimalist design. **Communicate with the owner in German.**
- **All project documents in English** (README, CHANGELOG, `docs/`, test READMEs, Bruno and code
  comments), even when the conversation is in German.
- **No default IP address** in the app.
- **Semantic versioning, set only for a GitHub release:** every delivered change gets a line
  under `## Unreleased` at the top of `CHANGELOG.md`; `APP.version` stays as it is. When the
  owner asks for a release, Claude calculates the version once from all collected changes
  (MINOR if any new feature, else PATCH; MAJOR only when the owner says so), sets it in
  `APP.version` (the only place; shown in the settings footer and the about popup), renames
  `Unreleased` to the version, then commits, tags `vX.Y.Z` and creates the release.
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
  version), `/GitVersion` (BluOS version), `/Artwork?service=…&album=…&artist=…`.

Outside the player (only on click): `https://api.github.com/repos/ogig33/blu-album/releases/latest`
(`tag_name`, `html_url`; CORS `*`, works from a local file) – update check in the about popup.

Pitfalls:
- `/Delete?id=N` removes a **queue track**; `/Delete?service=BluOS&name=…` deletes a **saved playlist**.
- USB albums have no favourite actions (no heart on USB covers).
- Quality is `hd` in `/Status` but `hr` in the library filter; both are shown as "HD".
  MP3 files report their **bitrate** as `quality` – recognise MP3 by `atype` / `streamFormat`.
- `/Playlists` names carry an `image` attribute: `<name image="…">X</name>`.
- `/Info?…` (album / track info) redirects to last.fm – not usable.
  `/Info?category=technical&filename=…` answered empty.
- The player offers **no genre per album** (not in `/Browse` album / context menu,
  `/library/v1/Songs`, `/library/v1/Albums`); the album popup has no genre line (decided
  2026-11-14, the former genre crawl cost ≈ 560 requests).
- `/Artists`, `/Albums`, `/Songs`, `/Genres`, `/Composers`, `/Folders` are only 302 redirects to
  `/library/v1/…` on port 11004. BluOS API reference (official v1.7 + unofficial endpoints, by
  category, with source tags): `docs/bluos-api.md`; BluAlbum's clicks, their requests and endpoint
  choices: `docs/blu-album-api-usage.md`.
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
- `tests/api` – Bruno collection, environment "Home" (`host` = player IP, `saveFixtures`, `runManual`). Three folders, the whole collection is the suite to run after a firmware update: "1 Read (safe)" only reads (app requests A01–A26, album details and new variants E01–E13, reference endpoints V01–V31); "2 Write (changes the player)" sends every command of the app (C01–C47) and of the reference (W01–W15, S01–S35) and restores queue, position, volume, settings etc. afterwards; "3 Manual (run on purpose)" (M01–M08: doorbell, reindex, test preset, reboot) is skipped unless `runManual = true`. Fixtures go to `tests/api/fixtures/` (git-ignored, personal data).
- `tests/tools/sanitize-fixtures.js` – copies fixtures to `tests/ui/fixtures` without IPs,
  room name, share / mount paths and USB ids.
- `tests/ui` – Playwright tests (`npm test` in `tests/ui`) of the app against `mock-player.js`,
  which answers from the fixtures and records all commands. Runs in Chrome and Edge (installed
  apps, Playwright channels) and Safari (Playwright WebKit); `--browser chrome|safari|edge`.
- Workflow for a change: verify unknown API behaviour in Bruno → adapt or add the UI test (and
  the mock) → change the code → all UI tests green → CHANGELOG line under `Unreleased`.

## Backlog / ideas
- Not done on purpose: the heart re-reads the album context menu after toggling (1 request) –
  without it the next click would use a self-built URL (rule above).
- Optional: GitHub Action that runs the UI tests on every push
