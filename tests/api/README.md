# BluAlbum – API tests

Contract tests of the player requests against your own BluOS player: every request the app sends, the API behaviour the app relies on, and the endpoints of the API reference [`docs/bluos-api.md`](../../docs/bluos-api.md). They check the **structure** of the answers (elements, attributes), not concrete albums or numbers, and record the answers the UI tests replay (`fixtures/`). Node.js only (`node:test`, `fetch`), no packages, nothing to install.

Every test: [`test-cases.md`](test-cases.md). Test levels, environments and rules: [`tests/README.md`](../README.md).

## Blocks

| File | IDs | Purpose | Needed for | Effect on the player |
|---|---|---|---|---|
| `read.test.js` (about 40 s) | A | Read requests of the app (contract) | Fixtures of the UI tests; every firmware update | None |
| | E | API behaviour the app relies on (variants, workarounds, player bugs) | Every firmware update | None |
| | V | Read endpoints of the API reference | The column "Verified" of the reference | None |
| `write.test.js` (about 70 s) | C | Commands of the app (contract) | Every firmware update | Playback is interrupted; everything is restored and checked |
| | W, S, P | Write endpoints of the reference: queue and playback (W), settings, playlists and name (S), parameters found by the crawler (P) | The column "Verified" of the reference | Same |
| `manual.test.js` | M | Endpoints with lasting or risky effects (reboot, rescan, firmware upgrade, radio favourites …) | Once per new endpoint, on purpose | See the request in `test-cases.md` |

Only A01–A30 give fixtures for the UI tests. `write.test.js` runs A01–A30 again first (C uses their keys).

## Requirements

| Requirement | Needed for | Without it |
|---|---|---|
| Node.js 20 or newer | Every run | – |
| Your own BluOS player in the same network; on macOS the terminal needs the "Local Network" permission (*System Settings → Privacy & Security → Local Network*) | Every run | The run fails at once |
| A tagged library with cover art (share or USB drive) | Every run | – |
| A queue playing or paused, from the library | `read.test.js`: complete fixtures (A19, A20) and E33 | A20 records an empty queue, E33 is skipped; `write.test.js` sets it up itself (below) |
| A favourite album | E17, E18 | Skipped |
| A USB drive | A03, A14, A15, A26, E12, E13, E42 | Skipped |
| A BluOS playlist | A28 | Skipped |
| A library playlist | A30, P23 | Skipped |
| Composer tags, a sampler with the album artist "Various", an album with several discs, MQA songs | E27–E30, E32, E38, E45, P02 | Skipped |
| A preset; a TuneIn favourite station | W09–W11; V55 | Skipped |
| A fixed group | S15–S19 | Skipped |
| A favourite album in the first album section of the library | The UI tests ART-01 and SRH-13 (see [`tests/ui/README.md`](../ui/README.md#update-the-fixtures)) | Those UI tests fail with the new fixtures |

`write.test.js` sets up its own start state: when the player does not play or pause from a queue of at least 11 entries, it saves the queue as `__bluos_api_test_start__`, queues library albums and plays them; at the end it loads the queue again. A favourite song for P05 is added by P04 and removed by P08. A radio stream or an input playing at the start is not restored.

## Run

In this folder; from the repository root add the path (`node --test tests/api/read.test.js`).

1. Name the player once in `config.json` (git-ignored): `{ "host": "<IP address>" }`. Optional keys: `saveFixtures` (default `true`: answers to `fixtures/`), `runManual` (default `false`). The environment variables `PLAYER`, `SAVE_FIXTURES`, `RUN_MANUAL` override the file, e.g. `PLAYER=192.168.1.20 node --test read.test.js` for another player.
2. Read: `node --test read.test.js` (changes nothing).
3. Write: `node --test write.test.js` (playback is interrupted; everything is restored and checked at the end).
4. For the UI tests: copy the fixtures without personal details (from the repository root), then run every UI test:
   ```
   node tests/api/sanitize-fixtures.js
   cd tests/ui && npm run test:all
   ```
5. Optional, one manual request at a time: `RUN_MANUAL=1 node --test --test-name-pattern="^M01 " manual.test.js` (here the doorbell); leave `runManual` in `config.json` at `false`.

More:

| Command | Runs |
|---|---|
| `node --test --test-name-pattern="^A19 " read.test.js` | One request (requests that need keys of earlier ones are skipped) |
| `node --test --test-reporter=junit --test-reporter-destination=report.xml read.test.js` | JUnit report |

Never run two test files in one command: `node --test` runs files in parallel.

## After a firmware update

1. Run `read.test.js` and `write.test.js` (steps 2 and 3).
2. Compare `fixtures/23-api-version.xml` and `fixtures/24-bluos-version.xml` with the versions in the reference.
3. Look at the failed tests: a changed answer goes into `docs/bluos-api.md`; a fixed player bug (e.g. E45) may change a decision of the app.
4. New fixtures for the UI tests (step 4).

## Fixtures

With `saveFixtures` every request stores its answer in `fixtures/` (git-ignored): the answers contain details of your network and library (IP addresses, share names, room name).

| Files | From | Used by |
|---|---|---|
| `NN-<name>.xml` | A01–A30 (`A19 Status` → `19-status.xml`) | The UI tests, after `sanitize-fixtures.js` |
| `explore-NN-*.xml` | E | Reading only |
| `verify-*`, `settings/` | V, C, W, S, P, M (V12: the settings tree) | Reading only |
| `state-*-write.json` | The snapshots of `write.test.js` | Reading only |

`sanitize-fixtures.js` copies only `NN-*.xml` to `tests/ui/fixtures/` and replaces IP addresses, room name, share and mount paths and USB drive ids. `23-api-version.xml` and `24-bluos-version.xml` record which player software the answers come from. The owner's private API tools add `wordlist/` and `crawl-endpoints.json`.

## Writing tests

- `lib/player.js` – configuration, requests (`send`, `http` with the axios options the scripts use), `save()` for fixtures, `dec` / `attr`, `expect()` (chai style: `expect(x).to.equal(y)`), `request(name, { method, url, headers, form, multipart, pre, post, tests })`.
- `lib/state.js` – the snapshot of the player state for `write.test.js`.
- `read/`, `write/`, `manual/` – the requests, one module per group, loaded in order by the test file; values pass from one request to the next through `vars`, so a test file runs in one process.
- Each request is one test: `pre(req)` may set `req.url`, `req.headers`, `req.body` or call `req.skip()`; `post(req, res)` saves fixtures and stores values in `vars`; `tests(req, res, test)` checks, each `test(name, fn)` is a subtest that runs at once.
- A new test gets the next free ID of its letter (IDs are not reused) and a row in [`test-cases.md`](test-cases.md).
- Every request sends `Accept-Language: en` (as the app) unless it sets its own. URLs are built with `encodeURIComponent` by the scripts and sent as they are.
- Loading a module (`require`, `node -e`) already runs its requests against the player (`node:test` starts every registered test); check a file with `node --check` only.
- `fetch` gives no body for HTTP 204, 205 and 304 (Fetch standard); `/alsa_setting` answers 205 with a body of one space, which the fixture therefore leaves out.
