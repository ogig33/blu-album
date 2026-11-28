# BluAlbum – UI tests

Automated tests of the app's user interface. The app runs headless in **Chrome, Safari
(WebKit), Edge and Firefox** against a **mock player** that answers every request with recorded answers
of a real player (`fixtures/`). No player and no network are needed.

Every function of the app is a test case in [`test-cases.md`](test-cases.md); the name of each UI test starts with the IDs of the test cases it covers (e.g. `QUE-04`). Expected values are derived from the fixtures (object `TD` in `run.js`), never written into the tests. Test levels, environments and rules: [`tests/README.md`](../README.md).

## Files
- `run.js` – the test scenarios and a small test runner
- `test-cases.md` – the test cases; its column Local selects the local tests
- `mock-player.js` – the mock player (fixtures + derived answers, records all commands)
- `fixtures/` – recorded player answers (`NN-name.xml`, `NN` = number of the API test request `ANN` / `CNN`),
  with personal details removed

## Run
Locally 50 core tests run in Chrome and Safari; GitHub Actions runs every test in all four browsers (see below). Requires Node.js 18+ and Google Chrome installed. Safari is tested with
Playwright's WebKit build (the engine of Safari), because Playwright cannot automate the
Safari app itself. Edge (installed app) and Firefox (Playwright's build) run locally only with `--browser`.

```
cd tests/ui
npm install
npx playwright install webkit
npm test                            # 50 core tests of ../../blualbum.html in Chrome and Safari (WebKit)
npm run test:all                    # every test, required before a push (same as node run.js --all)
node run.js --browser safari        # one browser: chrome, safari, edge or firefox (comma list allowed)
node run.js --only QUE-             # of every test: those whose name contains "QUE-" (the queue block of the test cases)
UI_SLOW=2 npm test                  # doubles the fixed waits (slow machines, CI)
node run.js --viewport 1440x900@2   # window size and device pixel ratio (default 1200x800)
node run.js --device "iPhone 15"   # a phone or tablet of Playwright's device list: size, pixel ratio, touch screen
node run.js --jobs 1                # one test at a time (default: 4 per browser, 1 on CI)
node run.js --shots                 # also screenshots of the main views to test-results/views/
node run.js --list                  # every test with its marks: read / write (also real player) or mock, local
```

`npm test` takes about 30 seconds, `npm run test:all` about 2.5 minutes. The column Local of `test-cases.md` selects the local tests: those whose name starts with a case marked `local` (at most 50). 4 tests run at a time per browser, each with its own browser context and mock player. Tests with late answers use `state.hold()` of the mock instead of long fixed waits.

A failed test saves a screenshot of the page to `test-results/` (ignored by git). Tests must not assume a window size: use `VIEWPORT` for coordinates.

## Writing tests
- **Mock player**: listens at the documentation address `IP` of `run.js` (never a real device; `IP2` is a second mock player for changing the player), answers from the fixtures and records every request (`state.requests`, with time and `Accept-Language`) and every command (`state.commands`). With `--player` the requests go to the real player and are recorded the same way (`createRecorder()`).
- **Mock options per test**: `usb: false`, `playing: false`, `listeningModes: false`, `statusPatch` (replaces tags of `/Status`, e.g. `quality`, `canSeek`, `volume`), `overrides` (answer a matching request with an HTTP status or body, edit the mock's answer, or answer later), `state.hold()` (an answer waits until the test releases it), `mock` (sets state, e.g. an empty or generated long queue).
- **Start options per test**: `connect: false` (start page), `storage` (localStorage before the start), `locale`, `dialog: "dismiss"` / `promptValue` (question popup of the app, answered like prompt / confirm), `unreachable` (every player request fails), `blockStorage` (localStorage throws), `appDefaults` (the app's own chip defaults; otherwise genre and quality chips and the search areas Artist and Composer are on and the album views are sorted by album title in the fresh profile).
- **GitHub API**: intercepted by `run.js` (`gh.answer`, `gh.delay`); without an answer the request fails.

## Against the real player
The tests marked `read` (and with `--write` also those marked `write`) run against your own player instead of the mock (test environment ENV-3 of [`tests/README.md`](../README.md#test-environments)). Before the tests, `run.js` asks the player the same questions as the app (`buildTD()`) and builds the test data `TD` from the answers; now playing is read again at the start of every test. Request counts that depend on paging are checked as "at least"; a library that is indexing during the run can change counts.

```
node run.js --player 192.168.1.50 --browser chrome           # read-only: changes nothing on the player
node run.js --player 192.168.1.50 --browser chrome --write   # also tests that change data on the player
```

The only requirement: on macOS the terminal needs the "Local Network" permission (*System Settings → Privacy & Security → Local Network*). The player can be in any state. Tests that need something the player lacks are skipped and the reason is shown (`needs`: `usb` USB drive with albums, `library` library title playing or paused, `queue` at least 3 tracks, `playlist` at least one BluOS playlist; the library playlist part of PLS-07 needs a library playlist). With `--write` the tests provide library title, queue and playlist themselves. Write tests are those that send a request changing data on the player: player controls (play, pause, skip, seek, volume), queue, playlists, favourites, shuffle / repeat. With `--write` the queue is saved as playlist `__blualbum_ui_test__` first. When no library title is playing or paused, or fewer than 3 tracks are queued, the first album with 3 or more tracks is played and saved as `__blualbum_ui_test_start__`. After every write test the queue the tests start from is loaded again (with position, pause state, shuffle, repeat and volume); at the end the original queue is restored and both playlists are deleted. An input such as HDMI cannot be restored: switch back to it yourself. Error cases, delays and a second player stay mock only. With `--player` the tests always run one at a time.

## GitHub Actions
`.github/workflows/ui-tests.yml` runs the tests on GitHub's runners, one job per system, browser and window size (1280x800 small laptop, 1440x900@2 Retina laptop, 1920x1080 desktop):

| Runner | Browsers |
|---|---|
| macOS | Safari (WebKit), Chrome |
| Windows | Edge, Chrome, Firefox |
| Linux (Ubuntu) | Chrome, Firefox |

Chrome and Edge are the apps preinstalled on the runners, WebKit and Firefox are installed by Playwright. Every job runs all tests (`--all`). The workflow runs on pushes to `main` and pull requests that change `blualbum.html`, `tests/ui/` or the workflow, every Monday (new browser versions) and on demand (*Actions → UI tests → Run workflow*). Cover sizes and designs: one test sets every cover size (S / M / L) in every design (Day, Night, System with a light and a dark system) and checks the album wall: S < M < L, no horizontal scrolling, background brightness of the design and a title contrast of at least 4.5 (WCAG AA). With `--shots` the album wall is saved in every cover size, popup, queue, settings and full screen in Day and Night.

The job "mobile" runs every test on emulated phones and tablets (`--device`: window size, pixel ratio, user agent, touch screen, so the page sees `any-pointer: coarse` and `hover: none`; clicks stay mouse clicks):

| Runner | Browser | Devices |
|---|---|---|
| macOS | Safari (WebKit) | iPhone 15, iPad (gen 11) |
| Linux (Ubuntu) | Chrome | Pixel 7 |

Tests marked `mouse: true` (hover, mouse wheel) or `desktop: true` (pinned queue, visible chip row, cover sizes side by side) are skipped there; Firefox has no mobile emulation. The emulation does not replace the manual check in the iOS Simulator (ENV-5).

Every job keeps the screenshots of the main views (and of failed tests) as an artifact for 14 days (*Actions → run → Artifacts*), for a visual check per system, browser and size.

## Update the fixtures
Before recording, at least one favourite album must be in the first album section of the library (e.g. "1" by Peter Gabriel): the mock lists the albums of an artist from that section only, ART-01 and SRH-13 need a favourite among them.

1. Record the answers with the API tests against a player: `PLAYER=<IP address> node --test tests/api/read.test.js` (from the repository root, see [`tests/api`](../api/README.md)); they go to `tests/api/fixtures/` (git-ignored) and contain details of the network and library.
2. `node tests/api/sanitize-fixtures.js` copies them here without personal details.

Expected values such as the current title are read from the fixtures, so the tests
keep working with new recordings.
