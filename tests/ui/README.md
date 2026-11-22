# BluAlbum – UI tests

Automated tests of the app's user interface. The app runs headless in **Chrome, Safari
(WebKit), Edge and Firefox** against a **mock player** that answers every request with recorded answers
of a real player (`fixtures/`). No player and no network are needed.

Every function of the app is a test case in the test plan `docs/blu-album-test-plan.md`; the name of each UI test starts with the IDs of the test cases it covers (e.g. `QUE-04`). Expected values are derived from the fixtures (object `TD` in `run.js`), never written into the tests.

## Files
- `run.js` – the test scenarios and a small test runner
- `mock-player.js` – the mock player (fixtures + derived answers, records all commands)
- `fixtures/` – recorded player answers (`NN-name.xml`, `NN` = number of the Bruno request `ANN` / `CNN`),
  with personal details removed

## Run
Locally the tests run in Chrome and Safari; GitHub Actions runs all four browsers (see below). Requires Node.js 18+ and Google Chrome installed. Safari is tested with
Playwright's WebKit build (the engine of Safari), because Playwright cannot automate the
Safari app itself. Edge (installed app) and Firefox (Playwright's build) run locally only with `--browser`.

```
cd tests/ui
npm install
npx playwright install webkit
npm test                            # tests ../../blualbum.html in Chrome and Safari (WebKit)
node run.js --browser safari        # one browser: chrome, safari, edge or firefox (comma list allowed)
node run.js --only QUE-             # only tests whose name contains "QUE-" (the queue block of the test plan)
UI_SLOW=2 npm test                  # doubles the fixed waits (slow machines, CI)
node run.js --viewport 1440x900@2   # window size and device pixel ratio (default 1200x800)
node run.js --jobs 1                # one test at a time (default: 4 per browser, 1 on CI)
node run.js --shots                 # also screenshots of the main views to test-results/views/
node run.js --list                  # every test with its mark: read / write (also real player) or mock
```

`npm test` takes about 2.5 minutes: 4 tests run at a time per browser, each with its own browser context and mock player. Tests with late answers use `state.hold()` of the mock instead of long fixed waits.

A failed test saves a screenshot of the page to `test-results/` (ignored by git). Tests must not assume a window size: use `VIEWPORT` for coordinates.

## Against the real player
The tests marked `read` (and with `--write` also those marked `write`) run against your own player instead of the mock (test environment ENV-4 of `docs/blu-album-test-plan.md`). The expected values are read from the player before the tests start.

```
node run.js --player 192.168.1.50 --browser chrome           # read-only: changes nothing on the player
node run.js --player 192.168.1.50 --browser chrome --write   # also tests that change data on the player
```

The only requirement: on macOS the terminal needs the "Local Network" permission (*System Settings → Privacy & Security → Local Network*). The player can be in any state. Tests that need something the player lacks (a USB drive, a library title playing or paused, 3 tracks in the queue, a saved playlist) are skipped and the reason is shown. Write tests are those that send a request changing data on the player: player controls (play, pause, skip, seek, volume), queue, playlists, favourites, shuffle / repeat. With `--write` the queue is saved as playlist `__blualbum_ui_test__` first. When no library title is playing or paused, or fewer than 3 tracks are queued, the first album with 3 or more tracks is played and saved as `__blualbum_ui_test_start__`. After every write test the queue the tests start from is loaded again (with position, pause state, shuffle, repeat and volume); at the end the original queue is restored and both playlists are deleted. An input such as HDMI cannot be restored: switch back to it yourself. Error cases, delays and a second player stay mock only. With `--player` the tests always run one at a time.

## GitHub Actions
`.github/workflows/ui-tests.yml` runs the tests on GitHub's runners, one job per system, browser and window size (1280x800 small laptop, 1440x900@2 Retina laptop, 1920x1080 desktop):

| Runner | Browsers |
|---|---|
| macOS | Safari (WebKit), Chrome |
| Windows | Edge, Chrome, Firefox |
| Linux (Ubuntu) | Chrome, Firefox |

Chrome and Edge are the apps preinstalled on the runners, WebKit and Firefox are installed by Playwright. The workflow runs on pushes to `main` and pull requests that change `blualbum.html`, `tests/ui/` or the workflow, every Monday (new browser versions) and on demand (*Actions → UI tests → Run workflow*). Cover sizes and designs: one test sets every cover size (S / M / L) in every design (Day, Night, System with a light and a dark system) and checks the album wall: S < M < L, no horizontal scrolling, background brightness of the design and a title contrast of at least 4.5 (WCAG AA). With `--shots` the album wall is saved in every cover size, popup, queue, settings and full screen in Day and Night.

Every job keeps the screenshots of the main views (and of failed tests) as an artifact for 14 days (*Actions → run → Artifacts*), for a visual check per system, browser and size.

## Update the fixtures
1. Run the Bruno folder "1 Read (safe)" (`tests/api`) with `saveFixtures = true`.
   The answers are stored in `tests/api/fixtures/` (ignored by git, they contain
   details of your network and library).
2. Copy them here without personal details:
   `node tests/tools/sanitize-fixtures.js` (from the repository root).

Expected values such as the current title are read from the fixtures, so the tests
keep working with new recordings.
