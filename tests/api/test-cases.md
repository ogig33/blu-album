# BluAlbum – API test cases

Every API test, one request each, grouped by test file and purpose. Test concept and ID rules: [`tests/README.md`](../README.md#test-ids); running the tests: [`README.md`](README.md).

- **ID**: the letter names the purpose (see the blocks below); consecutive IDs build on each other (e.g. change, check, restore). IDs of removed tests are not reused.
- **Request**: the request as sent; `…` stands for a value taken from an earlier answer (keys, names, URLs of the player). Port 11000 unless marked `:80`.
- **Checks**: the subtests; a request without checks only records its answer.
- **Notes**: what the test is for, what it needs and when it is skipped. A note on the first ID of a range (e.g. "C01–C04: …") applies to the whole range.

Requests run in the order of this list: later requests use values found by earlier ones, so a test file always runs as a whole (a single request with `--test-name-pattern` skips what it cannot find).

## 1 Read – `read.test.js`

Changes nothing on the player.

### A – Read requests of the app

Every read request of the app, as the app sends it (contract). Each answer is stored as fixture `NN-<name>.xml` (A19 → `19-status.xml`), the source of the UI fixtures.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| A01 | Top menu | `/Browse?withContextMenuItems=1` | HTTP 200; has a library or USB source; has the saved playlists entry (icon ci_myplaylists) | Keys of library, USB and BluOS playlists for the following requests. |
| A02 | Library menu | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; has a searchKey; has a Genres entry (key contains GG/Genres); has an albums entry (key contains bySection:Album); has stats entries for Artist, Song, Composer |  |
| A03 | USB menu | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; has a searchKey; has a Genres entry (key contains GG/Genres); has an albums entry (key contains bySection:Album); has stats entries for Artist, Song, Composer | Skipped without a USB drive (as A14, A15, A26). |
| A04 | Genres | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; lists genres (type=genre) with text and browseKey |  |
| A05 | Genre menu | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; genre menu has entries |  |
| A06 | Album sections | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; A-Z sections with counts (text2) |  |
| A07 | Albums of a section | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; albums have text, text2, image, browseKey, playURL, contextMenuKey; inline context menu offers addAll-last | First filled section; its first album is used by A08–A10, A25, C05–C09 and C22–C25. |
| A08 | Album tracks | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; album has tracks (type=track) with text, playURL and duration |  |
| A09 | Album context menu | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; type=contextMenu; offers add-now and addAll-last; library album offers favourite-add or favourite-delete |  |
| A10 | Artwork | `/Artwork?…&followRedirects=1` | HTTP 200; returns an image | Cover of the first album; no fixture. |
| A11 | Library New | `/library/v1/Albums?service=…&recent=1` | HTTP 200; &lt;albums> with &lt;album> elements containing &lt;alb> and &lt;art>; paging via &lt;nextlink> when more than one page |  |
| A12 | Library Favourites | `/library/v1/Albums?service=…&category=FAVOURITES` | HTTP 200; every album is flagged isFavourite=1 |  |
| A13 | Library Quality CD | `/library/v1/Albums?service=…&quality=cd&limit=500&section=A` | HTTP 200; sectioned answer: &lt;albums>&lt;sections> (may be empty for this letter); albums (if any) have tracks attribute, &lt;title> and &lt;art> | Section A only (as A15). |
| A14 | USB New | `/library/v1/Albums?service=…&recent=1` | HTTP 200; &lt;albums> with &lt;album> elements containing &lt;alb> and &lt;art> |  |
| A15 | USB Quality CD | `/library/v1/Albums?service=…&quality=cd&limit=500&section=A` | HTTP 200; sectioned answer: &lt;albums>&lt;sections> (may be empty for this letter); albums (if any) have tracks attribute, &lt;title> and &lt;art> |  |
| A16 | Saved playlists | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; playlists have text and a play URL (playURL or a play action) |  |
| A17 | Playlists names | `/Playlists` | HTTP 200; &lt;playlists> with &lt;name> elements (the name may carry an image attribute) |  |
| A18 | Search | `/Browse?key=…&q=a&withContextMenuItems=1` | HTTP 200; search returns entries | Library search for `a`. |
| A19 | Status | `/Status` | HTTP 200; has etag, state and volume; when playing: title1-2, service, serviceType, streamFormat, secs; when playing an input: title1, service Capture, serviceType AudioInputs, secs; when playing from the queue: title3 and totlen | The fixture shows what plays at the time of the run. |
| A20 | Queue | `/Playlist?start=0&end=19` | HTTP 200; &lt;playlist> with length attribute; songs have title, art, alb (and time) | First 20 entries; empty without a queue. |
| A21 | Settings | `/Settings` | HTTP 200; has zonename (room name) |  |
| A22 | Volume | `/Volume` | HTTP 200; &lt;volume> with db attribute |  |
| A23 | API version | `/Version` | HTTP 200; &lt;version> like v0.5.43 |  |
| A24 | BluOS version | `/GitVersion` | HTTP 200; &lt;version> like 4.18.18 |  |
| A25 | Album songs | `/library/v1/Songs?service=…&album=…&artist=…` | HTTP 200; album has songs; songs have title, art, date, quality; songs have atype, samplerate, bitrate, channels |  |
| A26 | USB album songs | `/library/v1/Songs?service=…&album=…&artist=…` | HTTP 200; album has songs; songs have title, art, date, quality; songs have atype, samplerate, bitrate, channels |  |
| A27 | Listening mode | `/audioPreset` | HTTP 200; setting preset of class list; at least two modes with name and displayName; current value is one of the modes; url points to alsa_setting |  |
| A28 | Playlist tracks | `/Browse?key=…&withContextMenuItems=0` | HTTP 200; type=tracks with the play URL of the playlist; tracks have text, text2 (artist • album), duration and autoplayURL of the playlist; nextKey (/Songs?playlist=…&offset=10) only with more than 10 tracks | First BluOS playlist, as the playlist popup asks it. |
| A29 | Library playlists | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; type=playlists; playlists have text, browseKey, contextMenuKey and a play URL /Load?service=LocalMusic; context menu: add-last, no delete (a library playlist cannot be changed through the player) | Link "Playlists" of the library menu. |
| A30 | Library playlist tracks | `/Browse?key=…&withContextMenuItems=0` | HTTP 200; type=tracks with the play URL of the playlist; tracks have text, text2, duration and an autoplayURL of the playlist | First library playlist; skipped without one. |

### E – API behaviour the app relies on

Variants, workarounds and player bugs behind the app's endpoint choices, decisions and known pitfalls, and one open proposal (E18). Answers go to `fixtures/explore-NN-*.xml`.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| E09 | Album tracks without context menus | `/Browse?withContextMenuItems=0&key=…` | HTTP 200; album has tracks; tracks have text, duration and a play URL; no context menus | As the album popup asks the track list. |
| E10 | Artist menu (library) | `/Browse?withContextMenuItems=1&key=…:MG/LocalMusic-Artist?artist=…` | HTTP 200; menu with an Albums link (key contains :Album/) | E10–E11: albums of an artist as the artist view asks them. |
| E11 | Albums of the artist (library) | `/Browse?withContextMenuItems=1&key=…` | HTTP 200; list of albums, no further pages; albums have browseKey, playURL, contextMenuKey, image; context menus with add-last action; contains the album the artist came from | Contains the album the artist came from. |
| E12 | USB - artist menu | `/Browse?withContextMenuItems=1&key=…:MG/LocalMusic-Artist?artist=…` | HTTP 200; menu with an Albums link (key contains :Album/) | E12–E13: the same for USB; skipped without a USB drive. |
| E13 | USB - albums of the artist | `/Browse?withContextMenuItems=1&key=…` | HTTP 200; list of albums with playURL; no favourite actions on USB |  |
| E17 | Albums of a favourite's artist | `/Browse?withContextMenuItems=1&key=…:Album/…artist=…` | HTTP 200; list contains the favourite album; known: favourite album is not marked (no isFavourite=1 in the contextMenuKey); known: favourite album offers favourite-add instead of favourite-delete | Artist of the first favourite (A12). Known behaviour: the list does not mark favourites, so the app reads the favourites in parallel; a firmware that changes it shows up here. |
| E18 | Album list without context menus | `/Browse?withContextMenuItems=0&key=… (section of the favourite)` | HTTP 200; albums have browseKey, playURL, contextMenuKey, image; no context menus; section contains the favourite album; favourite stays marked without context menus; isFavourite attribute matches the context menu key | Open proposal: album lists without context menus (about a third of the data); the favourite state must stay. |
| E24 | Artwork - CORS header for fetch | `/Artwork?…&followRedirects=1` | HTTP 200; returns an image; allows fetch() from any origin | The app loads covers with `fetch()` from a `file://` page (Firefox upgrades plain image URLs to https). |
| E25 | Album tracks with a German browser language | `/Browse?withContextMenuItems=0&key=…` | HTTP 200 | Player bug: with a German `Accept-Language` some albums answer an empty menu; only records the track count. |
| E26 | Album tracks with Accept-Language en | `/Browse?withContextMenuItems=0&key=…` | HTTP 200; album has tracks | What the app sends. |
| E27 | Albums with songs of a composer | `/library/v1/Albums?service=LocalMusic&composer=…` | HTTP 200; answer has a root element, no error; at least one album | E27–E28: first composer of the library and the songs of its album; the console lists the tags per song (`composer`, `discno`). |
| E28 | Songs of the composer's album (tags) | `/library/v1/Songs?service=LocalMusic&album=…&artist=…` | HTTP 200; answer has a root element, no error; has songs |  |
| E29 | Albums of the artist Various (sampler) | `/library/v1/Albums?service=LocalMusic&artist=Various` | HTTP 200; answer has a root element, no error | E29–E30: a sampler with the album artist `Various` (`albumartist`, `compilation`); skipped without one. |
| E30 | Songs of the sampler (tags) | `/library/v1/Songs?service=LocalMusic&album=…&artist=Various` | HTTP 200; answer has a root element, no error; has songs |  |
| E31 | Artwork - full size with width and height | `/Artwork?…&width=3000&height=3000&followRedirects=1` | HTTP 200; returns an image; allows fetch() from any origin | As the album popup and the full screen ask the cover. Pixel size not checked (chunked answer): the original (at most 3000 px) with "Optimize Artwork" off and a rebuilt index, else 600 px; a cover file above 600 KB gives the grey placeholder (494 × 494 px). |
| E32 | Album tracks of a multi-disc album | `/library/v1/Search, /library/v1/Songs, /Browse?withContextMenuItems=0&key=…` | HTTP 200; songs span several discs; songs are sorted by disc and track; one track per song; tracks in the order of the songs: number and title match by position | First song with `discno` ≥ 2; the disc of a track is the `discno` of the song at the same position. |
| E33 | Queue entry of the playing song (year) | `/Playlist?start=…&end=…` | HTTP 200; exactly one song, the playing one; same title as /Status title1; &lt;date> is a year | As the full-screen view asks the year; skipped when nothing plays from the queue. |
| E34 | Albums of a section with year (library) | `/library/v1/Albums?service=…&limit=500&section=A` | HTTP 200; sectioned answer with albums; date (if present) is a four-digit year; most albums have a year | Year of the albums in sectioned lists (sort order, decade chips); the console counts albums per decade. |
| E37 | Search - which tags find an album | `/Browse (search key, link Albums)` | HTTP 200; a track artist finds the album; a song title does not find the album; a composer does not find the album | Album of the first composer; a term counts only when it is not in the album title, the album artist or a track artist. |
| E38 | Search - albums of a found composer | `/Browse (search, Composers, composer menu, Albums)` | HTTP 200; the search menu has a link Composers; the composers list has the composer with a browse key; the composer menu links to Albums; albums list with play URLs and context menus; contains the first album of /library/v1/Albums?composer= | As the app follows a composer found by the search. |
| E40 | Search - album artist does not find an album | `/Browse (artists list, search, artist albums)` | HTTP 200; the albums of the album artist contain the album; a search for the album artist does not find the album | Album artists from the library's artists list (`Various` first): the first with an album whose title and track artists do not contain the name. Basis of the app's own album artist match. |
| E41 | Decade index without ui (library) | `/library/v1/Albums?service=LocalMusic&section=all&length=1&sort=decade` | HTTP 200; only the index, no albums; section names are decades (four digits ending in 0); decades and counts = the years of the A-Z sections | E41–E42: the index the decade chips use; E42 skipped without a USB drive. |
| E42 | Decade index without ui (USB) | `/library/v1/Albums?service=<USB>&section=all&length=1&sort=decade` | HTTP 200; only the index, no albums; section names are decades (four digits ending in 0); decades and counts = the years of the A-Z sections |  |
| E43 | All albums and quality in one request | `/library/v1/Albums?…&section=all (also with quality=…)` | HTTP 200; the library has albums; as many albums as the index counts; same albums as the requests per section; category, recent and composer are ignored | Library and USB; also shows a cut-off in a large library. |
| E44 | Genre albums in one request | `/library/v1/Albums?…&genre=…&section=all` | HTTP 200; as many albums as /Browse; same order, favourite state and URLs as /Browse | The first genre and the first with an encoded character; URLs built like `libAlbum()` of the app. |
| E45 | MQA songs without MQA albums | `/library/v1/Albums?…&quality=mqa&section=all` | HTTP 200; a song of the MQA songs filter; its album is in no quality list (player bug) | Player bug (empty MQA chip); skipped without `mqaBrowse` songs; a failure after a firmware update may mean the bug is fixed. |
| E46 | Album artists in one request | `/library/v1/Artists \| Songs \| Composers?…&section=all` | HTTP 200; same artists as the requests per section; Songs and Composers list nothing with section=all | Album artists for the app's album artist search. |
| E47 | Album filter combinations | `/library/v1/Albums with filter combinations` | HTTP 200; a genre with some albums of the artist; artist + genre = albums of the artist in the genre; artist + quality = albums of the artist in the quality; genre or quality alone answer empty; category=FAVOURITES + genre = favourites in the genre; artist wins over category=FAVOURITES; recent=1 lists at most 1000 albums; recent=1 + genre = newest albums in the genre; expr wins over artist; expr + quality = hits in the quality; expr + genre answers empty; year, album artist, label, format and other tags are ignored | Album artist with the most albums and a genre with some of its albums. |
| E48 | Song and artist filter combinations | `/library/v1/Songs, Artists, Composers with filter combinations` | HTTP 200; artist = album artist or track artist; artist finds a track artist that is no album artist; artist + genre = songs of the artist on albums of the genre; artist + quality = songs of the artist in the quality; genre or quality alone answer empty; year, album artist, disc, format and title are ignored; composer wins over artist; composer + quality = songs of the composer in the quality; expr finds song titles only; expr + quality = hits in the quality; Artists: expr finds artist names; Artists: genre filters with section=all; Composers ignore artist | Artist and genre of E47. |
| E49 | Search with quality and genre filters | `/library/v1/Search?…&expr=…&quality=… \| genre=… \| listindex=…` | HTTP 200; quality=hr: only hi-res songs (quality hd), the same as quality=hd; quality=cd: only CD songs; quality=hr: only albums of the hi-res album list; unknown quality: no songs, albums or artists; genre filters songs or artists, only albums of the genre; listindex is only echoed (start / end), same songs | `hr` = `hd`; an unknown quality lists nothing. |

### V – Reference reads

Read endpoints of the API reference [`docs/bluos-api.md`](../../docs/bluos-api.md) the app does not use. Answers go to `fixtures/verify-*`. Write endpoints of the reference are in W, S, P and M; `/PlayTestSound`, `/SetInitialized`, `/SetMaster`, `/AddShare`, `/RemoveShare` are M42–M45. Not sent: `/ExternalSource` (needs the input id of a chassis player), `/MovePlayback` (needs a second player outside the group), `/library/v1/AddFavourite` without parameters. Not called: `/ui/action` (changes the display), `/ui/clearUsageHistory` without a confirmation (M13).

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| V01 | SyncStatus | `/SyncStatus` | HTTP 200; root SyncStatus with etag, syncStat, id, name, model, volume; id is &lt;ip>:&lt;port> |  |
| V02 | Presets | `/Presets` | HTTP 200; root presets with prid; every preset has id, name and url |  |
| V03 | Inputs (RadioBrowse Capture) | `/RadioBrowse?service=Capture` | HTTP 200; root radiotime with service=Capture; every item has text and URL |  |
| V04 | Services | `/Services` | HTTP 200; answer is XML with a root element |  |
| V05 | Settings audio | `/Settings?id=audio` | HTTP 200; root settings; has setting elements with id |  |
| V06 | Settings capture (schema 32) | `/Settings?id=capture&schemaVersion=32` | HTTP 200; root settings; has a menuGroup capture |  |
| V07 | Network shares page (port 80) | `:80 /sharecfg?noheader=1` | HTTP 200; answer is an HTML page |  |
| V08 | First new album (library) | `/library/v1/Albums?service=LocalMusic&recent=1` | HTTP 200; at least one album |  |
| V09 | Add to playlist options (album) | `/AddToPlaylistOptions?service=LocalMusic&album=…&artist=…` | HTTP 200; answer is XML without error |  |
| V10 | Library playlists (imported) | `/library/v1/Playlists?service=LocalMusic&imported=1` | HTTP 200; answer is XML without error |  |
| V11 | Library playlists (favourites) | `/library/v1/Playlists?service=LocalMusic&category=FAVOURITES` | HTTP 200; answer is XML without error |  |
| V12 | Settings tree (all menus) | `/Settings?schemaVersion=36 and every menu page` | HTTP 200; top level is a settings tree; sub pages read | Every menu page, no buttons; to `fixtures/settings/` with all endpoints found in `_summary.txt`. |
| V13 | UI home screen | `/ui/Home` | HTTP 200; answer has a root element, no error | V13–V30: screens of the BluOS app. |
| V14 | UI sources | `/ui/Sources` | HTTP 200; answer has a root element, no error |  |
| V15 | UI queue | `/ui/Queue?offset=0` | HTTP 200; answer has a root element, no error |  |
| V16 | UI presets | `/ui/presets` | HTTP 200; answer has a root element, no error |  |
| V17 | UI my playlists row (library) | `/ui/myPlaylistsRow?service=LocalMusic` | HTTP 200 or 204; no error |  |
| V18 | UI saved playlists (BrowseObjects) | `/ui/BrowseObjects?browseIndex=0&menuGroupId=BluOS&service=BluOS&type=Playlist&url=%2FPlaylists%3Fservice%3DBluOS%26myPlaylists%3D1` | HTTP 200; answer has a root element, no error |  |
| V19 | UI playlist page (browseContext) | `/ui/browseContext?service=BluOS&type=Playlist&title=…&url=…` | HTTP 200; answer has a root element, no error |  |
| V20 | UI playlist context menu | `/ui/ContextMenu?context=Playlist&service=BluOS&playlist=…&title=…` | HTTP 200; answer has a root element, no error |  |
| V21 | UI favourites (library) | `/ui/Favourites?service=LocalMusic&singleService=1&title=My+Favourites` | HTTP 200; answer has a root element, no error |  |
| V22 | UI recently played | `/ui/RecentlyPlayed` | HTTP 200; answer has a root element, no error |  |
| V23 | UI queue entry context menu | `/ui/queueItemCM?id=0` | HTTP 200; answer has a root element, no error |  |
| V24 | Save queue options | `/AddToPlaylistOptions?saveQueue=1` | HTTP 200; answer has a root element, no error |  |
| V25 | UI configuration | `/ui/Configuration` | HTTP 200; answer has a root element, no error |  |
| V26 | UI now playing context menu | `/ui/nowPlayingCM` | HTTP 200; answer has a root element, no error |  |
| V27 | UI search in the library | `/ui/Search?forService=LocalMusic&q=a` | HTTP 200; answer has a root element, no error |  |
| V28 | UI library menu | `/ui/browseMenuGroup?service=LocalMusic` | HTTP 200; answer has a root element, no error |  |
| V29 | UI artists of the library | `/ui/browseGrouped?browseIndex=0&menuGroupId=LocalMusic&service=LocalMusic&title=Artists&type=Artist&url=%2Flibrary%2Fv1%2FArtists%3Fservice%3DLocalMusic` | HTTP 200; answer has a root element, no error |  |
| V30 | UI genres of the library | `/ui/browseGenres?genreGroupId=Genres&service=LocalMusic&title=Genres&url=%2Flibrary%2Fv1%2FGenres%3Fservice%3DLocalMusic` | HTTP 200; answer has a root element, no error |  |
| V31 | Network shares | `:80 /Shares` | HTTP 200; no error | Port 80. |
| V32 | Diagnostics page (port 80) | `:80 /diag?noheader=1&playnum=1` | HTTP 200; no error answer |  |
| V33 | Diagnostics page 2 (port 80) | `:80 /diagnostics?noheader=1&playnum=1` | HTTP 200; no error answer |  |
| V34 | Support request page (port 80, not sent) | `:80 /settings/sendSupportRequest?noheader=1` | HTTP 200; no error answer | Only read, nothing is sent. |
| V35 | Support request settings as web view | `/Settings?view=web&id=sendSupportRequest` | HTTP 200; no error answer |  |
| V36 | Data export (port 80) | `:80 /Dataexport` | HTTP 200; no error answer |  |
| V37 | Error message 1 (read, not cleared) | `/error?1` | HTTP 200 | Not cleared. |
| V38 | UI news | `/ui/News` | HTTP 200; no error answer |  |
| V39 | UI resolveSoviURL (no parameters) | `/ui/resolveSoviURL` | – |  |
| V40 | UI prf with a read request (Volume) | `/ui/prf?u=%2FVolume` | HTTP 200; answer of /Volume passed through | Runs a read request (`/Volume`). |
| V41 | Library artists (section A) | `/library/v1/Artists?service=LocalMusic&section=A` | HTTP 200; answer has a root element, no error |  |
| V42 | Library composers | `/library/v1/Composers?service=LocalMusic` | HTTP 200; answer has a root element, no error |  |
| V43 | Library search | `/library/v1/Search?service=LocalMusic&expr=a` | HTTP 200; answer has a root element, no error |  |
| V44 | Library albums of an artist | `/library/v1/Albums?service=LocalMusic&artist=…` | HTTP 200; answer has a root element, no error |  |
| V45 | Library album (album and artist) | `/library/v1/Albums?service=LocalMusic&album=…&artist=…` | HTTP 200; answer has a root element, no error |  |
| V46 | Library folders (root) | `/library/v1/Folders?service=LocalMusic` | HTTP 200; answer has a root element, no error |  |
| V47 | Info lyrics of the playing track | `/Info?lyricsid=…&service=…` | HTTP 200; answer has a root element, no error | Only when `/Status` has a `lyricsid` (e.g. Radio Paradise). |
| V48 | Diagnostics log (port 80, print) | `:80 /diag?print=1` | HTTP 200 | V48–V51: candidates from other BluOS clients. |
| V49 | Settings expanded | `/Settings?expand=1` | HTTP 200 |  |
| V50 | audiomodes read (GET without parameters) | `/audiomodes` | HTTP 200 |  |
| V51 | Paths that should not exist | `12 paths (see notes)` | HTTP 200; all answer 404 | Must answer 404: `/Mute`, `/ZoneStatus`, `/Players`, `/Sources`, `/GroupStatus`, `/PlayQueue`, `/CoverArt`, `/RadioDeletePreset`, `/Search`, `/RadioSearch`, `/captures`, `/ui/reportServiceDuration`. |
| V52 | Playlists sorted and filtered | `/Playlists?service=BluOS&sort=recent \| sort=alpha \| playlist=…` | HTTP 200; sort=recent and sort=alpha list the same playlists; playlist=&lt;name> gives only that playlist; unknown playlist name answers 'not found' | V52–V55: findings of `private/tools/crawl-endpoints.js`. |
| V53 | Presets edit with GET (405) | `/Presets/edit?prid=…` | GET answers 405 (endpoint exists, other method) |  |
| V54 | Music services page (port 80) | `:80 /services?…, :11000 /services` | HTTP 200; HTML page 'Configure Music Services'; links to the sign-in pages of the services; not on port 11000 (404) |  |
| V55 | UI context menu of a radio favourite | `/ui/ContextMenu?… with and without is_preset, inputType` | HTTP 200; is_preset=1: 'Remove favourite' with /DeleteFavourite?id=; inputType=station: 'Related stations' and 'Add preset'; without is_preset: 'Favourite' with /AddFavourite?preset_id=; without inputType: only 'Remove favourite' | First TuneIn favourite station; skipped without one. |
| V56 | Upgrade message (update) | `/update` | HTTP 200; root element update | `no message` without a pending upgrade. |
| V57 | UI testing screen | `/ui/testing` | HTTP 200; root element screen; rows, buttons, teasers and thumbnails; app links with iosApp / androidPackage / desktopApp | V57–V62: findings of `private/tools/build-wordlist.js` and ffuf. |
| V58 | New read endpoints (BTDevices, ui playlist and work, Works) | `/BTDevices, /ui/playlist, /ui/work, /Works, /Album` | HTTP 200; BTDevices: root btdevices with etag and connecting; ui/playlist: root playlists; ui/work: root works; Works: works or an error of Idagio; Album (in the app's code) does not exist: 404 | `/Album` (named in the code of the BluOS app) answers 404. |
| V59 | Spotify Connect info | `/spotifyconnect?action=getInfo` | HTTP 200; JSON answer; status 101 OK; deviceID and version |  |
| V60 | TLS ports (cert-bootstrap manifest, port 80) | `:80 /cert-bootstrap/manifest, https /SyncStatus` | HTTP 200; JSON with tlsPorts, 443 among them; a TLS port answers /SyncStatus |  |
| V61 | Redirects of Settings and imported Playlists | `/Settings, /Playlists?imported=1 (no redirect followed)` | Settings: 301 to port 11001; Playlists?imported=1: 302 to the library playlists on port 11004 |  |
| V62 | Unverified reads (GetUnpairedSlaves, state, Removable) | `/GetUnpairedSlaves, /state, /Removable` | GetUnpairedSlaves: 200 with unpairedSlaves, or 400; state: HTTP 200, empty; Removable: HTTP 200, empty | `/GetUnpairedSlaves` answers 400 on the primary of a fixed group. |

## 2 Write – `write.test.js`

Changes the player and restores it.

### Start state and order

- Before the first request the run takes a snapshot of the player state (`lib/state.js`: status, name, queue, settings `player` and `audio`, listening mode, playlists, presets, favourite albums, songs, artists).
- When the player does not play or pause from a queue of at least 11 entries, the run saves the queue as `__bluos_api_test_start__`, queues library albums (their "Add last" URLs from `/Browse`) and plays them.
- Then A01–A30 run (C uses their keys), then C, W, S, P in this order.
- At the end: the queue of the start is loaded again (when the run set it up), the queue position and play state of the start are restored, and a second snapshot is compared with the first. A failed subtest names the value that was not restored. Both snapshots go to `fixtures/state-*-write.json`. A radio stream or an input playing at the start is not restored.

### C – Commands of the app

Every command the app sends (contract): favourite, play album, pause, resume, skip, back, play queue entry, seek, add to queue, remove, shuffle, repeat, volume, clear, save / load / delete playlist.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| C01 | Remember state | `/Status` | HTTP 200; status readable | C01–C04: the queue is saved as `__bluos_album_player_test__`; C44 loads it again. |
| C02 | Remember queue | `/Playlist?start=0&end=0` | HTTP 200; queue is not empty |  |
| C03 | Save queue as test playlist | `/Save?name=__bluos_album_player_test__` | HTTP 200; &lt;saved>&lt;entries>N&lt;/entries> with N > 0 |  |
| C04 | Test playlist exists | `/Playlists` | HTTP 200; test playlist is listed |  |
| C05 | Favourite toggle | `/AddFavourite or /DeleteFavourite (from the context menu)` | HTTP 200; accepted | C05–C07: album of A07 / A09. |
| C06 | Favourite state changed | `/Browse?key=…&withContextMenuItems=1` | HTTP 200; opposite favourite action offered |  |
| C07 | Favourite restore | `the opposite of C05` | HTTP 200; accepted |  |
| C08 | Play album now | `/Add?playnow=1… (playURL of the album)` | HTTP 200; accepted | Album of A07. |
| C09 | Status is playing the album | `/Status` | HTTP 200; state play/stream; title3 is the album |  |
| C10 | Pause toggle | `/Pause?toggle=1` | HTTP 200; answer has &lt;state> |  |
| C11 | Status is paused | `/Status` | HTTP 200; state pause |  |
| C12 | Pause toggle again (resume) | `/Pause?toggle=1` | HTTP 200; answer has &lt;state> |  |
| C13 | Status is playing again | `/Status` | HTTP 200; state play/stream |  |
| C14 | Skip to next track | `/Skip` | HTTP 200; accepted |  |
| C15 | Status is on the next track | `/Status` | HTTP 200; song index + 1 |  |
| C16 | Back | `/Back` | HTTP 200; accepted |  |
| C17 | Play queue entry 3 | `/Play?id=2` | HTTP 200; answer has &lt;state> | Needs 3 queue entries (the album of C08). |
| C18 | Status is on track 3 | `/Status` | HTTP 200; song index 2 |  |
| C19 | Seek to 0:30 | `/Play?seek=30` | HTTP 200; answer has &lt;state> |  |
| C20 | Status position after seek | `/Status` | HTTP 200; position about 30 s |  |
| C21 | Remember queue length | `/Playlist?start=0&end=0` | HTTP 200; length readable; playlist id readable | C21–C29 and C42–C45 also check that the playlist id (`/Playlist` id = `<pid>` of `/Status`) changes: the app reloads the queue only then. |
| C22 | Add album to end of queue | `/Add?…&where=last (context menu)` | HTTP 200; accepted | Album of A07. |
| C23 | Queue got longer | `/Playlist?start=0&end=0` | HTTP 200; length increased; playlist id changed after adding an album |  |
| C24 | Remove last queue entry | `/Delete?id=…` | HTTP 200; accepted |  |
| C25 | Queue got shorter | `/Playlist?start=0&end=0` | HTTP 200; length decreased by 1; playlist id changed after removing an entry |  |
| C26 | Shuffle on | `/Shuffle?state=1` | HTTP 200; accepted |  |
| C27 | Status shows shuffle on | `/Status` | HTTP 200; &lt;shuffle>1&lt;/shuffle>; playlist id changed after shuffle on |  |
| C28 | Shuffle off | `/Shuffle?state=0` | HTTP 200; accepted |  |
| C29 | Status shows shuffle off | `/Status` | HTTP 200; &lt;shuffle>0&lt;/shuffle>; playlist id changed after shuffle off |  |
| C30 | Remember repeat | `/Status` | HTTP 200; &lt;repeat> is 0, 1 or 2 |  |
| C31 | Repeat queue | `/Repeat?state=0` | HTTP 200; accepted |  |
| C32 | Status shows repeat queue | `/Status` | HTTP 200; &lt;repeat>0&lt;/repeat> |  |
| C33 | Repeat track | `/Repeat?state=1` | HTTP 200; accepted |  |
| C34 | Status shows repeat track | `/Status` | HTTP 200; &lt;repeat>1&lt;/repeat> |  |
| C35 | Repeat off | `/Repeat?state=2` | HTTP 200; accepted |  |
| C36 | Status shows repeat off | `/Status` | HTTP 200; &lt;repeat>2&lt;/repeat> |  |
| C37 | Repeat restore | `/Repeat?state=…` | HTTP 200; accepted |  |
| C38 | Volume set to 10 | `/Volume?level=10` | HTTP 200; volume is 10 |  |
| C39 | Volume up (+2 dB) | `/Volume?db=2` | HTTP 200; volume above 10 |  |
| C40 | Volume down (-2 dB) | `/Volume?db=-2` | HTTP 200; answer has a volume |  |
| C41 | Volume restore | `/Volume?level=…` | HTTP 200; volume restored |  |
| C42 | Clear queue | `/Clear` | HTTP 200; accepted |  |
| C43 | Queue is empty | `/Playlist?start=0&end=0` | HTTP 200; length 0; playlist id changed after clearing the queue |  |
| C44 | Load test playlist (restores the queue) | `/Load?service=BluOS&name=__bluos_album_player_test__` | HTTP 200; accepted | Leaves the queue at entry 0; the end of the run restores the position. |
| C45 | Queue restored from playlist | `/Playlist?start=0&end=0` | HTTP 200; same length as before the tests; queue reports the playlist name; playlist id changed after loading a playlist |  |
| C46 | Delete test playlist | `/Delete?service=BluOS&name=__bluos_album_player_test__` | HTTP 200; accepted |  |
| C47 | Test playlist is gone | `/Playlists` | HTTP 200; test playlist is no longer listed |  |

### W – Queue and playback

Reference commands for queue and playback.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| W01 | Remember state | `/Status` | HTTP 200; plays from the queue (no streamUrl) | W01–W15 need playback from the queue (see Start state). |
| W02 | Remember the first two queue entries | `/Playlist?start=0&end=1` | HTTP 200; queue has at least 2 entries |  |
| W03 | Move entry 0 to position 1 | `/Move?new=1&old=0` | HTTP 200; answer &lt;moved> |  |
| W04 | Queue order swapped | `/Playlist?start=0&end=1` | HTTP 200; former second entry is first now |  |
| W05 | Move it back | `/Move?new=0&old=1` | HTTP 200; answer &lt;moved> |  |
| W06 | Queue order restored | `/Playlist?start=0&end=1` | HTTP 200; original first entry is first again |  |
| W07 | Stop | `/Stop` | HTTP 200; answer &lt;state>stop&lt;/state> |  |
| W08 | Status is stopped | `/Status` | HTTP 200; state stop |  |
| W09 | Next preset | `/Preset?id=+1` | HTTP 200; answer &lt;state> or &lt;loaded> | W09–W11: skipped without a preset. |
| W10 | Status of the preset | `/Status` | HTTP 200; playing (play or stream) |  |
| W11 | Radio action skip | `/Action?… (skip action of /Status)` | HTTP 200; no error | Only when the station offers a skip action. |
| W12 | Back to the queue entry | `/Play?seek=…&id=…` | HTTP 200; answer has &lt;state> |  |
| W13 | Status is on the queue entry again | `/Status` | HTTP 200; same queue position as before; plays from the queue again (no streamUrl) |  |
| W14 | Pause again (if it was not playing) | `/Pause` | HTTP 200; answer &lt;state>pause&lt;/state> | Only when the player was not playing. |
| W15 | Volume restore | `/Volume?level=…` | HTTP 200; volume restored |  |

### S – Settings, playlists and name

Reads a setting, changes it, checks the new value and restores it.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| S01 | Player settings (remember ledbrightness) | `/Settings?schemaVersion=36&id=player` | HTTP 200; has ledbrightness |  |
| S02 | setting ledbrightness (change) | `/setting?ledbrightness=…` | HTTP 200; no error |  |
| S03 | Player settings show the new value | `/Settings?schemaVersion=36&id=player` | HTTP 200; ledbrightness changed |  |
| S04 | setting ledbrightness (restore) | `/setting?ledbrightness=…` | HTTP 200; no error |  |
| S05 | Player settings restored | `/Settings?schemaVersion=36&id=player` | HTTP 200; ledbrightness restored |  |
| S06 | Audio settings (remember values) | `/Settings?schemaVersion=36&id=audio` | HTTP 200; has replayGainMode and eq-balance |  |
| S07 | audiomodes replayGainMode (change) | `/audiomodes?replayGainMode=…` | HTTP 200; no error |  |
| S08 | Audio settings show the new replay gain | `/Settings?schemaVersion=36&id=audio` | HTTP 200; replayGainMode changed |  |
| S09 | audiomodes replayGainMode (restore) | `/audiomodes?replayGainMode=…` | HTTP 200; no error |  |
| S10 | Audio settings: replay gain restored | `/Settings?schemaVersion=36&id=audio` | HTTP 200; replayGainMode restored |  |
| S11 | alsa_setting eq-balance (change) | `/alsa_setting?eq-balance=…` | HTTP 200; no error |  |
| S12 | Audio settings show the new balance | `/Settings?schemaVersion=36&id=audio` | HTTP 200; eq-balance changed |  |
| S13 | alsa_setting eq-balance (restore) | `/alsa_setting?eq-balance=…` | HTTP 200; no error |  |
| S14 | Audio settings: balance restored | `/Settings?schemaVersion=36&id=audio` | HTTP 200; eq-balance restored |  |
| S15 | SlaveVolume trim of a group member (change) | `/SlaveVolume?…&db=…` | HTTP 200; no error | S15–S19: skipped without a fixed group. |
| S16 | Audio settings show the new trim | `/Settings?schemaVersion=36&id=audio` | HTTP 200; trim changed |  |
| S17 | SlaveVolume trim (restore) | `/SlaveVolume?…&db=…` | HTTP 200; no error |  |
| S18 | Audio settings: trim restored | `/Settings?schemaVersion=36&id=audio` | HTTP 200; trim restored |  |
| S19 | proxyToSlave SyncStatus of a group member (read) | `/proxyToSlave?slave=…&url=…/SyncStatus` | HTTP 200; answer is the SyncStatus of the member |  |
| S20 | Backup of the saved playlists (port 80, download) | `:80 /download_playlists_api` | HTTP 200 | Port 80 (as S22, S23). |
| S21 | redirectToCp to the services page | `/redirectToCp?href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0` | HTTP 200 |  |
| S22 | Wi-Fi settings page (port 80) | `:80 /wificfg?noheader=1` | HTTP 200; answer is an HTML page |  |
| S23 | IR learning page (port 80) | `:80 /triggercfg?noheader=1&playnum=1` | HTTP 200; answer is an HTML page |  |
| S24 | Status (remember infourl) | `/Status` | HTTP 200 | S24–S25: only when the playing item has an info URL. |
| S25 | Info for the playing item (infourl) | `/Info?service=…&infourl=…` | HTTP 200 |  |
| S26 | Save the queue as test playlist | `/Save?name=__bluos_verify__` | HTTP 200; saved with entries | S26–S30: test playlist `__bluos_verify__`. |
| S27 | First new album (library) | `/library/v1/Albums?service=LocalMusic&recent=1` | HTTP 200; at least one album |  |
| S28 | Add to playlist options (album) | `/AddToPlaylistOptions?service=LocalMusic&album=…&artist=…` | HTTP 200; has urlPath |  |
| S29 | AddToPlaylist album to the test playlist (name= is a guess) | `/AddToPlaylist?…&name=__bluos_verify__` | HTTP 200; no error; test playlist got longer |  |
| S30 | Delete the test playlist | `/Delete?service=BluOS&name=__bluos_verify__` | HTTP 200; no error |  |
| S31 | Remember the player name | `/Name` | HTTP 200; has a name | S31–S35: the player name gets " test" appended. |
| S32 | Rename the player (test name) | `/Name?set=… test` | HTTP 200; no error |  |
| S33 | Player has the test name | `/Name` | HTTP 200; name changed |  |
| S34 | Rename the player back | `/Name?set=…` | HTTP 200; no error |  |
| S35 | Player name restored | `/Name` | HTTP 200; name restored |  |
| S41 | Listening mode (remember) | `/audioPreset` | HTTP 200; current mode and another one | S41–S47: listening mode; checks with a long poll whether the etag reports it. |
| S42 | Status (remember etag) | `/Status` | HTTP 200; status with etag |  |
| S43 | alsa_setting preset (change) | `/alsa_setting?preset=…` | HTTP 205 (Reset Content, empty body); no error |  |
| S44 | Status long poll after the change | `/Status?timeout=10&etag=…` | HTTP 200; status answer; etag changed; syncStat increased |  |
| S45 | Listening mode shows the new mode | `/audioPreset` | HTTP 200; mode changed |  |
| S46 | alsa_setting preset (restore) | `/alsa_setting?preset=…` | HTTP 205 (Reset Content, empty body); no error |  |
| S47 | Listening mode restored | `/audioPreset` | HTTP 200; mode restored |  |
| S48 | Status (remember shuffle) | `/Status` | HTTP 200; has shuffle | S48–S52: does `/Shuffle` without `state` switch shuffle off? |
| S49 | Shuffle on (for the next step) | `/Shuffle?state=1` | HTTP 200 |  |
| S50 | Shuffle without state | `/Shuffle` | HTTP 200 |  |
| S51 | Status shows shuffle off | `/Status` | HTTP 200; shuffle is off after /Shuffle without state |  |
| S52 | Shuffle restore | `/Shuffle?state=…` | HTTP 200 |  |

### P – Parameters found by the crawler

Parameters of `/Add`, `/AddFavourite`, `/DeleteFavourite` and `/Move` found by `private/tools/crawl-endpoints.js`; every URL comes from `/Browse`. Answers go to `fixtures/verify-add-*.xml` and `fixtures/verify-*-favourite-*.xml`.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| P01 | Remember state and save the queue | `/Save?name=__bluos_verify_add__` | HTTP 200; &lt;saved>&lt;entries>N&lt;/entries> with N > 0 | The queue is saved as `__bluos_verify_add__`; P01–P14 are skipped when the player does not play from the queue. |
| P02 | Play the songs of a composer (composer=) | `/Add?… (autoplayURL)` | HTTP 200; answer &lt;playlist>, no error | Autoplay URL of a song of the first composer (`composer=`). |
| P03 | Status plays the composer song | `/Status` | HTTP 200; plays the song of the autoplayURL; plays from the queue (no streamUrl) |  |
| P04 | Favourite a song (AddFavourite fn=) | `/AddFavourite?fn=…` | HTTP 200; answer &lt;favourite>added&lt;/favourite> | A composer song that is no favourite yet, with the URL of its context menu. |
| P05 | Play the favourite songs (category=FAVOURITES) | `/Add?… (autoplayURL)` | HTTP 200; answer &lt;playlist>, no error | Autoplay URL of the first favourite song (`category=FAVOURITES`); P04 makes sure there is one. |
| P06 | Status plays the favourite song | `/Status` | HTTP 200; plays the song of the autoplayURL; plays from the queue (no streamUrl) |  |
| P07 | Favourite songs contain the song | `/Browse?key=…` | HTTP 200; the song is a favourite now; its menu removes it with /DeleteFavourite?fn= | Its menu gives the `/DeleteFavourite?fn=` of P08. |
| P08 | Remove the song favourite (DeleteFavourite fn=) | `/DeleteFavourite?fn=…` | HTTP 200; answer &lt;favourite>deleted&lt;/favourite> |  |
| P09 | Favourite songs no longer contain the song | `/Browse?key=…` | HTTP 200; the song is no favourite any more |  |
| P10 | Play the test playlist from its second page (offset=) | `/Add?… (autoplayURL)` | HTTP 200; answer &lt;playlist>, no error | First song on the second page of the playlist of P01 (`offset=`); skipped with 10 entries or fewer. |
| P11 | Status plays the song of the second page | `/Status` | HTTP 200; plays the song of the autoplayURL; plays from the queue (no streamUrl) |  |
| P12 | Load the saved queue | `/Load?service=BluOS&name=__bluos_verify_add__` | HTTP 200; accepted | P12–P14: the queue, position and pause state of P01 again. |
| P13 | Back to the former position | `/Play?seek=…&id=…` | HTTP 200; answer has &lt;state> |  |
| P14 | Delete the saved queue playlist | `/Delete?service=BluOS&name=__bluos_verify_add__` | HTTP 200; accepted; test playlist is gone; queue length as before P01; queue position as before P01; playing / paused as before P01 |  |
| P15 | Favourite an artist (AddFavourite artist=) | `/AddFavourite?artist=…` | HTTP 200; answer &lt;favourite>added&lt;/favourite> | P15–P18: the first library artist that is no favourite; independent of P01. |
| P16 | Favourite artists contain the artist | `/Browse?key=…` | HTTP 200; the artist is a favourite now (isFavourite=true); its menu removes it with /DeleteFavourite?artist= |  |
| P17 | Remove the artist favourite (DeleteFavourite artist=) | `/DeleteFavourite?artist=…` | HTTP 200; answer &lt;favourite>deleted&lt;/favourite> |  |
| P18 | Favourite artists no longer contain the artist | `/Browse?key=…` | HTTP 200; the artist is no favourite any more |  |
| P19 | Move entry 0 to position 3 | `/Move?new=3&old=0` | HTTP 200; answer &lt;moved> | P19–P22: skipped with fewer than 5 or more than 200 queue entries; a move gives a new queue id. |
| P20 | Queue order after the move | `/Playlist?start=0&end=199` | HTTP 200; entry 0 is now at position 3, entries 1–3 moved up by one; queue id (pid) changed |  |
| P21 | Move entry 3 back to position 0 | `/Move?new=0&old=3` | HTTP 200; answer &lt;moved> |  |
| P22 | Queue order restored | `/Playlist?start=0&end=199` | HTTP 200; order as before P19 |  |
| P23 | Favourite a library playlist and back (playlistid=) | `/AddFavourite?playlistid=…, /DeleteFavourite?playlistid=…` | HTTP 200; add: /AddFavourite?playlistid=… of the context menu answers added; the playlist is in category=FAVOURITES; the context menu key with &isFavourite=1 at the end offers /DeleteFavourite?playlistid=; remove answers deleted; the menu offers favourite-add again; no longer a favourite | The first library playlist that is no favourite; the menu is read with `&isFavourite=1` appended to the key (as the app does); skipped without a library playlist. |
| P24 | Library id in Status follows a favourite | `/Status, /library/v1/Albums, /AddFavourite, /DeleteFavourite` | HTTP 200; mid of /Status = library id; mid of the current /Status = library id | Favourites a library album and removes it, each time with a long poll on `/Status` open: `mid` follows the library id, the long poll answers within 5 s; skipped without a library album that is no favourite. |

## 3 Manual – `manual.test.js`

Requests with lasting or risky effects (reboot, rescan, firmware upgrade, radio favourites …). Every request is skipped unless `runManual` is set, also when it runs on its own; run them one by one (see [`README.md`](README.md#run)). M42–M45 write their results to `fixtures/verify-{playtestsound,setinitialized,setmaster,addshare}.json`.

| ID | Test case | Request | Checks | Notes |
|---|---|---|---|---|
| M01 | Doorbell (plays the chime) | `/Doorbell?play=1` | HTTP 200; answer &lt;status> with chime, or Not supported | Players without a chime answer `Not supported`. |
| M02 | Reindex the library | `/Reindex` | HTTP 200; no error | M02–M03: the rescan runs in the background for minutes. |
| M03 | Status while indexing | `/Status` | HTTP 200 |  |
| M04 | Presets (remember the first one) | `/Presets` | HTTP 200; at least one preset | M04–M06: no request to delete a preset is known – remove it in the BluOS app. |
| M05 | SetPreset test preset (delete it in the BluOS app afterwards) | `/SetPreset?name=__bluos_verify__&url=…&image=…` | HTTP 200; no error |  |
| M06 | Presets contain the test preset | `/Presets` | HTTP 200; preset __bluos_verify__ exists |  |
| M07 | Reboot | `POST :80 /reboot` | HTTP 200 | M07–M08: soft reboot; waits until `/SyncStatus` answers again (at most 5 minutes) and logs the time. |
| M08 | Player is back | `/SyncStatus` | HTTP 200; SyncStatus answers again |  |
| M09 | Saved playlists (remember names) | `/Playlists` | HTTP 200; at least one playlist | M09–M12: needs `saveFixtures`; the upload is skipped without a fresh backup. |
| M10 | Backup of the saved playlists (to a file) | `:80 /download_playlists_api` | HTTP 200; JSON array of playlists |  |
| M11 | Restore the same backup (upload) | `POST :80 /upload_playlists_api` | HTTP 200; no error answer |  |
| M12 | Saved playlists unchanged | `/Playlists` | HTTP 200; same playlists as before |  |
| M13 | Clear the recent stations (deletes the history) | `/ui/clearUsageHistory?stations=1` | HTTP 200; no error answer | The history is lost. |
| M14 | Diagnostics page (remember statistics setting) | `:80 /diagnostics?noheader=1&playnum=1` | HTTP 200; statistics switch found | M14–M18: while the collection is on, the player may send usage statistics to Bluesound. |
| M15 | Statistics collection (change) | `:80 /statistics?enable=…` | HTTP 200; no error answer |  |
| M16 | Diagnostics page shows the new setting | `:80 /diagnostics?noheader=1&playnum=1` | HTTP 200; statistics changed |  |
| M17 | Statistics collection (restore) | `:80 /statistics?enable=…` | HTTP 200; no error answer |  |
| M18 | Diagnostics page: statistics restored | `:80 /diagnostics?noheader=1&playnum=1` | HTTP 200; statistics restored |  |
| M19 | Rebuild index (delete_index, the library is scanned again) | `:80 /delete_index?noheader=1` | HTTP 200; no error answer | M19–M20: the library index is deleted and the whole library is scanned again. |
| M20 | Status after the rebuild request | `/Status` | HTTP 200 |  |
| M21 | UpdateDNS (no visible effect) | `/UpdateDNS` | HTTP 200; no error answer | Purpose unknown. |
| M22 | RadioAddPreset (adds a URL favourite, M24-M26 remove it) | `/RadioAddPreset?service=TuneIn&name=__bluos_verify__&url=TuneIn%3As16252` | HTTP 200 | TuneIn station s16252 as URL favourite `__bluos_verify__`; M24–M26 remove it. |
| M23 | playurl web form (port 80, plays a stream) | `POST :80 /playurl` | HTTP 200 |  |
| M24 | URL favourite is a TuneIn favourite | `/RadioBrowse?service=TuneIn&url=presets` | HTTP 200; __bluos_verify__ is in the TuneIn favourites (run M22 first); its preset_id starts with u (URL favourite); its menu removes it with /DeleteFavourite?id=u…&service=TuneIn | M24–M26: also copies left by earlier runs. |
| M25 | Remove the URL favourite (DeleteFavourite id=u) | `/DeleteFavourite?id=u…&service=TuneIn` | HTTP 200 |  |
| M26 | URL favourite is gone | `/RadioBrowse?service=TuneIn&url=presets` | HTTP 200; no favourite __bluos_verify__ left |  |
| M27 | Favourite a TuneIn station (AddFavourite preset_id=) | `/AddFavourite?preset_id=…` | HTTP 200 | M27–M30: the first local TuneIn station that is no favourite; stored in the player's TuneIn account. |
| M28 | TuneIn favourites contain the station | `/RadioBrowse?service=TuneIn&url=presets` | HTTP 200; the station is a favourite now; its menu removes it with /DeleteFavourite?id=&lt;same id> |  |
| M29 | Remove the TuneIn favourite (DeleteFavourite id=) | `/DeleteFavourite?id=…` | HTTP 200 |  |
| M30 | TuneIn favourites no longer contain the station | `/RadioBrowse?service=TuneIn&url=presets` | HTTP 200; the station is no favourite any more |  |
| M31 | Favourite an Airable station (AddFavourite url=) | `/AddFavourite?service=Airable&url=…` | HTTP 200; added, or 'Login to use favourites' without a login | M31–M34: the first station of Radio › Most popular stations; without a login the player answers `Login to use favourites` and M32–M34 are skipped. |
| M32 | Airable station is a favourite | `/Browse?key=…` | HTTP 200; the station is marked is_preset=1; its menu removes it with /DeleteFavourite?…url= |  |
| M33 | Remove the Airable favourite (DeleteFavourite url=) | `/DeleteFavourite?…&url=…` | HTTP 200; answer &lt;favourite>deleted&lt;/favourite> |  |
| M34 | Airable station is no favourite any more | `/Browse?key=…` | HTTP 200; the station is no longer marked is_preset=1 |  |
| M35 | Upgrade notification (check for upgrade, remember the version) | `/update (/upgrade?noheader=1 without a notification)` | HTTP 200; BluOS version read; notification with a message; one button that starts the upgrade | M35–M38: firmware upgrade, only when one is available. |
| M36 | Start the firmware upgrade (upgrade) | `/upgrade?upgrade=all (button of /update)` | /upgrade answers (200 or redirect) |  |
| M37 | Upgrade progress until the player is back | `/update, /GitVersion every 3 s` | HTTP 200; new BluOS version | At most 30 minutes; stops after 5 minutes without a change. |
| M38 | Upgrade log and versions of the group | `:80 /Dataexport, /SyncStatus of the group` | HTTP 200; log names the upgrade ; every player of the group has the new version |  |
| M39 | Library id (remember) | `/library/v1/Albums?service=LocalMusic&section=all&length=1` | HTTP 200; root carries a numeric id; id of New = id of the index | M39–M41: does the root `id` of `/library/v1` change with the library? Run M40 after each change (e.g. a favourite, a new album on the share). |
| M40 | Library id compared | `/library/v1/Albums?service=LocalMusic&section=all&length=1` | HTTP 200; M39 was run before; id of New = id of the index |  |
| M41 | Reindex and follow the library id | `/Reindex, then /library/v1/Albums and /Status every 5 s` | HTTP 200; rescan started; root carries a numeric id; indexing of /Status counted the files during the rescan; library id changed after the rescan; mid of /Status = library id after the rescan | At most 15 minutes, until 90 s after the last change. |
| M42 | PlayTestSound (pink noise, then stop) | `/PlayTestSound?sound=1&volume=20&type=pinknoise, then sound=0` | pink noise: HTTP 200, no error; stop: HTTP 200, no error; volume unchanged |  |
| M43 | SetInitialized (player stays initialized) | `/SetInitialized` | HTTP 200; SyncStatus initialized unchanged | On a player that is set up already. |
| M44 | SetMaster (grouping unchanged) | `/SetMaster` | HTTP 200; grouping unchanged | With `Accept: text/javascript`, as the BluOS app sends it. |
| M45 | AddShare and RemoveShare (test share, port 80) | `POST :80 /AddShare, POST :80 /RemoveShare, :80 /Shares` | AddShare: HTTP 200, Addshare failed; Shares without the test share; RemoveShare: HTTP 200, Share not found; Shares as before | Test share `\\127.0.0.1\blualbum-test` (no SMB server): `AddShare` fails after several minutes and stores nothing; no `/Reindex`. |
