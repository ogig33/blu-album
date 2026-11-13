# BluAlbum – UI tests

Automated tests of the app's user interface. The app runs headless in **Chrome, Safari
(WebKit) and Edge** against a **mock player** that answers every request with recorded answers
of a real player (`fixtures/`). No player and no network are needed.

## Files
- `run.js` – the test scenarios and a small test runner
- `mock-player.js` – the mock player (fixtures + derived answers, records all commands)
- `fixtures/` – recorded player answers (`NN-name.xml`, numbers as in the Bruno collection),
  with personal details removed

## Run
Requires Node.js 18+, Google Chrome and Microsoft Edge installed. Safari is tested with
Playwright's WebKit build (the engine of Safari), because Playwright cannot automate the
Safari app itself.

```
cd tests/ui
npm install
npx playwright install webkit
npm test                            # tests ../../blualbum.html in Chrome, Safari (WebKit), Edge
node run.js --browser safari        # one browser: chrome, safari or edge (comma list allowed)
node run.js --only queue            # only tests whose name contains "queue"
```

## Update the fixtures
1. Run the Bruno folder "1 Read (safe)" (`tests/api`) with `saveFixtures = true`.
   The answers are stored in `tests/api/fixtures/` (ignored by git, they contain
   details of your network and library).
2. Copy them here without personal details:
   `node tests/tools/sanitize-fixtures.js` (from the repository root).

Expected values such as the current title are read from the fixtures, so the tests
keep working with new recordings.
