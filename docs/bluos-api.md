# BluOS API reference

All BluOS HTTP endpoints known to this project, grouped by category, with their parameters,
function and answer structure. It covers the official *BluOS Custom Integration API* and
unofficial endpoints (seen in the player's own answers, in community projects, or explored
against a real player).

How BluAlbum uses the API (clicks, requests, measurements): [`blu-album-api-usage.md`](blu-album-api-usage.md).

## Sources and legend

Every endpoint carries one or more source tags:

| Tag | Source |
|---|---|
| **O** | Official: *BluOS Custom Integration API* v1.7 (Lenbrook, 2025-04-09), linked on `bluos.io/downloads`. A subset of the full (unpublished) *BluOS API Control Protocol*. |
| **V** | Verified on the owner's player: Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share (`service=LocalMusic`) and a USB drive (`service=<USB id>`); Bruno collection `tests/api` (read checks 2026-11-14: 84 GET requests on read endpoints, write checks in "2 Write"). |
| **P** | Seen in the player's own answers (e.g. `url` attributes in `/Settings`, `actionURL` / `playURL` in `/Browse`), not called directly. |
| **C** | Community code: [pyblu](https://github.com/LouisChrist/pyblu) (Python library used by the Home Assistant Bluesound integration). Not checked on the player. |

Unofficial endpoints (no **O**) may change with any BluOS update.

Notation of answer structures: `element ×n @attribute = "sample text"`; indentation = nesting.
Paths and names in samples are shortened or replaced.

## Contents

1. [Basics](#1-basics)
2. [Overview of all endpoints](#2-overview-of-all-endpoints)
3. [Status](#3-status)
4. [Volume](#4-volume)
5. [Playback control](#5-playback-control)
6. [Play queue](#6-play-queue)
7. [Saved playlists](#7-saved-playlists)
8. [Presets](#8-presets)
9. [Browse and search](#9-browse-and-search)
10. [Adding content and favourites](#10-adding-content-and-favourites)
11. [Library (`/library/v1`) and its aliases](#11-library-libraryv1-and-its-aliases)
12. [Artwork and images](#12-artwork-and-images)
13. [Inputs and Bluetooth](#13-inputs-and-bluetooth)
14. [Player grouping](#14-player-grouping)
15. [Settings, audio and sleep timer](#15-settings-audio-and-sleep-timer)
16. [System: versions, services, reboot, doorbell](#16-system-versions-services-reboot-doorbell)
17. [Endpoints that are not usable](#17-endpoints-that-are-not-usable)
18. [Discovery (mDNS and LSDP)](#18-discovery-mdns-and-lsdp)

## 1. Basics

- **Requests:** HTTP GET, `http://<player>:<port>/<Request>?<parameters>`; parameters are
  URL-encoded name/value pairs (UTF-8). Answers are UTF-8 XML. Exception: `/reboot` (POST, port 80).
- **Ports:**

  | Port | Use |
  |---|---|
  | 11000 | control API of every player (O) |
  | 11010, 11020, 11030 | nodes 2–4 of an NAD CI580 (node 1 = 11000); discover via mDNS (O) |
  | 11004 | library server `/library/v1/…`; the old category endpoints redirect here (V) |
  | 80 | web pages of the player: `/reboot` (O), `/sharecfg` (P) |
  | UDP 11430 | LSDP discovery broadcasts (O) |

- **Errors:** `/Browse` answers an error with an `<error>` root element, one `<message>` and zero
  or more `<detail>` text nodes (O). Other endpoints answer with HTTP errors or short error roots;
  clients should check the root element name.
- **Unknown elements** in answers are to be ignored; the official documentation lists only part of
  them (O).
- **Relative URIs** in answers (`playURL`, `actionURL`, `image`, …) have an absolute path and are
  resolved against the player address (RFC 3986). Invoke them as they are; do not parse or build
  them (O).
- **Keys** (`browseKey`, `nextKey`, `parentKey`, `contextMenuKey`, `searchKey`) are opaque and must
  be URL-encoded when passed as `key=` (O).
- **Polling rules (O):**
  - Without long polling: at most one request every 30 s.
  - Long polling (`timeout` + `etag` from the previous answer's root): never two requests for the
    same resource less than 1 s apart, even when the first returned sooner.
  - One long poll on `/Status` *or* `/SyncStatus` is usually enough: `/Status` carries `<syncStat>`,
    which changes whenever `/SyncStatus` changes.
- **Grouped players:** many requests sent to a secondary player are proxied to the primary
  (`/Status`, playback, queue, browse). `/Status` of a secondary is a copy of the primary's; use
  `/SyncStatus` for the volume of each secondary (O).

## 2. Overview of all endpoints

| Endpoint | Category | Function | Source |
|---|---|---|---|
| `/Status` | Status | playback and volume state, long polling | O V |
| `/SyncStatus` | Status | player identity, volume, grouping, long polling | O C |
| `/Volume` | Volume | read / set volume, step in dB, mute | O V |
| `/Play` | Playback | play, resume, seek, play queue entry, play URL / input | O V |
| `/Pause` | Playback | pause or toggle | O V |
| `/Stop` | Playback | stop | O C |
| `/Skip` | Playback | next track | O V |
| `/Back` | Playback | restart track or previous track | O V |
| `/Shuffle` | Playback | shuffle the queue on / off | O V |
| `/Repeat` | Playback | repeat queue / track / off | O V |
| `/Action` | Playback | skip / back / love / ban on streaming radio | O |
| `/Playlist` | Queue | list the queue or its status | O V |
| `/Delete?id=` | Queue | remove a queue entry | O V |
| `/Move` | Queue | move a queue entry | O C |
| `/Clear` | Queue | clear the queue | O V |
| `/Save` | Queue / playlists | save the queue as a playlist | O V |
| `/Playlists` | Saved playlists | names of the saved playlists | V |
| `/Load` | Saved playlists | load a saved playlist (or a service playlist) | P V |
| `/Delete?service=…&name=` | Saved playlists | delete a saved playlist | V |
| `/Songs?service=BluOS&playlist=` | Saved playlists | tracks of a saved playlist | V |
| `/Presets` | Presets | list presets | O C |
| `/Preset` | Presets | load preset by id, next, previous | O C |
| `/Browse` | Browse | menu tree, lists, context menus, search | O V |
| `/RadioBrowse` | Browse / inputs | inputs list (`service=Capture`) | O C |
| `/Add` | Adding | add / play albums, tracks, playlists | P V |
| `/AddFavourite`, `/DeleteFavourite` | Favourites | set / remove a favourite | P V |
| `/library/v1/Albums` … `/Search` | Library | library server on port 11004 | V |
| `/Artists`, `/Albums`, `/Songs`, `/Genres`, `/Composers`, `/Folders` | Library | 302 redirects to `/library/v1/…` | V |
| `/Artwork` | Images | cover art (301 to port 11004) | O V |
| `/Settings` | Settings | settings tree of the player | O V |
| `/setting` | Settings | change a simple setting | P C |
| `/audiomodes` | Settings / audio | audio and Bluetooth modes | O P C |
| `/alsa_setting` | Settings / audio | listening mode and tone controls | C |
| `/proxyToSlave` | Settings / grouping | forward a request to a group member | P |
| `/Reindex` | Settings / library | rescan the music library | P |
| `/sharecfg` (port 80) | Settings / library | web page for network shares | P |
| `/Sleep` | Settings | step the sleep timer | C |
| `/AddSlave`, `/RemoveSlave` | Grouping | group / ungroup players | O C P |
| `/Version` | System | API version | V |
| `/GitVersion` | System | BluOS version | V |
| `/Services` | System | the player's self-description of its sources | V |
| `/reboot` (POST, port 80) | System | soft reboot | O |
| `/Doorbell` | System | play the doorbell chime | O |
| `/Info` | – | redirects to last.fm, not usable | V |

## 3. Status

### `/Status` — playback status (O V)

`/Status?timeout=<s>&etag=<etag>`

| Parameter | Meaning |
|---|---|
| `timeout` | Long polling: seconds the player may hold the request. Recommended 100 (O). |
| `etag` | `etag` attribute of the previous answer's root. The answer returns early only if the state changed. |

```
status @etag
  title1, title2, title3        three lines of now-playing text (MUST be used for 3-line UIs)
  twoline_title1, twoline_title2 (if present: MUST be used for 2-line UIs)
  album, artist, name           raw metadata (do not use for display)
  state                         play | pause | stop | stream | connecting | …
  secs, totlen                  position and length in s; secs does not change the etag
  canSeek                       1 = /Play?seek= possible
  song                          position of the current track in the queue
  pid                           queue id (= @id of /Playlist); changes with every queue change
  prid                          preset id (= @prid of /Presets)
  syncStat                      changes whenever /SyncStatus changes
  shuffle (0|1), repeat (0 queue | 1 track | 2 off)
  volume (0–100, -1 fixed), db, mute, muteVolume, muteDb
  quality                       cd | hd | dolbyAudio | mqa | mqaAuthored | bitrate number (lossy)
  streamFormat                  e.g. "MP3 320 kb/s", "FLAC 44.1kHz/16bit"
  service, serviceIcon, image, stationImage, fn
  streamUrl                     present: not playing from the queue (no song / shuffle / repeat / skip)
  actions > action @name @url @icon @text @notification @state   (see /Action)
  sleep                         minutes left on the sleep timer
  groupName, groupVolume        only on the primary player of a group
  battery @level @charging @icon
  alarmsecondsremaining, notifyurl, canMovePlayback, indexing, mid, mode, sid, cursor
```

Notes:
- Clients must advance `secs` themselves while `state` is `play` or `stream` (O).
- `play` and `stream` mean the same. `/Play` resumes from `pause`, not from `stop` (O).
- `quality` is `hd` here but `hr` in the library filter (V). MP3 files report their bitrate as
  `quality`; recognise MP3 by `streamFormat` (V).
- Verified (V): during playback the player holds each long-poll request for the full 100 s and
  answers at once on a change (title, position jump, volume, shuffle, repeat, `pid`).

### `/SyncStatus` — player and group status (O C)

`/SyncStatus?timeout=<s>&etag=<etag>` (recommended timeout 180 s).

```
SyncStatus @etag @syncStat @id="<ip>:<port>" @name @brand @model @modelName @icon @mac
           @volume (0–100, -1 fixed) @db @mute @muteVolume @muteDb @group @initialized
           @schemaVersion @zone @zoneMaster @zoneSlave @outlevel
  master @port @reconnecting = "<ip>"     only on a secondary player
  slave ×n @id @port                      only on the primary player
  battery @level @charging @icon
```

`initialized="false"`: the player still needs setup in the BluOS app.

## 4. Volume

### `/Volume` (O V)

| Request | Function |
|---|---|
| `/Volume` | read the volume (supports long polling with `timeout` / `etag`) |
| `/Volume?level=<0–100>` | set the volume level |
| `/Volume?abs_db=<dB>` | set the volume in dB |
| `/Volume?db=<±dB>` | relative change in dB, e.g. `db=2` (up), `db=-2` (down) |
| `/Volume?mute=1` / `mute=0` | mute / unmute |
| `…&tell_slaves=0\|1` | grouped players: 1 = change the whole group, 0 = only this player |

All variants are limited to the volume range configured in the BluOS app (typically -80…0 dB).
The official parameter table says `mute=0` mutes, but its own examples (and pyblu) use
`mute=1` to mute – the examples are right.

```
volume @db @mute @offsetDb @etag [@muteDb @muteVolume] [@source] = "16"   (level 0–100, -1 fixed)
```

## 5. Playback control

### `/Play` (O V)

| Request | Function |
|---|---|
| `/Play` | start / resume playback of the current source (only from `pause`) |
| `/Play?seek=<s>` | jump to a position of the current track (only when `/Status` has `totlen` / `canSeek=1`) |
| `/Play?seek=<s>&id=<n>` | play queue entry `n` from position `s` (O, since v1.6) |
| `/Play?id=<n>` | play queue entry `n` (V) |
| `/Play?url=<encoded URL>` | play a stream URL (e.g. an MP3 on the web) or an input URL (see 13) |
| `/Play?inputTypeIndex=<type>-<n>` | select an external input (BluOS ≥ 4.2.0, see 13) |
| `/Play?inputIndex=<n>` | select an external input (BluOS 3.8–4.2, see 13) |

Answer: `<state>play</state>` or `<state>stream</state>`.

### `/Pause` (O V)

`/Pause` pauses; `/Pause?toggle=1` toggles play / pause. Cancels the timeout of a playing alarm.
Answer: `<state>pause</state>` (with `toggle`: the new state).

### `/Stop` (O C)

Stops playback (cancels an alarm timeout). Answer: `<state>stop</state>`.

### `/Skip` (O V)

Next track of the queue; from the last track it goes to the first, regardless of repeat. Only for
queue playback (no `<streamUrl>` in `/Status`); streaming radio uses `/Action`.
Answer: `<id>21</id>` (new queue position).

### `/Back` (O V)

After more than 4 s of playback: back to the start of the track; otherwise the previous track
(from the first to the last). Same restrictions as `/Skip`. Answer: `<id>19</id>`.

### `/Shuffle?state=0|1` (O V)

1 builds a shuffled copy of the queue (no effect if already shuffled); 0 restores the original
order. Changes the queue id (V).
Answer: `<playlist @name @modified @length @shuffle @id/>`.

### `/Repeat?state=0|1|2` (O V)

0 = repeat the queue, 1 = repeat the track, 2 = off. Answer: `<playlist @length @id @repeat/>`.

### `/Action` — streaming radio actions (O)

Streaming radio (e.g. Slacker, Radio Paradise, Amazon stations) does not use the queue. `/Status`
then lists `<actions><action @name="back|skip|love|ban" @url @icon @text @notification @state/>`;
invoke the `url` exactly as given (usually `/Action?service=<svc>&skip|love|ban=<id>`, but any URI
is possible). An action without `url` is not available.

Answers: `<skip/>`, `<back/>`, `<love>1</love>`, ban: `<love skip="1">0</love>`. If the root is
`<response>`, its text is a notification for the user; otherwise show the action's `notification`.

## 6. Play queue

### `/Playlist` (O V)

| Request | Function |
|---|---|
| `/Playlist?length=1` | queue status only |
| `/Playlist?start=<first>&end=<last>` | entries `first`…`last` (0-based, inclusive) – use for paging |
| `/Playlist` | the whole queue – not recommended (very large) |

```
playlist @name @modified (0|1) @length @id (= pid of /Status) [@shuffle]
  song ×n @id (queue position = song of /Status) @service @albumid @artistid @songid
    title, art, alb, fn
```

Verified (V): `id` changes on add, remove, shuffle on / off, clear and load.

### `/Delete?id=<n>` (O V)

Removes queue entry `n`. Answer: `<deleted>9</deleted>`.
Not to be confused with `/Delete?service=BluOS&name=…` (deletes a saved playlist, section 7).

### `/Move?new=<to>&old=<from>` (O C)

Moves a queue entry. Answer: `<moved>moved</moved>`.

### `/Clear` (O V)

Empties the queue. Answer: `<playlist @modified @length="0" @id/>`.

### `/Save?name=<name>` (O V)

Saves the queue as a BluOS playlist. Answer:
`<saved><entries>126</entries></saved>`. Error when the queue is empty (C).

## 7. Saved playlists

BluOS playlists belong to the service `BluOS`. In `/Browse` they appear in the top menu
(`browseKey="playlists"`, O example) with play URLs and context menus.

### `/Playlists` (V)

Names of the saved playlists; one request, no paging (`service=BluOS`, `start` / `end` have no
effect). No play URL – that comes from `/Browse`.
```
playlists @service="BluOS"
  name ×n @image = "<playlist name>"
```

### `/Load?service=BluOS&name=<name>` (P V)

Replaces the queue with the saved playlist and plays it. The URL comes from `/Browse` (playlist
`playURL`); presets of streaming playlists use the same endpoint with other parameters, e.g.
`/Load?service=Tidal&id=<uuid>` (O example in `/Presets`). Changes the queue id (V).

### `/Delete?service=BluOS&name=<name>` (V)

Deletes a saved playlist (context menu type `delete` in `/Browse`).

### `/Songs?service=BluOS&playlist=<name>` (V)

Tracks of a saved playlist, 10 per page; the only `/Songs` variant that is not redirected.
```
songs @service="BluOS" @playlist
  song ×10 @service
    art, alb, title, track, date, time, fn, quality
  nextlink = "/Songs?playlist=…&offset=10"
```

## 8. Presets

Presets are created and deleted only in the BluOS app; they can hold radio stations, playlists and
inputs.

### `/Presets` (O C)

```
presets @prid (= prid of /Status; changes when presets change)
  preset ×n @id @name @url @image
```
`url` is the source URL used to load the preset (e.g. `/Load?service=Tidal&id=…` or a radio key).

### `/Preset?id=<id>|+1|-1` (O C)

Loads preset `id`, or the next (`+1`) / previous (`-1`) one, wrapping around. Ids need not be
consecutive. Answer: list → `<loaded @service><entries>60</entries></loaded>`;
radio → `<state>stream</state>`.

## 9. Browse and search

### `/Browse` (O V)

`/Browse?key=<key>&withContextMenuItems=1&q=<text>`

| Parameter | Meaning |
|---|---|
| `key` | opaque key from `browseKey`, `nextKey`, `parentKey`, `contextMenuKey` or `searchKey` of an earlier answer, URL-encoded. Without `key`: top menu. |
| `withContextMenuItems` | `1`: every item gets an inline `<contextMenu>` (O). `0` drops only the `contextMenu` children; keys and URLs stay (V, Bruno E09). |
| `q` | search text, together with a `searchKey` (O); without `key`: top-level search (O). |

```
browse @type @sid @service @serviceName @serviceIcon @searchKey @nextKey @parentKey [@playURL]
  item ×n @type @text @text2 @image @browseKey @playURL @autoplayURL @contextMenuKey @actionURL
          [@inputType @duration @tracks]
    contextMenu > item ×n @type @text @actionURL        (with withContextMenuItems=1)
  category ×n @text @nextKey @parentKey > item ×n        (some answers group the items)
```

- `browse@type`: `menu`, `contextMenu`, `artists`, `composers`, `albums`, `playlists`, `tracks`,
  `genres`, `sections` (alphabetic sections), `items` (mixed), `folders`.
- `item@type`: `link` (leads further), `audio` (directly playable), `artist`, `composer`, `album`,
  `playlist`, `track`, `text`, `section`, `folder`.
- `browseKey` = can be opened; `playURL` = default play action (usually clear the queue and
  play); `autoplayURL` = play this track and fill the queue with the rest of its container;
  `contextMenuKey` = key of the item's context menu; `actionURL` = action of a context menu item.
- Context menu item types: `favourite-add`, `favourite-delete`, `add-now` (play now),
  `add-next`, `add-last`, `add-shuffle`, `addAll-now`, `addAll-next`, `addAll-last`,
  `playRadio`, `delete` (ask the user first).
- Paging: `nextKey` on `browse` or `category`; the chunk size is fixed by the player.
- Which of `playURL` / `autoplayURL` is the default should be a user preference (O).

Verified keys for the local library (V; `<svc>` = `LocalMusic` or the USB id):

| key | Answer | Size |
|---|---|---:|
| (none) | `@type="menu"` · sources, playlists, inputs, radio (`item @browseKey @text @image @type @playURL @inputType`) | 1.2 KB |
| `<svc>:` | `item ×7` (Artists, Albums, Songs, Genres, Playlists, Composers, Favourites); USB: 6 | 1.0 KB |
| `…bySection:Album/…` | `@type="sections"` · `item ×27 @browseKey @text @text2` – **`text2` = number of albums in the section**; USB lists only filled sections | 4.4 KB |
| `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | like Album, with counts | 4–5 KB |
| `…S:Album/…&section=A` | `@type="albums"` · `item ×143 @browseKey @contextMenuKey @playURL @text @text2 @tracks @image` + context menus | 204 KB (68 KB without context menus) |
| `<svc>:GG/Genres` | `@type="genres"` · `item ×34 @browseKey @text` | 3.4 KB |
| `<svc>:MG/LocalMusic-Genre?genre=…` | empty – genre menus have other keys, take them from the genre list | 0.2 KB |
| `<svc>:MG/LocalMusic-Artist?artist=…` | `item ×2` (albums, songs of the artist); the "Albums" key `<svc>:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=…&service=<svc>` returns all albums of the artist with URLs and context menus, no paging (Bruno E10–E13) | 0.4 KB |
| `<svc>:MG/LocalMusic-Favourites` | `item ×4` (favourites by type) | 0.7 KB |
| `<svc>:MG/LocalMusic-Album?album=…&artist=…` | `@type="tracks" @playURL` · `item ×9 @contextMenuKey @playURL @autoplayURL @text @duration @image` (`type="track"`) | 16.8 KB (7.2 KB without context menus) |
| `<svc>:CM/LocalMusic-Album?album=…&artist=…[&isFavourite=1]` | `@type="contextMenu"` · `item ×5 @actionURL @text @type` (`favourite-add/-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last`) | 1.0 KB |
| `<svc>:Search` + `q=love` | `@type="menu"` · `item ×4` (links to artists, albums, songs, composers); every list returns all hits | 0.7 KB |
| `LocalMusic:Playlist/…imported=1` | imported playlists (empty here) | 0.2 KB |

Streaming services use keys of the form `/Albums?service=Tidal&category=masters` (O examples);
their search answers link to `/Artists|Albums|Songs|Playlists?service=…&expr=…`.

### `/RadioBrowse?service=Capture` (O C)

Lists the active inputs, cloud sources (e.g. Spotify) and inputs of a BluOS HUB:
```
radiotime @service="Capture"
  item ×n @text @inputType @id @URL @image @type="audio" @playerName [@serviceType]
  category @text @icon > remoteitem ×n …     (HUB inputs)
```
Play an entry with `/Play?url=<URL>` (section 13).

## 10. Adding content and favourites

These endpoints are not documented officially as requests; they appear as `playURL`,
`autoplayURL` and `actionURL` values in `/Browse` answers (also in the official examples). Take the
URLs from the player instead of building them.

### `/Add` (P V)

Adds albums, tracks or playlists to the queue and / or plays them.

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, a USB id, `Deezer`, `Tidal` |
| `album` + `artist`, `albumid`, `file`, … | what to add (depends on the service) |
| `playnow` | `1` = play now, `-1` = only add |
| `where` | seen: `last` (end of the queue), `nextAlbum` (after the current album) |
| `clear` | seen as `clear=0` in `add-now` URLs |
| `shuffle` | `1`: add shuffled |
| `listindex`, `nextlist`, `cursor` | used by `autoplayURL` (start at a track, fill the rest of the album) |

Examples (V): album play `/Add?playnow=1&service=LocalMusic&album=…&artist=…`; album to the end
`/Add?album=…&artist=…&playnow=-1&service=<svc>&where=last`; track `/Add?playnow=1&file=…`.
Changes the queue id.

### `/AddFavourite`, `/DeleteFavourite` (P V)

`/AddFavourite?service=<svc>&album=…&artist=…` (or `albumid=…` for streaming services) marks a
favourite of the player; `/DeleteFavourite?…` removes it. The current state shows in the context
menu (`favourite-add` or `favourite-delete`) and in `@isFavourite` of `/library/v1` answers.
USB albums have no favourite actions (V).

## 11. Library (`/library/v1`) and its aliases

The library server answers on **port 11004**. All findings in this section are verified (V).

General:
- The root of every answer carries `id` (library: a fixed number, USB: `1`) and `service`, plus all
  filters passed as attributes.
- `limit` and `start` are **ignored** with `section=`: a section always comes complete.
- `sort=` (according to `/Services`: `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate`)
  gives an empty answer for albums.
- Paging: `<nextlink>` with the full URL of the next page.
- **No genre per album** in any answer.

### Aliases on port 11000

`/Artists`, `/Genres`, `/Albums`, `/Songs`, `/Composers`, `/Folders` – all variants (no parameters,
`service`, `start` / `end`, `artist`, `genre`, `album`+`artist`) answer **302** to
`http://<player>:11004/library/v1/<same>?<same parameters>`. Use `/library/v1/…` directly.
Exception: `/Songs?service=BluOS&playlist=…` (section 7).

### `/library/v1/Albums`

| Parameters | Result |
|---|---|
| none / only `service` | empty |
| `section=A` | all albums of the section (143), 16.5 KB |
| `section=A&limit=5`, `&start=5` | like `section=A` – ignored |
| `sort=year&section=A`, `sort=recent` | empty |
| `recent=1` | 50 newest albums + `nextlink` |
| `category=FAVOURITES` | favourite albums, one request |
| `quality=hr\|cd\|mqa&section=A` | albums of that quality in the section; empty without `section` |
| `genre=Jazz&section=A` | albums of the genre in the section; empty without `section` |
| `artist=…` | all albums of the artist, one request |
| `album=…&artist=…` | one album including `cover` |
| `composer=…` | albums with songs of the composer |

Answer forms:
```
albums @section @id @service                     (section, quality, genre)
  sections > section @name
    album ×n @tracks @date @isFavourite
      title, art

albums @recent @id @service                      (recent, category)
  album ×50 @isFavourite
    alb, art
  nextlink = "/library/v1/Albums?count=50&recent=1&service=LocalMusic&start=50"

albums @artist @id @service                      (artist)
  artist @name > album ×n @tracks @date @isFavourite = "<title>"

albums @album @artist @id @service               (album+artist, composer)
  album @tracks @date @isFavourite
    title, art, cover = "/Artwork?service=…&album=…&artist=…"
```
Depending on the form the title is `title`, `alb` or the text of `album`.

### `/library/v1/Artists`

Empty without a filter. `section=A` → `sections > section @name > art ×n @isFavourite`;
`category=FAVOURITES` → `art @isFavourite`; `genre=…&section=…` → artists of the genre;
`artist=…` → only the name.

### `/library/v1/Songs`

| Parameters | Result |
|---|---|
| only `service` | empty |
| `album=…&artist=…` | all songs of the album with technical data |
| `artist=…` | all songs of the artist, one request |
| `composer=…` | songs of the composer |
| `section=A&limit=5` | 5 songs + `nextlink` (here `limit` works) |
| `genre=…&section=…` | 50 songs + `nextlink` |
| `category=FAVOURITES` | empty |

```
songs @album @artist @id @service
  song ×n @samplerate @samplebits @channels @bitrate @atype
    songID, art, alb, title, track, date, time, quality, fn
    (depending on the song also: discno, composer, compilation, albumartist)
```
The lists (`section`, `genre`) lack the technical attributes and `songID`, `track`, `date`, `time`.
`quality` of MP3 files is the bitrate; recognise them by `atype`.

### `/library/v1/Composers`

Without a filter: `composer ×51` + `nextlink` (pages of 51). `section=A` →
`sections > section > composer ×n`. `genre=…&section=…` → composers of the genre.

### `/library/v1/Genres`

All genre names of the source in one request (no keys for `/Browse`); `category`, `album` and
`artist` are ignored.
```
genres @id @service @length="34"
  genre ×34 = "Alternative Rock"
```

### `/library/v1/Folders`

Without `path`: `folders > subfolders > folder` (root of the share); with `path=` the sub folders
and `songs`.

### `/library/v1/Search?service=…&expr=…`

```
search @expr @id @service
  artists > artist ×≤25 > name
  albums  > album ×≤25 @tracks > title, art, cover
  songs   > song ×≤25 > title, art, alb, fn, track, time, date, quality, …
```
At most 25 per type, no `nextlink`. The search via `/Browse` returns all hits.

### `/library/v1/Artwork`

`album=…&artist=…` → 200, `image/jpeg` (same image as `/Artwork`). Only `artist=` → 200 without
content.

### `/Reindex` (P)

Starts a rescan of the music library ("Reindex music collection" button in `/Settings`). `/Status`
has an `<indexing>` element (0 in the official sample), presumably the indexing state.

## 12. Artwork and images

### `/Artwork` (O V)

`/Artwork?service=<svc>&album=…&artist=…` (also `songid=`, `albumid=`, `fn=`, `playlistimage=`,
depending on the service). Answers **301** to `http://<player>:11004/library/v1/Artwork?…` for the
library. With **`&followRedirects=1`** the player answers 200 with the image itself (O since v1.7,
V) – use this for every `image` attribute that starts with `/Artwork`.

Other image paths in answers (`/images/…`, `/Sources/images/…`) are static files on the player.

## 13. Inputs and Bluetooth

### Active inputs: `/Play?url=<URL>` (O)

Take `URL` from `/RadioBrowse?service=Capture` (already encoded), e.g.
`/Play?url=Capture%3Ahw%3A…%3Fid%3Dinput1` or a HUB input `/Play?url=Hub%3A%2F%2F<ip>%3A11000%2Finput0`.
The only way to select HUB inputs. The source must be connected and not hidden.
Answer: `<state>stream</state>`.

### External inputs by type: `/Play?inputTypeIndex=<type>-<n>` (O, BluOS ≥ 4.2.0)

Also works for inputs that are inactive and missing from `/RadioBrowse`; recommended for custom
integration. Types: `spdif` (optical), `analog`, `coax`, `bluetooth`, `arc`, `earc`, `phono`,
`computer`, `aesebu`, `balanced`, `microphone`; `n` starts at 1 per type. Example:
`/Play?inputTypeIndex=spdif-2` (optical input 2).

### External inputs by index: `/Play?inputIndex=<n>` (O, BluOS 3.8.0 – 4.2.0)

`n` = position (from 1, Bluetooth excluded) of the input in
`/Settings?id=capture&schemaVersion=32`. (The official example writes `InputId`; the parameter
table says `inputIndex`.)

### Bluetooth mode: `/audiomodes?bluetoothAutoplay=<0–3>` (O)

0 = manual, 1 = automatic, 2 = guest, 3 = disabled. No answer body.

## 14. Player grouping

The primary player selects the source; secondary players follow. Fixed groups (home theatre,
stereo pairs) are set up in the BluOS app.

| Request | Function | Answer |
|---|---|---|
| `/AddSlave?slave=<ip>&port=<port>&group=<name>` | add one secondary player; `group` optional (O) | `addSlave > slave @id @port` |
| `/AddSlave?slaves=<ip1>,<ip2>&ports=<p1>,<p2>` | add several (O) | `addSlave > slave ×n` |
| `/RemoveSlave?slave=<ip>&port=<port>` | remove one; removing the primary of 3+ players leaves the rest as a new group (O) | `SyncStatus` |
| `/RemoveSlave?slaves=…&ports=…` | remove several; also the "Delete fixed group" button in `/Settings` (O P) | `SyncStatus` |

The default port is 11000; an NAD CI580 needs the node port. pyblu leaves a group by calling
`/RemoveSlave` with the player's own address (C).

### `/proxyToSlave?slave=<ip>%3A<port>&url=<encoded path>` (P)

Forwards a request to a member of a fixed group, e.g. `url=%2Faudiomodes` (audio settings of a
surround speaker). Seen as `url` of group members in `/Settings`.

## 15. Settings, audio and sleep timer

### `/Settings` (O V)

The settings tree the BluOS app shows. `/Settings` returns the top level; `?id=<menu id>` a sub
menu (e.g. `id=audio`, `id=capture`), `schemaVersion=<n>` the schema the client understands
(32 in the official example; the Powernode answers 28 without the parameter).
```
settings @schemaVersion
  setting @id @name @displayName @class @value @url @icon [@description @explanation @pattern …]
  menuGroup @id @displayName @url @icon [@inline @description] > setting ×n, menuGroup ×n
```
`@class` tells the control (`text`, `boolean`, `list`, `button`, `alarms`, `sleep`, …); `@url` is
the endpoint that changes the setting (`/setting`, `/audiomodes`, `/Reindex`, `/RemoveSlave`,
`/proxyToSlave?…`, `http://<player>:80/sharecfg?noheader=1`). Seen on the Powernode (V): alarms,
sleep timer, audio, room / zone name (`zonename`), amplifier standby, fixed group members, network
shares (`sharecfg`), reindex, artwork optimisation (`resizeall`), server mode (`server`).

### `/setting?<name>=<value>` (P C)

Changes a setting whose `@url` is `/setting`, presumably as `/setting?<name>=<value>` with the
setting's `@name` (pyblu: `/setting?centre=ON|OFF`, C). Names seen in `/Settings` (P): `zonename`,
`amplifierStandby`, `resizeall`, `server` (booleans with `ON` / `OFF`).

### `/audiomodes` (O P C)

Audio settings; `/Settings?id=audio` shows the current values and choices.

| Parameter | Values | Source |
|---|---|---|
| `bluetoothAutoplay` | 0 manual, 1 automatic, 2 guest, 3 disabled | O |
| `subwoofer` | subwoofer mode name | C |
| `ears` | ON / OFF | C |
| `mqaDisable` | ON / OFF | C |
| `fixedVolume` | ON / OFF | C |
| `volumeLimits` | `<min>,<max>` in dB | C |
| `replayGainMode` | mode name | C |
| `channelMode` | mode name | C |
| `enableClockTrim` | ON / OFF | C |

### `/alsa_setting` (C)

Listening mode and tone controls (players with DSP): `preset=<listening mode>`,
`eq-switch=ON|OFF`, `eq-treble`, `eq-bass`, `eq-balance`, `eq-centre-trim`, `eq-crossover` (numbers).

### `/Sleep` (C)

Each call steps the sleep timer: 15 → 30 → 45 → 60 → 90 min → off. Answers the minutes. `/Status`
shows the rest in `<sleep>`.

### `/sharecfg` (port 80) (P)

Web page of the player for network shares of the library (`?noheader=1` without the page header).

## 16. System: versions, services, reboot, doorbell

### `/Version` (V)

API version: `<version>v0.5.43</version>`.

### `/GitVersion` (V)

BluOS version: `<version>4.18.18</version>`.

### `/Services` (V)

The player's self-description of its sources: per service the `browseRequest`,
`requestParameter`, `requestItemParameter`, `genreItemParameter`, `filter`, `sort` and `search`
definitions. Source of the `/library/v1` parameter names in section 11.

### `/reboot` (O)

Soft reboot: **POST** to port 80, form field `yes` with any value, e.g.
`curl -d yes=1 http://<player>/reboot`. Answers an HTML page ("Rebooting…").

### `/Doorbell?play=1` (O)

Plays the doorbell chime. Answer: `<status @enable @volume @chime="Doorbell:audio/chime_1.mp3"/>`.

## 17. Endpoints that are not usable

| Endpoint | Result (V) |
|---|---|
| `/Info?…` (album / track info) | redirects to last.fm |
| `/Info?category=technical&filename=…` | empty answer |

## 18. Discovery (mDNS and LSDP)

Players announce themselves by mDNS and by LSDP (O).

| LSDP class | Device | mDNS service |
|---|---|---|
| `0x0001` | BluOS player | `_musc._tcp` |
| `0x0002` | BluOS server | `_muss._tcp` |
| `0x0003` | secondary player of a multi-zone device (CI580) | `_musp._tcp` |
| `0x0004` | manufacturing test (`sovi-mfg`) | `_sovi-mfg._tcp` |
| `0x0005` | keypad (`sovi-keypad`) | `_sovi-keypad._tcp` |
| `0x0006` | player of a stereo pair (secondary) | `_musz._tcp` |
| `0x0007` | remote web app (AVR on-screen page) | `_remote-web-ui._tcp` |
| `0x0008` | BluOS HUB | `_mush._tcp` |
| `0xFFFF` | all classes (query only) | |

LSDP (*Lenbrook Service Discovery Protocol*) uses UDP broadcasts on port 11430:
- Packet = header (length, magic `LSDP`, version 1) + message blocks, each with its own length;
  multi-byte numbers big endian.
- Messages: Query `Q` (0x51, broadcast answer) / `R` (0x52, unicast answer) with a list of classes;
  Announce `A` (0x41) with node id (usually a MAC), IPv4 address and records (class + TXT
  key/value pairs); Delete `D` (0x44) with node id and classes.
- Timing: 7 packets at start-up or on changes (at 0, 1, 2, 3, 5, 7, 10 s + up to 250 ms), then an
  announce every 57–63 s; answer a query after 0–750 ms. Large devices split announces into
  several messages.

A browser page cannot use either protocol; BluAlbum asks for the IP address instead.
