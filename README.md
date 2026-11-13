# BluAlbum

[![Proudly Vibe Coded](https://vibecoded.fyi/badges/flat/main/proudly-vibe-coded.svg)](https://vibecoded.fyi/)

**Album player for BluOS devices.** A single HTML file that turns the music library of a
BluOS player (Bluesound, NAD, …) into an album wall: browse your albums by cover, filter
them, look at the details and play them, right in the browser.

> BluAlbum is an independent project and not affiliated with or endorsed by
> Lenbrook / Bluesound. BluOS is a trademark of Lenbrook Industries.

![BluAlbum: album wall filtered by CD quality, with the player bar at the bottom](docs/screenshots/screenshot.png)

## Features
- **Album wall** of the player's library (network share) and USB drive, loaded lazily
- **Filters as chips:** All, Favourites, New, quality (HD, CD, MQA), genres, saved playlists
- **Search** with the player's own search
- **Cover actions on hover:** play, add to the queue, favourite (managed by the player)
- **Random album** from the current view
- **Album details:** year, genres, quality, format, bit depth, sample rate, average bitrate,
  artist per track, number of tracks and playing time
- **Queue panel** (can be pinned): shuffle, repeat, remove tracks, save as playlist,
  delete a loaded playlist, clear
- **Player bar:** play/pause, previous/next, seek, volume, quality tag of the current track
- **Full-screen view** of the current track
- **Settings:** music sources, which chip groups are shown, cover size, light/dark/system design
- **About:** room name, BluOS and API version, library statistics

BluAlbum is about albums of your own music library. Streaming services, radio, presets and
inputs stay in the BluOS app.

## Use it
1. Download [`blualbum.html`](blualbum.html) (or the file from the latest release).
2. Open it in your browser (double click). Tested with Safari, Chrome and Microsoft Edge on macOS.
3. Enter the IP address of your player, e.g. `192.168.1.50`, and press **Connect**.
   You find the address in the BluOS Controller app under **Settings > Diagnostics**
   or in your router's device list.

BluAlbum talks to the player directly in your home network
(`http://<player>:11000`, the BluOS Custom Integration API).

Nothing is installed and no data leaves your network. Settings such as the last IP
address and the design are kept in the browser's local storage.

## Requirements
- A BluOS player with a music library (network share) and/or a USB drive, in the same network
- A current browser (tested with Safari, Chrome and Microsoft Edge)

Tested with BluOS 4.18.18 (API v0.5.43) on a Bluesound Powernode.

## Development
Everything is in [`blualbum.html`](blualbum.html): CSS, HTML and plain JavaScript, no build
step and no dependencies. The script is split into modules, listed at its top.

Tests:
- [`tests/api`](tests/api) – [Bruno](https://www.usebruno.com/) collection with contract tests
  for every player request the app uses (read-only and write tests) and exploration requests.
- [`tests/ui`](tests/ui) – Playwright tests of the user interface in Chrome, Safari (WebKit)
  and Edge against a mock player that answers with recorded (and sanitized) player responses.
  No player needed.
- [`tests/tools/sanitize-fixtures.js`](tests/tools/sanitize-fixtures.js) – copies recorded
  answers to the UI tests and removes personal details.

See [`CHANGELOG.md`](CHANGELOG.md) for the version history.

## License
[MIT](LICENSE) © 2026 Ingmar Gebert
