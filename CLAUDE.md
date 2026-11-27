# BluAlbum – notes for Claude

## Project

- BluAlbum: single-file app (`blualbum.html`) to browse and play your **local BluOS music library**.
- No installation, no setup: open the file in your browser and enter the IP address of your BluOS player.
- Companion to the vendor app "BluOS Controller": overcomes its slow and unappealing browsing of the local music library.
- Uses the official BluOS Custom Integration API (HTTP GET on port 11000, XML answers).
- Minimalistic design for fast and efficient access to the library: no tree-based navigation, find music with search, filters and sorting instead.
- Focus on music albums: album art is the visual navigation; show covers in the highest quality possible.
- Expects a tagged music library with cover art.
- **Terms:** queue (what the player plays), BluOS playlist (stored in the player, changeable), library playlist (imported playlist file of the share or USB drive, read-only), service playlist (streaming service); no "saved playlist".
- Owner: Ingmar Gebert. MIT licence. Repository: `blu-album`.
- Independent project, not affiliated with Lenbrook / Bluesound (no need to mention in README, file header or the about popup).
- Owner's test setup: Bluesound Powernode, BluOS 4.18.26, API v0.5.51, library on a network share plus a USB drive. Main browser: Safari on macOS; Chrome as second browser.

## Not in scope

Do not build these; when asked, point to the alternative.

- Streaming services – the native apps' "Connect" option provide better user interface options
- Radio, input switching, presets – different music consumption compared to albums
- Artist / composer browser – use search instead; browsing is not appealing without pictures.
- Song browser – use search instead; any meaningful library has too many songs to browse.
- Folder browser – BluAlbum expects a tagged library.
- Album data from the internet (e.g. missing cover art, lyrics, album details, artist pictures, artist details). The only request leaving the home network is the update check in the about popup, on click.
- Changing the player configuration (e.g. player grouping, listening modes, reindexing the library) – use the BluOS Controller app. Showing such values (e.g. the listening mode icon in the player bar) is fine.
- Mobile devices – they do not open local HTML files properly; there is no user-friendly solution (only third-party apps).

## Where to look

- `docs/bluos-api.md` – BluOS API reference (chapter 10: service functions `/Albums`, `/Playlists`, `/Songs` … and `/Artwork`, dispatched by `service`; chapter 11: library functions `/library/v1`): every endpoint with parameters, answers, verified state and pitfalls (answer language, `hd` / `hr`, MP3 quality, favourite state, genres, `/Delete` forms, CORS of `/Artwork`, …). **Look up an endpoint here before using or changing a player request.**
- `private/` – the owner's private content, git-ignored and never published (missing in worktrees, cloud sessions and clones): `bruno/` (Bruno collection with its fixtures), `tools/` (API tools), `docs/` (private notes), `library-tools/` (library tagging scripts). Keep every API test script, API tool and private note there; public files only say that they exist.
- `private/docs/blu-album-api-usage.md` – every click of the app with its requests, measurements and endpoint choices.
- `docs/blu-album-library-guidance.md` – how users should tag their library and set "Optimize Artwork" for the best experience with BluAlbum.
- `docs/blu-album-test-plan.md` – test plan: every function of the app as test cases per block (input, expected output, real player, core), test environments, test data dictionary; update it when a function or a UI test changes.
- `private/bruno/README.md` – Bruno collection: setup, folders, request prefixes, fixtures.
- `tests/ui/README.md` – Playwright UI tests: run options, GitHub Actions matrix, updating fixtures.
- `README.md` "Development" – overview of tests and GitHub workflows (UI tests, lint, format, pages).
- `site/index.html` – website on GitHub Pages: one static page, no subpages, plain wording (no sales tone), only the main screenshot (dark / light); published by `.github/workflows/pages.yml` with `docs/screenshots/*-main-view.jpg`.
- Top of the `<script>` in `blualbum.html` – module overview (order of the modules).

## Development principles

- **Single-page application (SPA).** Views switch without a page reload; the state lives in the State module.
- **Thin server architecture.** The player acts as the server and only provides the API; all app logic runs in the browser.
- **One file.** All app components (HTML, CSS, JavaScript, SVG icons) are embedded in one HTML file.
- **No dependencies.** Do not add libraries or packages to BluAlbum (supply chain and vulnerability risk).
- **Lean and Modular code structure.** Structure the code so that features reuse shared functions as much as possible.
- **One implementation per feature.** No second implementation as a fallback. Only the variant verified against the real player (Bruno) is implemented.
- **Avoid hard-coding.** Derive as much of the app logic as possible from API answers, e.g. source names, play / action URLs, quality. Accepted exceptions are the configuration constants (see "Code conventions").
- **Avoid self-built API URLs.** Play / queue / favourite URLs come from `/Browse`; the only exception are the `/library/v1` lists (New, Favourites, quality, decades, genres, album artist search), built by the fixed pattern in `libAlbum()`.
- **Store changes at the player.** Favourites, playlists and every other change the player supports are stored there, so they persist across sessions and are visible in other player clients. localStorage only for conveniences (see "Code conventions").
- **Expose API errors.** Show failed player requests to the user (network error, HTTP status other than 200, `<e>` answer) with the endpoint URL and the error answer. Exceptions: expected failures – `/audioPreset` on players without listening modes, status polling (aborted or retried), missing covers, statistic lists that are not available.
- **Check layout changes in Safari** as well (see "Known pitfalls").

## Documentation

- **English is the main language.** UI and project documents (README, CHANGELOG, `docs/`, test READMEs, Bruno and code comments) are in English.
- **No hard wraps in Markdown.** Each paragraph and list item is one line; line breaks only between blocks.
- **Keep wording short:** precise, no lengthy explanations, examples only where needed.
- **Keep documentation up-to-date** - any change with impact on docs must be reflected there 
  - BluOS API reference `docs/bluos-api.md`.
  - BluAlbum API usage `private/docs/blu-album-api-usage.md`.
  - BluAlbum music library end user guidance `docs/blu-album-library-guidance.md`
  - BluAlbum test case in `docs/blu-album-test-plan.md`.
  - Feature list and requirements of the website `site/index.html` (like the README).
- **`docs/bluos-api.md`:** API facts only, independent of BluAlbum.
  - Structure: per category a one-sentence description, the overview table (Endpoint | Function | Official | Verified), optionally a "Common …" block; per endpoint one `###` with request line (all parameters), parameter table, **Response format**, response keys table, **Notes** (only facts that help in the endpoint's context). Basics only for rules of every endpoint.
  - Only endpoints verified to exist; no paths that answer 404 (a non-existing endpoint, a short form), no unverified guesses. An endpoint that exists but whose purpose is unknown is listed with "purpose unknown" and its observed answer.
  - Not in it: answer or image sizes (→ `private/docs/blu-album-api-usage.md`), dates and versions per statement, verification logs, Bruno IDs, values of the test player, how the BluOS Controller calls endpoints, client advice, personal-data notes.
- **`private/docs/blu-album-api-usage.md`:** the requests of every click of BluAlbum with measured data.
  - Structure: measurement conditions (date, app and BluOS version, library) once at the top, overview of every click; per app area a chapter with a one-sentence description and one table (Trigger | Requests | Count | Data | Cache | Purpose), below it only facts needed for the requests; then endpoint choices and open proposals.
  - Not in it: endpoints the app does not use, code internals (variable and function names), done or decided proposals (→ CHANGELOG, CLAUDE.md "Decisions"), statements repeated from CLAUDE.md or `bluos-api.md`.

## Tests and workflow

- Workflow for a change:
  - analyze change using materials in "where to look" section
  - Verify unknown API behaviour if needed in Bruno (`private/bruno`)
  - Adapt or add the UI test (and `tests/ui/mock-player.js`).
  - Change the code → local core tests green (`npm test` in `tests/ui`).
  - CHANGELOG line (only for changes of the app).
  - Before a push: all UI tests green (`npm run test:all` in `tests/ui`).
- After a firmware update:
  - Run the whole Bruno collection, environment "Home" (details in `private/bruno/README.md`).
  - Fixtures with personal data stay in `private/bruno/fixtures/`; copy them to `tests/ui/fixtures` with `private/tools/sanitize-fixtures.js`.
  - Find new endpoints with `node private/tools/crawl-endpoints.js <player IP>` (read-only, compares with `docs/bluos-api.md`); verify each finding in Bruno before documenting it.
  - Then `node private/tools/build-wordlist.js` (no requests): requests of the BluOS Controller app missing in `docs/bluos-api.md`, and the wordlists for ffuf (never request `denied.txt` unchecked).
- Test methodology:
  - The test plan has at most 150 core test cases; `tests/ui/run.js` stops when this limit or the local limit of 50 is exceeded. Both limits are reached (2026-11-23): extend an existing case or add a case outside the core ("–").
  - UI tests: local tests performs only a subset of 50 core tests with core browsers (Safari, Chrome), run within 5 mins
  - UI remote tests: github runs the full test case scope with all browsers (Safari, Chrome, Edge and Firefox) and OSes (macos, Linux, Windows)
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

- **Order:** `<style>` (colour tokens for light / dark / system and the design tokens at the top), HTML, `<script>` (module overview at its top; start-up code only in the last module "Event wiring & start").
- **State** only in the State module (`let`s); `resetPlayerState()` forgets everything of the previous player on connect, `resetLibrary()` everything of the source selection.
- **Requests** only through `api(path)` (parsed XML, throws on network / HTTP / `<e>` errors) and `apiRaw(path)` (`{ok, status, body}` for the popup that shows unsuccessful answers); `browse(key, q)`, `xml(path)`, `rawCmd(path, title, ok)` and `cmd(url, label)` build on them. Lists of sections are read with `mapLimit()`, 3 at a time. Every request sends `Accept-Language: en` (`PLAYER_HEADERS`).
- **Failed requests:** errors of `api()` carry `url`, `status` and `body`; `apiFail(title, e)` shows them in the API response popup (`showApiResponse()`), `loadFailed(prefix, title, e)` also writes the status line. `xml()` and `cmd()` use the popup on failure.
- **Questions to the user** only with `ask(text, ok, value)` (question popup `#askdlg`, with `value` a name field), never `confirm()` / `prompt()`; the UI tests answer it like a native dialog (`dialog`, `promptValue`, `t.dialogs.log`).
- **Outdated async results** are dropped: `ctx()` (player + source selection), `activeKey` (current view) and counters `plSeq`, `qSeq`, `dlgSeq`, `searchSeq`, `lazyTok`. View loaders show results and errors only through `viewOut()` (also holds them back during a search).
- **Elements** are built with `el(tag, props, ...children)`, chips with `chip(props, load)`, line icons with `strokeIcon()`; texts of XML elements are read with `textOf(e, sel)`.
- **Styles:** values come from the tokens (`--r-*` radius, `--sh*` shadow, `--fs-*` (12 / 13 / 17 px; body 15 px), `--serif` / `--sans`, `--hov` / `--panel-h` / `--acc-h` hover, `--dis`, `--t-*`), no new literal values; accent: `--acc` for fills (state, main action), `--acct` for text, focus ring and icon hover, `--err` for errors; icon buttons are in the text colour, the accent marks only a state or the main action; shared classes: `.ib` icon button (`.sm` 20 px, `.lg` 28 px, `.sub`, `.fill`; symbols drawn to fill the 24 grid; on via `aria-pressed` / `aria-expanded`), `.ovl` overline, `.kv` key / value list; buttons with the default background get the hover tint automatically.
- **Covers** are read with `fetch()` and shown as blob URLs (`showImg()`), not as `<img src="http://…">` (Firefox upgrades those to https on a `file://` page).
- **Settings switches / segments:** `bindSwitch()` (also the search area chips), `bindSegment()`; localStorage only for conveniences (IP, design, cover size, chip groups, chip row, search areas, sort order, pinned queue, disabled sources).
- **Configuration constants:** `APP`, `SVC_LIBRARY`, `VIEW` (view and cache keys), `QUALITIES`, `SORTS`, `FORMATS`, `LOSSY`, `REPEAT`, icons (`ICON_*`, `HEART`).

## Decisions

- **No genre in the album popup:** would be useful, but no endpoint gives the genre of an album; it would need the album lists of all genres (`genre=…&section=all`, 1 request per genre and source: 37 requests, 245 KB, about 2 s for the owner's library and USB drive).
- **No album link from the player bar and the queue:** `/Status` and `/Playlist` carry no album reference (no browse key, no album artist, no album id; `fn` leads to no album); a match by album title in the app would be too unreliable.
- **No player controls in the album popup:** play / queue are on the cover in the album grid (hover); keeps the popup simple.
- **No player controls in the full screen:** it covers the footer (inert meanwhile); the footer sliding in at the bottom edge irritated (removed 2026-11-26). Close: button at the top right, click, Esc.
- **No track duration in the player bar:** shown in the queue panel; keeps the player bar uncluttered.
- **No mute / unmute button:** use pause instead; keeps the player bar uncluttered.
- **No player discovery:** not technically feasible from a local HTML page in a browser.
- **No album and track info (`/Info`):** it only redirects to last.fm.
- **No compilation chip:** the player offers no compilation filter; the `COMPILATION` tag is only in the songs of a single album, and the album artist "Various" is a convention of the library, not a value of the API.
- **The heart re-reads the context menu** (album or library playlist) after toggling a favourite (1 request) – without it the next click would use a self-built URL.
- **No player status text** (e.g. paused, streaming): niche, not essential. The play / pause button still reflects the state.
- **Do not use /ui endpoints:** these endpoints are specific to BluOS Controller app and too risky for other clients
- **No "Recently played" chip:** the only source found for this list is `/ui/RecentlyPlayed` (see the rule above; checked 2026-11-22 with BluOS 4.18.18), the "Recent" album sort means recently added (same as New); no own history in localStorage either, it would miss what other clients play.
- **No workaround for the empty MQA chip:** BluOS bug, albums with `mqaBrowse` songs are in no quality list (`docs/bluos-api.md`); the chip keeps the player's filter. Documented only.
- **No default IP address** in the app.
- **No service functions for the library** (`/Albums`, `/Songs`, … with `service=LocalMusic` or the USB id): they only redirect (302) to `/library/v1` on port 11004, which sends no CORS headers, so the browser cannot read the answer; same data, one more round trip, neither is in the official documentation. More robust against API changes is `/Browse` (official), already used for menus, All, genres, artists, search, tracks, playlists and every play / queue / favourite URL; `/library/v1` stays for the lists `/Browse` does not offer as well (checked 2026-11-27).
- **No hosted version, no HTTPS API (port 11005):** the official documentation uses HTTP on port 11000; BluAlbum stays on the recommended path. Tested 2026-11-27 with a page on GitHub Pages: HTTP is blocked as mixed content in every browser; port 11005 (HTTP/2, CORS `*`) fails in Safari even after accepting the certificate (self-signed, no extensions, valid until 2040: Apple rejects it), so iOS devices are out as well.
- **No song title search area:** the search's songs list has no link to the album of a song (no browse key, no "Go to album" in the song context menu); the album would need a self-built URL, which fails for samplers (the song carries the track artist, not the album artist).
- **Album artist search in the app:** the player's search does not match the album artist (see pitfalls); the Artist search area also matches the album artist of every album of the library (`section=all` without a filter, 1 request per source, shared with the decade chips) in the app, with the player's rules (`atWordStart()`); result group "as an album artist" before "as a track artist", one chip for both.
- **No song favourites:** no heart per track in the album popup and no "Favourite songs" chip, although the API supports both (`/AddFavourite?fn=`, `autoplayURL` with `category=FAVOURITES`); BluAlbum keeps to album favourites and the favourites of library playlists (heart on their tile; BluOS playlists have none).
- **No playlist search:** the player offers none (see `/Playlists` in `docs/bluos-api.md`); a name filter in the app would be possible, but is not wanted.
- **Sort order of the album views:** a select in the status line (grey like its text), sorted in the app; album title, album artist (an artist's albums by year), year (each A–Z / Z–A or newest / oldest first) and Random, the default; New keeps its newest-first order (select disabled); with the album artist and year orders the tiles show "<year> · <artist>" (grey, like the artist); no group lines; search results and the Playlists view are not sorted.
- **The Playlists view:** BluOS playlists, then library playlists of the enabled sources, grouped like the search results, each group in the player's order; no "Date added" sort (`/Playlists?sort=recent`) and no warning when the queue is saved under an existing playlist name.

## Known pitfalls

- Safari collapses a flex child with an indefinite height to 0 (happened with the popup track list) – avoid flex sizing for scrolling lists, use a max-height.
- Safari may keep an old version of the local file: reload without cache (⌥⌘R) before chasing a "bug".
- The player's search does not find albums by their album artist, only by title and track artists (Bruno E40, `docs/bluos-api.md`): albums of "Various" or "Putumayo Presents" whose tracks carry other artists are found only by the app's own album artist match. Test search behaviour with albums whose album artist is on none of their tracks.
- MQA comes in FLAC: format, bit depth and sample rate do not rule it out. An empty MQA chip is the BluOS bug (see Decisions), not an app bug.
- `section=all` fails silently: `category`, `recent` and `composer` are ignored (all albums), its index (`length=1`) counts 0 with `artist` / `expr`, Songs and Composers list nothing, in a browse key only the first section answers (`docs/bluos-api.md`).
- The context menu key of a library playlist carries `isFavourite=1` right after `?` (album keys: at the end); switching the flag must keep the key valid (`toggleFav()`).
- Library playlists: their tracks come only from `/Browse` (`/library/v1/Songs?playlist=` answers empty); the USB drive lists none on the test player.
- The `close` event of `<dialog>` arrives late: the next album may be open already, check `dlg.open` in the handler.
- App names used in `page.evaluate()` belong in `APP_GLOBALS` (`.github/lint/eslint.config.mjs`) and must not be assigned: ESLint fails, and only on GitHub.
- `--player`: GRD-06, FAV-04 and POP-06 fail on the fixed 400 ms wait; repeat with `UI_SLOW=8` before chasing a bug.
- GitHub macOS runners: SET-02 (Chrome loses localStorage) and SRH-11 (WebKit page error on reload) fail now and then; re-run before chasing a bug.
- Prettier (only on GitHub) breaks lines over 120 characters and always puts nested array literals (`[[a, b], [c, d]]`) one element per line; a red Format check is fixed by the workflow itself (Actions → Format → Run workflow with "fix", commits the result; pull afterwards).
