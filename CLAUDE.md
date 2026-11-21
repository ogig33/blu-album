# BluAlbum – notes for Claude

## Project

- BluAlbum: single-file app (`blualbum.html`) to browse and play your **local BluOS music library**.
- No installation, no setup: open the file in your browser and enter the IP address of your BluOS player.
- Companion to the vendor app "BluOS Controller": overcomes its slow and unappealing browsing of the local music library.
- Uses the official BluOS Custom Integration API (HTTP GET on port 11000, XML answers).
- Minimalistic design for fast and efficient access to the library: no tree-based navigation, find music with search, filters and sorting instead.
- Focus on music albums: album art is the visual navigation; show covers in the highest quality possible.
- Expects a tagged music library with cover art.
- Owner: Ingmar Gebert. MIT licence. Repository: `blu-album`.
- Independent project, not affiliated with Lenbrook / Bluesound (notice in README, file header and about popup – keep it).
- Owner's test setup: Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share plus a USB drive. Main browser: Safari on macOS; Chrome as second browser.

## Not in scope

Do not build these; when asked, point to the alternative.

- Streaming services – the native apps' "Connect" option supports them well.
- Radio, input switching, presets – not following the album concept.
- Artist / composer browser – use search instead; browsing is not appealing without pictures.
- Song browser – use search instead; any meaningful library has too many songs to browse.
- Folder browser – BluAlbum expects a tagged library.
- Album data from the internet (e.g. missing cover art, lyrics, album details, artist pictures, artist details). The only request leaving the home network is the update check in the about popup, on click.
- Changing the player configuration (e.g. player grouping, listening modes, reindexing the library) – use the BluOS Controller app. Showing such values (e.g. the listening mode icon in the player bar) is fine.
- Mobile devices – they do not open local HTML files properly; there is no user-friendly solution (only third-party apps).

## Where to look

- `docs/bluos-api.md` – BluOS API reference: every endpoint with parameters, answers, verified state and pitfalls (answer language, `hd` / `hr`, MP3 quality, favourite state, genres, `/Delete` forms, CORS of `/Artwork`, …). **Look up an endpoint here before using or changing a player request.**
- `docs/blu-album-api-usage.md` – every click of the app with its requests, measurements and endpoint choices. Private, git-ignored: missing in worktrees, cloud sessions and clones.
- `docs/blu-album-library-guidance.md` – how users should tag their library and set "Optimize Artwork" for the best experience with BluAlbum.
- `docs/blu-album-test-plan.md` – test plan: every function of the app as test cases per block (inputs, expected outputs, status Auto = UI test automation / Manual), test data dictionary; update it when a function or a UI test changes.
- `tests/api/README.md` – Bruno collection: setup, folders, request prefixes, fixtures.
- `tests/ui/README.md` – Playwright UI tests: run options, GitHub Actions matrix, updating fixtures.
- `README.md` "Development" – overview of tests and GitHub workflows (UI tests, lint, format).
- Top of the `<script>` in `blualbum.html` – module overview (order of the modules).

## Development principles

- **Single-page application (SPA).** Views switch without a page reload; the state lives in the State module (see https://en.wikipedia.org/wiki/Single-page_application).
- **Thin server architecture.** The player acts as the server and only provides the API; all app logic runs in the browser.
- **One file.** All app components (HTML, CSS, JavaScript, SVG icons) are embedded in one HTML file.
- **No dependencies.** Do not add libraries or packages to BluAlbum (supply chain and vulnerability risk).
- **Modular code structure.** Structure the code so that features reuse shared functions as much as possible.
- **One implementation per feature.** No second implementation as a fallback. Only the variant verified against the real player (Bruno) is implemented.
- **Avoid hard-coding.** Derive as much of the app logic as possible from API answers, e.g. source names, play / action URLs, quality. Accepted exceptions are the configuration constants (see "Code conventions").
- **Avoid self-built API URLs.** Play / queue / favourite URLs come from `/Browse`; the only exception are the `/library/v1` lists (New, Favourites, quality, decades), built by the fixed pattern in `libAlbum()`.
- **Store changes at the player.** Favourites, playlists and every other change the player supports are stored there, so they persist across sessions and are visible in other player clients. localStorage only for conveniences (see "Code conventions").
- **Expose API errors.** Show failed player requests to the user (network error, HTTP status other than 200, `<e>` answer) with the endpoint URL and the error answer. Exceptions: expected failures – `/audioPreset` on players without listening modes, status polling (aborted or retried), missing covers, statistic lists that are not available.
- **English is the main language.** UI and project documents (README, CHANGELOG, `docs/`, test READMEs, Bruno and code comments) are in English.
- **No hard wraps in Markdown.** Each paragraph and list item is one line; line breaks only between blocks.
- **Check layout changes in Safari** as well (see "Known pitfalls").

## Tests and workflow

- Workflow for a change:
  - Verify unknown API behaviour in Bruno (`tests/api`) and add it to `docs/bluos-api.md` if not yet documented.
  - Adapt or add the UI test (and `tests/ui/mock-player.js`).
  - Change the code → all UI tests green (`npm test` in `tests/ui`).
  - Add or update the test case in `docs/blu-album-test-plan.md`.
  - CHANGELOG line (only for changes of the app).
- After a firmware update:
  - Run the whole Bruno collection, environment "Home" (details in `tests/api/README.md`).
  - Fixtures with personal data stay in `tests/api/fixtures/` (git-ignored); copy them with `tests/tools/sanitize-fixtures.js`.
  - Find new endpoints with `node tests/tools/crawl-endpoints.js <player IP>` (read-only, compares with `docs/bluos-api.md`); verify each finding in Bruno before documenting it.
- UI tests must not assume a window size (use `VIEWPORT`).
- Lint (ESLint) and format (Prettier, test scripts only; `blualbum.html` keeps its compact style) run **only on GitHub**; the owner does not run them locally.

## Git and publishing

- **Git workflow:** linear history on `main`, no feature branches, no PRs. Ask before pushing.
- **Ask before publishing** anything on GitHub (releases, artifacts, pages).

## CHANGELOG and releases

- **Semantic versioning**, set only for a GitHub release. Every delivered change of the app gets a line under `## Unreleased` at the top of `CHANGELOG.md`; `APP.version` stays as it is.
- **One short line per change:** what changed for the user, in about one sentence (e.g. "Fix: no album covers in Firefox."), no cause, no request counts, no implementation details – those belong in the commit message or `docs/`.
- **No CHANGELOG line for docs or tests:** changes only to documentation (`docs/`, READMEs, CLAUDE.md) or tests (`tests/`) get none.
- **Release (only when the owner asks):** calculate the version once from all collected changes (MINOR if any new feature, else PATCH; MAJOR only when the owner says so), set it in `APP.version` (the only place; shown in the settings footer and the about popup), rename `Unreleased` to the version, commit, tag `vX.Y.Z` (annotated, message "BluAlbum X.Y.Z") and create the release with `blualbum.html` as download. The release notes list the CHANGELOG lines of that version word for word.

## Code conventions (`blualbum.html`)

- **Order:** `<style>` (colour tokens for light / dark / system at the top), HTML, `<script>` (module overview at its top; start-up code only in the last module "Event wiring & start").
- **State** only in the State module (`let`s); `resetPlayerState()` forgets everything of the previous player on connect, `resetLibrary()` everything of the source selection.
- **Requests** only through `api(path)` (parsed XML, throws on network / HTTP / `<e>` errors) and `apiRaw(path)` (`{ok, status, body}` for the popup that shows unsuccessful answers); `browse(key, q)`, `xml(path)` and `cmd(url, label)` build on them. Every request sends `Accept-Language: en` (`PLAYER_HEADERS`).
- **Failed requests:** errors of `api()` carry `url`, `status` and `body`; `apiFail(title, e)` shows them in the API response popup (`showApiResponse()`), `loadFailed(prefix, title, e)` also writes the status line. `xml()` and `cmd()` use the popup on failure.
- **Outdated async results** are dropped: `ctx()` (player + source selection), `activeKey` (current view) and counters `plSeq`, `qSeq`, `dlgSeq`, `searchSeq`, `lazyTok`.
- **Covers** are read with `fetch()` and shown as blob URLs (`showImg()`), not as `<img src="http://…">` (Firefox upgrades those to https on a `file://` page).
- **Settings switches / segments:** `bindSwitch()` (also the search area chips), `bindSegment()`; localStorage only for conveniences (IP, design, cover size, chip groups, search areas, pinned queue, disabled sources).
- **Configuration constants:** `APP`, `SVC_LIBRARY`, `SVC_PLAYLISTS`, `QUALITIES`, `FORMATS`, `LOSSY`, `REPEAT`, icons (`ICON_*`, `HEART`).

## Decisions

- **No genre in the album popup:** would be useful, but needs a large crawl because no endpoint gives the genre of an album.
- **No player controls in the album popup:** play / queue are on the cover in the album grid (hover); keeps the popup simple.
- **No track duration in the player bar:** shown in the queue panel; keeps the player bar uncluttered.
- **No mute / unmute button:** use pause instead; keeps the player bar uncluttered.
- **No player discovery:** not technically feasible from a local HTML page in a browser.
- **No album and track info (`/Info`):** it only redirects to last.fm.
- **No compilation chip:** the player offers no compilation filter; the `COMPILATION` tag is only in the songs of a single album, and the album artist "Various" is a convention of the library, not a value of the API.
- **The heart re-reads the album context menu** after toggling a favourite (1 request) – without it the next click would use a self-built URL.
- **No player status text** (e.g. paused, streaming): niche, not essential. The play / pause button still reflects the state.
- **Do not use /ui endpoints:** these endpoints are specific to BluOS Controller app and too risky for other clients
- **No default IP address** in the app.
- **No song title search area:** the search's songs list has no link to the album of a song (no browse key, no "Go to album" in the song context menu); the album would need a self-built URL, which fails for samplers (the song carries the track artist, not the album artist).
- **No song favourites:** no heart per track in the album popup and no "Favourite songs" chip, although the API supports both (`/AddFavourite?fn=`, `autoplayURL` with `category=FAVOURITES`); BluAlbum keeps to album favourites.
- **Playlist chips keep the player's order:** no "Date added" sort (`/Playlists?sort=recent`) and no warning when the queue is saved under an existing playlist name.

## Known pitfalls

- Safari collapses a flex child with an indefinite height to 0 (happened with the popup track list) – avoid flex sizing for scrolling lists, use a max-height.
- Safari may keep an old version of the local file: reload without cache (⌥⌘R) before chasing a "bug".
