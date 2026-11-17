# BluAlbum – notes for Claude

## Project
- BluAlbum: single-file app (`blualbum.html`) that browses the **albums of the music library** of a BluOS player and controls playback. Alternative to the vendor app "BluOS Controller", whose hierarchical browsing of locally stored music is slow and visually unattractive.
- Talks directly to the BluOS Custom Integration API: HTTP GET on port 11000, XML answers. Expects a tagged music library with cover art.
- Minimalistic design – less is more, only relevant information, but in an appealing way.
- No build step, no dependencies. Opened locally in a web browser (file); optional hosting on the user's HTTP server.
- Owner: Ingmar Gebert. MIT licence. Repository: `blu-album`.
- Independent project, not affiliated with Lenbrook / Bluesound (notice in README, file header and about popup – keep it).
- Owner's test setup: Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share plus a USB drive. Main browser: Safari on macOS; Chrome as second browser.

## Scope
Focus: music albums of the locally stored music library. Other player features and settings stay in the BluOS Controller app.

Out of scope (do not build, suggest the alternative):
- Streaming services – the native apps' "Connect" option supports them well
- Radio, inputs, presets – not following the album concept
- Mute / unmute button – use pause instead
- Artist and composer browser – use search instead; browsing is not attractive without pictures
- Song browser – use search instead; any meaningful library has too many songs to browse
- Folder browser – not compatible with the requirement of a tagged library

## Where to look
- `docs/bluos-api.md` – BluOS API reference: every endpoint with parameters, answers, verified state and pitfalls (answer language, `hd` / `hr`, MP3 quality, favourite state, genres, `/Delete` forms, CORS of `/Artwork`, …). **Look up an endpoint here before using or changing a player request.**
- `docs/blu-album-api-usage.md` – every click of the app with its requests, measurements and endpoint choices. Private, git-ignored: missing in worktrees, cloud sessions and clones.
- Top of the `<script>` in `blualbum.html` – module overview (order of the modules).
- `tests/api/README.md` – Bruno collection: setup, folders, request prefixes, fixtures.
- `docs/test-plan.md` – test plan: every function of the app as test cases per block (inputs, expected outputs, status Auto = UI test automation / Manual), test data dictionary; update it when a function or a UI test changes.
- `tests/ui/README.md` – Playwright UI tests: run options, GitHub Actions matrix, updating fixtures.
- `README.md` "Development" – overview of tests and GitHub workflows (UI tests, lint, format).

## Rules
- **One file.** No extra files (favicon, logo, fonts, libraries). Icons are inline SVG constants.
- **No fallbacks: one implementation per feature.** A new endpoint or variant is first verified against the real player with Bruno (`tests/api`, folder "1 Read", E requests) and added to `docs/bluos-api.md`; only the verified variant is implemented. Prefer verified endpoints.
- **Values come from the API**, not hard-coded: source names, play / action URLs, quality, etc.
- **No self-built URLs:** play / queue / favourite URLs come from `/Browse`; only the `/library/v1` lists (New, Favourites, quality) build them by the fixed pattern in `libAlbum()` (decided 2026-11-14).
- **Favourites are managed by the player only**, never locally (no localStorage for favourites).
- **No default IP address** in the app.
- UI language: English. Project documents (README, CHANGELOG, `docs/`, test READMEs, Bruno and code comments): English.
- Markdown: no hard wraps – each paragraph and list item is one line; line breaks only between blocks.
- Check layout changes in Safari as well (see "Known pitfalls").
- Do not publish anything (GitHub release, artifact, pages) without asking the owner first.
- Git: linear `main`, no PRs. After committing on a short-lived branch, offer to fast-forward it into `main` (`git merge --ff-only`) and delete the branch; push only when asked.

### CHANGELOG and releases
- Semantic versioning, set only for a GitHub release. Every delivered change of the app gets a line under `## Unreleased` at the top of `CHANGELOG.md`; `APP.version` stays as it is.
- **One short line per change**: what changed for the user, in about one sentence (e.g. "Fix: no album covers in Firefox."), no cause, no request counts, no implementation details – those belong in the commit message or `docs/`.
- Changes only to documentation (`docs/`, READMEs, CLAUDE.md) or tests (`tests/`) get no CHANGELOG line.
- Release (only when the owner asks): calculate the version once from all collected changes (MINOR if any new feature, else PATCH; MAJOR only when the owner says so), set it in `APP.version` (the only place; shown in the settings footer and the about popup), rename `Unreleased` to the version, commit, tag `vX.Y.Z` (annotated, message "BluAlbum X.Y.Z") and create the release with `blualbum.html` as download. The release notes list the CHANGELOG lines of that version word for word.

## Code conventions (`blualbum.html`)
- Order: `<style>` (colour tokens for light / dark / system at the top), HTML, `<script>` (module overview at its top; start-up code only in the last module "Event wiring & start").
- **State** only in the State module (`let`s); `resetPlayerState()` forgets everything of the previous player on connect, `resetLibrary()` everything of the source selection.
- **Requests** only through `api(path)` (parsed XML, throws on network / HTTP / `<e>` errors) and `apiRaw(path)` (`{ok, status, body}` for the popup that shows unsuccessful answers); `browse(key, q)`, `xml(path)` (toast on failure) and `cmd(url, label)` build on them. Every request sends `Accept-Language: en` (`PLAYER_HEADERS`).
- **Outdated async results** are dropped: `ctx()` (player + source selection), `activeKey` (current view) and counters `plSeq`, `qSeq`, `dlgSeq`, `searchSeq`, `lazyTok`.
- Covers are read with `fetch()` and shown as blob URLs (`showImg()`), not as `<img src="http://…">` (Firefox upgrades those to https on a `file://` page).
- Settings switches / segments: `bindSwitch()`, `bindSegment()`; localStorage only for conveniences (IP, design, cover size, chip groups, pinned queue, disabled sources).
- Configuration constants: `APP`, `SVC_LIBRARY`, `SVC_PLAYLISTS`, `QUALITIES`, `FORMATS`, `LOSSY`, `REPEAT`, icons (`ICON_*`, `HEART`).

## Decisions
- No genre per album: the player offers none, the album popup has no genre line (2026-11-14; the former genre crawl cost ≈ 560 requests).
- Album and track info (`/Info`) is not used: it redirects to last.fm.
- Not done on purpose: the heart re-reads the album context menu after toggling (1 request) – without it the next click would use a self-built URL.

## Known pitfalls
- Safari collapses a flex child with an indefinite height to 0 (happened with the popup track list) – avoid flex sizing for scrolling lists, use a max-height.
- Safari may keep an old version of the local file: reload without cache (⌥⌘R) before chasing a "bug".

## Tests and workflow
- Workflow for a change: verify unknown API behaviour in Bruno → adapt or add the UI test (and `tests/ui/mock-player.js`) → change the code → all UI tests green (`npm test` in `tests/ui`) → CHANGELOG line (only for changes of the app).
- After a firmware update: run the whole Bruno collection, environment "Home" (details in `tests/api/README.md`). Fixtures with personal data stay in `tests/api/fixtures/` (git-ignored); copy them with `tests/tools/sanitize-fixtures.js`.
- UI tests must not assume a window size (use `VIEWPORT`).
- Lint (ESLint) and format (Prettier, test scripts only; `blualbum.html` keeps its compact style) run **only on GitHub**; the owner does not lint locally.
