# BluAlbum – UI tests

Automated tests of the app's user interface. The app runs headless in **Chrome, Safari
(WebKit), Edge and Firefox** against a **mock player** that answers every request with recorded answers
of a real player (`fixtures/`). No player and no network are needed.

## Files
- `run.js` – the test scenarios and a small test runner
- `mock-player.js` – the mock player (fixtures + derived answers, records all commands)
- `fixtures/` – recorded player answers (`NN-name.xml`, `NN` = number of the Bruno request `ANN` / `CNN`),
  with personal details removed

## Run
Requires Node.js 18+, Google Chrome and Microsoft Edge installed. Safari is tested with
Playwright's WebKit build (the engine of Safari), because Playwright cannot automate the
Safari app itself. Firefox is tested with Playwright's Firefox build.

```
cd tests/ui
npm install
npx playwright install webkit firefox
npm test                            # tests ../../blualbum.html in Chrome, Safari (WebKit), Edge, Firefox
node run.js --browser safari        # one browser: chrome, safari, edge or firefox (comma list allowed)
node run.js --only queue            # only tests whose name contains "queue"
UI_SLOW=2 npm test                  # doubles the fixed waits (slow machines, CI)
node run.js --viewport 1440x900@2   # window size and device pixel ratio (default 1200x800)
node run.js --shots                 # also screenshots of the main views to test-results/views/
```

A failed test saves a screenshot of the page to `test-results/` (ignored by git). Tests must not assume a window size: use `VIEWPORT` for coordinates.

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
