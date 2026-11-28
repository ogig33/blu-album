# BluAlbum – test concept

How BluAlbum is tested: the test levels and how they connect, the test environments, when which tests run, and the rules for every test. How to run each level: [`api/README.md`](api/README.md), [`ui/README.md`](ui/README.md).

## Test levels

| Level | Checks | Test cases | Runs against |
|---|---|---|---|
| API tests (`api/`) | The player answers as the app and the API reference [`docs/bluos-api.md`](../docs/bluos-api.md) expect (contract tests: structure of the answers, not concrete albums or numbers) | [`api/test-cases.md`](api/test-cases.md) | The owner's real player (Node.js) |
| UI tests (`ui/`) | The app does what its test cases say: what the user sees and which requests reach the player | [`ui/test-cases.md`](ui/test-cases.md) | A mock player with recorded answers, or the real player (Playwright) |
| Manual checks | What the automation cannot reach: the Safari app itself, Safari on iPhone and iPad | ENV-4, ENV-5 below | The real player |

The API tests record the answers that the UI tests replay:

```
real player ──API tests A01–A30──▶ api/fixtures/ (personal data, git-ignored)
            ──api/sanitize-fixtures.js──▶ ui/fixtures/ ──▶ ui/mock-player.js ──▶ UI tests
```

So the mock answers like the firmware the fixtures were recorded with, and a firmware change shows up first in the API tests.

## Test environments

The test cases are the same in every environment; the environments differ in execution, platform, scope and player.

| ID | Environment | Execution | Platform (OS, browsers) | Scope | Player / data | Run |
|---|---|---|---|---|---|---|
| ENV-1 | UI, local, mock | Automated | macOS: Chrome (installed app), Safari (Playwright's WebKit) | 1200x800 (other sizes with `--viewport`); the 50 local tests, about 30 seconds; every case with `--all`, about 2.5 minutes | Mock player, fixtures | `npm test` in `tests/ui`; all: `npm run test:all` |
| ENV-2 | UI, remote (GitHub Actions), mock | Automated | macOS: Safari (WebKit), Chrome · Windows: Edge, Chrome, Firefox · Linux: Chrome, Firefox | 1280x800, 1440x900@2, 1920x1080; every case; screenshots of the main views as artifact | Mock player, fixtures | `.github/workflows/ui-tests.yml`: push, pull request, Mondays, on demand |
| ENV-3 | UI, local, real player | Automated | macOS (home network): Chrome, Safari (WebKit) | 1200x800; the cases marked read (with `--write` also write), one at a time | Owner's player, live answers | `node run.js --player <ip>` (read) or `--player <ip> --write` |
| ENV-4 | Safari app, real player | Manual | macOS: the Safari app (Playwright's WebKit is its engine, not the app) | Main views; the Safari pitfalls of `CLAUDE.md` (popup track list of a long album, old cached file) | Owner's player | By hand |
| ENV-5 | iOS Simulator, real player | Manual | macOS: Xcode's iOS Simulator, Safari on iPhone (portrait, landscape) and iPad | Main views, IP entry with the touch keyboard, no zoom after focusing a field, nothing under the camera housing in landscape, full-screen cover not cut off | Owner's player | Serve the folder (`python3 -m http.server 8000`), open `http://localhost:8000/blualbum.html` in the simulator; by hand |
| ENV-6 | API, local, real player | Automated | Node.js 20 on the home network | `read.test.js` (reads only), `write.test.js` (changes and restores), single requests of `manual.test.js` | Owner's player | `node --test read.test.js` / `write.test.js` in `tests/api` |
| ENV-7 | UI, remote (GitHub Actions), phones and tablets emulated, mock | Automated | macOS: Safari (WebKit) as iPhone 15 and iPad (gen 11) · Linux: Chrome as Pixel 7 | Window size, pixel ratio, user agent and touch screen of the device (`any-pointer: coarse`, `hover: none`); every case except those that need a mouse or check the desktop layout | Mock player, fixtures | `.github/workflows/ui-tests.yml`, job "mobile"; locally `node run.js --all --browser safari --device "iPhone 15"` |

In the UI environments the app runs as a `file://` page in a fresh browser profile per case. The emulation of ENV-7 checks layout and touch handling; it does not show the iOS quirks of ENV-5 (zoom on focus, safe areas, the toolbar in `vh`, the touch keyboard).

## When which tests run

| Occasion | Tests | Environment |
|---|---|---|
| While changing the app | The local UI tests; the UI tests of the changed block (`--only <block>-`) | ENV-1 |
| Unknown player behaviour, before using it | A new or extended API test, run on its own | ENV-6 |
| Before a push | Every UI test; lint, format and CodeQL (commands in the root README "Development") | ENV-1 (`npm run test:all`) |
| Push, pull request, Mondays, on demand | Every UI test in every browser, system and window size, and on emulated phones and tablets; lint, format and CodeQL (CodeQL also weekly) | ENV-2, ENV-7 |
| After a layout change | The UI tests on an emulated phone (`--device`); main views on touch screens | ENV-7, ENV-5 |
| After a firmware update | `read.test.js` and `write.test.js`, new fixtures, every UI test; optionally the UI tests against the player | ENV-6, ENV-1, ENV-3 |
| Before a release | The Safari app | ENV-4 |

## Test IDs

- **UI**: `<block>-<number>`, e.g. `QUE-04`. A UI test case is one function of the app; the name of each UI test starts with the IDs of the cases it covers.
- **API**: `<letter><number>`, the letter by purpose: **A** read requests of the app, **C** commands of the app, **E** API behaviour the app relies on, **V** reference reads, **W** queue and playback, **S** settings and playlists, **P** parameters found by the crawler, **M** manual. An API test case is one request; requests that build on each other (e.g. change, check, restore) are consecutive IDs.
- IDs of removed cases are not reused; gaps stay.

## Rules

- **No hard-coded test data.** Fixtures are re-recorded after firmware updates or library changes, and the real player's library changes all the time. Expected values are derived at test time from the answers of the player the tests run against: count elements instead of writing numbers; pick names (artist, album, genre, playlist, room) by a rule (e.g. "the artist of the first favourite that has albums"); compute technical data with the app's rules. Only values that are part of the app itself may be literal: UI texts, `APP` constants, endpoint names, and values the test sets itself.
- **Only your own player.** Read runs change nothing. Write runs restore every change and check that at the end; their test playlists and names start with `__`. Manual API requests run only one by one, on purpose.
- **No window size.** UI tests use `VIEWPORT` for coordinates. A test that needs hover or the mouse wheel is marked `mouse: true`, one that checks the desktop layout `desktop: true`; both are skipped on emulated devices.
- **Local limit.** At most 50 UI tests are marked `local` (about 30 seconds, so a local run stays within 5 minutes); there is no limit on the total.
- **No dependencies of the app.** Test tools (Playwright, Node.js) stay in `tests/`; the API tests need no packages at all.

## Keeping tests and docs in step

- A new or changed function of the app gets a test case in [`ui/test-cases.md`](ui/test-cases.md) and a UI test whose name starts with its ID, with a mark in the column Local and, when it can run against the real player, `real: "read"` or `"write"` (the column "Real player" follows from `node run.js --list`).
- A new player request of the app is first verified by an A or C test (`api/`), then answered by `ui/mock-player.js`.
- A new or changed endpoint in `docs/bluos-api.md` is verified by a V, W, S, P or M test.
- Every added or removed API test is listed in [`api/test-cases.md`](api/test-cases.md).
- After recording new fixtures, every UI test runs without changes to `run.js` (the expected values come from the fixtures).
