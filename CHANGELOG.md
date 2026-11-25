# Changelog

All notable changes to BluAlbum. Versions follow [semantic versioning](https://semver.org/): PATCH for fixes and visual changes, MINOR for new features.

## Unreleased
- Design: one consistent style for buttons, icons, corners and shadows; every button reacts to the mouse.
- Player: now playing reads "Title by Artist from Album (Year)".
- Sort order: the albums of a chip can be sorted by album title, album artist, year or randomly (the default).
- Sort order: sorted by album artist or year, the tiles show the year in front of the artist.
- Search: faster with many results (the player's result sections load in parallel).
- Search: the lines of the result groups read better, e.g. "3 albums with “Bernard Herrmann” as a track artist".
- Filter chips: a filter button in the header shows or hides the chip row for a clean album view.
- Filter chips: all chips have the same grey border, a separator sets the quality chips apart; the search, filter and queue buttons are highlighted while active.
- Status line: a genre chip shows its genre, e.g. "12 albums in the genre Jazz"; after a search the status line of the view comes back in full.
- Artist links: the track artists in the album and playlist popups, the queue and the player bar are links that search that artist in the search area Artist only.
- Fix: after the computer wakes up from sleep, the player bar shows the current track again at once instead of the one from before.

## 0.12.0
- Playlists: one "Playlists" chip after New shows the BluOS playlists as tiles like albums, with play, add to queue, delete and a popup with the track list.
- Playlists: a "Random playlist" tile plays or queues a random BluOS playlist.
- Playlists: the Playlists chip is always shown; its switch in the settings is gone.
- Playlists: the Playlists chip also shows the library playlists (imported playlist files), in a group after the BluOS playlists, with a heart to mark them as favourites.
- Playlists: tooltip, messages and the save prompt name the playlists "BluOS playlists", as the BluOS Controller does.
- Search: chips Album, Artist and Composer in the search field choose where to search (only Album on by default).
- Search: the search field is hidden until you click the search button next to the queue button.
- Search: the clear button (×) of the search field is well visible in the dark design.
- Search: the search area Artist also finds albums by their album artist (e.g. "Various"), shown in a group before the albums found by a track artist.
- Artist links: an album artist with commas (e.g. "Harold Budd, Brian Eno") shows one link per artist, which searches that artist in the search area Artist only.
- Fix: search results are no longer replaced by a view that finishes loading later.
- Quality, decade and genre chips load their albums faster.
- Decade chips appear faster.
- Fix: quality chips could show the albums of the previous source selection.
- Queue panel: change the order of the queue by drag and drop (or Alt + arrow up / down).
- Queue panel: the button for deleting the loaded playlist is gone (delete it on its tile instead).
- Fix: late errors no longer disturb the view, album or source selection opened after them, nor appear after closing the popup.
- Header shows the BluAlbum logo left of the title.
- About popup no longer shows the independence notice.

## 0.11.0
- About popup shows the BluAlbum logo.
- Search: also finds the albums of a composer.
- Search: results grouped by album title, artist and composer, each with its own status line.
- Album grid: a fine line under the status line.
- Player bar: the listening mode icon is grey in a subtle frame without hover effect, so it no longer looks like a button.
- Album grid: more space between the albums, growing with the cover size.
- Browser tab shows a BluAlbum icon (double note in a circle).
- Connecting stops after 5 seconds without an answer from the player and says so.
- Failed player requests open a popup with the request, its status and the player's answer.
- Decade chips: albums by decade, switched on in the settings (off by default).
- Settings: the chip switches have their own section "Filter chips".
- Quality and genre chips are off by default; switch them on under "Filter chips".
- Full-screen player shows the year next to the album.
- Album popup and full-screen player show the cover in full resolution.
- Album popup: track list divided by disc on albums with several discs.
- Album popup: track numbers in their own column; year on the artist line, total playing time in the album details.
- Fix: album popup showed the wrong track artist when a title appears on two discs.
- Album popup: no scroll bar over the track durations.

## 0.10.0
- Album popup shows the source icons of the player (USB, library).
- Player bar shows the listening mode as the icon of the player instead of a text tag.
- Fewer player requests for the search and the now playing cover.
- Fix: the page behind an open popup no longer scrolls along.
- Search only from 3 characters, also with Enter.
- Full-screen player: calm background in the colour of the cover instead of the blurred page.
- Album wall: title and artist on one line each; long texts fade out and scroll while the tile is hovered.

## 0.9.0
- Code cleanup after ESLint (no change in behaviour).
- Fix: artist view shows favourites with a filled heart.
- Player bar shows the listening mode (e.g. Music, Movie, TV) next to the volume controls.
- Fix: album popup track list empty in browsers set to a language other than English.
- Fix: no album covers in Firefox.

## 0.8.1
- Security: cover image URLs from the player are checked.
- Search while typing from 3 characters, after an 800 ms pause.
- Far fewer player requests (first connect 585 → 9).
- Album popup: no genre line any more.

## 0.8.0
- About popup: link to the GitHub repository.
- About popup: update check (on click).

## 0.7.6
- Queue: larger remove button.

## 0.7.5
- Queue: durations right-aligned, remove button on hover.

## 0.7.4
- Queue: remove button only on hover.

## 0.7.3
- Album popup: "9 tracks · 41:42" with a middle dot.

## 0.7.2
- Album popup: new order of the details.

## 0.7.1
- Album popup: favourite state only on the cover.

## 0.7.0
- Album popup: year, quality tag, technical data and artist per track.

## 0.6.30
- New library icon: folder with music notes.

## 0.6.29
- Fix: empty track list in Safari.

## 0.6.28
- About: room name, BluOS and API version.

## 0.6.27
- Queue: icons of "clear queue" and "delete playlist" swapped.

## 0.6.26
- Queue: new save and delete-playlist icons.

## 0.6.25
- Queue: remove icon is an x instead of a bin.

## 0.6.24
- Queue status: number of tracks and duration on two lines.

## 0.6.23
- Queue: repeat button.

## 0.6.21 – 0.6.22
- Queue: shuffle button shows its "on" state.

## 0.6.20
- Queue: shuffle button.

## 0.6.19
- Queue: no gap above the first track.

## 0.6.18
- Queue: track count and duration in the status bar.

## 0.6.17
- Quality chip "Hi-Res" renamed to "HD".

## 0.6.16
- Player bar: source icon (library / USB) removed.

## 0.6.15
- Player bar: drawn play/pause icons.

## 0.6.11 – 0.6.12
- New playlist icon.

## 0.6.10
- Separator between chip groups.

## 0.6.9
- Cover: "add to queue" shown as a plain +.

## 0.6.5 – 0.6.8
- Album popup: larger two-column layout, actions only on the cover.

## 0.6.3 – 0.6.4
- Renamed to **BluAlbum**.

## 0.6.2
- Code restructured into modules (no change in behaviour).

## 0.1.0 – 0.6.1
Initial development: album wall, chips, search, album popup, queue, player bar, settings.
