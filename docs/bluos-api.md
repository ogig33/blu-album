# BluOS API reference

All BluOS HTTP endpoints known to this project, grouped by category, with their parameters, function and answer structure: the official *BluOS Custom Integration API* and unofficial endpoints (seen in the player's own answers, in community projects, or explored against a real player).

Official documentation: [BluOS Custom Integration API v1.7](https://bluos.io/wp-content/uploads/2025/06/BluOS-Custom-Integration-API_v1.7.pdf) (Lenbrook, 2025-04-09; linked on [bluos.io/downloads](https://bluos.io/downloads/)).

How BluAlbum uses the API (clicks, requests, measurements): [`blu-album-api-usage.md`](blu-album-api-usage.md).

## Table of contents

1. [Basics](#1-basics)
2. [Status](#2-status)
3. [Volume](#3-volume)
4. [Playback control](#4-playback-control)
5. [Playlist](#5-playlist)
6. [Presets](#6-presets)
7. [Browse and search](#7-browse-and-search)
8. [Favourites](#8-favourites)
9. [Library](#9-library)
10. [Artwork](#10-artwork)
11. [Player grouping](#11-player-grouping)
12. [System](#12-system)

---

## 1. Basics

- **Requests:** HTTP GET, `http://<player>:<port>/<Request>?<parameters>`; parameters are URL-encoded name/value pairs (UTF-8). Answers are UTF-8 XML. Exception: `/reboot` (POST, port 80).
- **Ports:**

  | Port | Use |
  |---|---|
  | 11000 | control API of every player |
  | 11010, 11020, 11030 | nodes 2–4 of an NAD CI580 (node 1 = 11000); discover via mDNS |
  | 11004 | library server; the short library endpoints (`/Albums`, `/Artwork`, …) redirect here. The same `/library/v1/…` requests also answer on 11000 |
  | 80 | web pages of the player: `/reboot`, `/sharecfg` |

- **Official / unofficial:** the column "Official" in each category overview marks endpoints of the official documentation. Unofficial endpoints come from the player's own answers (`url`, `playURL`, `actionURL` attributes), from community projects or from tests; they may change with any BluOS update.
- **Verified** in the notes means checked on a Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share (`service=LocalMusic`) and a USB drive (`service=<USB id>`), with the Bruno collection `tests/api`.
- **Errors:** `/Browse` answers an error with an `<error>` root element, one `<message>` and zero or more `<detail>` text nodes. Other endpoints answer with HTTP errors or short error roots; clients should check the root element name.
- **Unknown elements** in answers are to be ignored; the official documentation lists only part of them.
- **Relative URIs** in answers (`playURL`, `actionURL`, `image`, …) have an absolute path and are resolved against the player address (RFC 3986). Invoke them as they are; do not parse or build them.
- **Keys** (`browseKey`, `nextKey`, `parentKey`, `contextMenuKey`, `searchKey`) are opaque and must be URL-encoded when passed as `key=`.
- **Polling rules:**
  - Without long polling: at most one request every 30 s.
  - Long polling (`timeout` + `etag` from the previous answer's root): never two requests for the same resource less than 1 s apart, even when the first returned sooner.
  - One long poll on `/Status` *or* `/SyncStatus` is usually enough: `/Status` carries `<syncStat>`, which changes whenever `/SyncStatus` changes.
- **Grouped players:** many requests sent to a secondary player are proxied to the primary (`/Status`, playback, queue, browse). `/Status` of a secondary is a copy of the primary's; use `/SyncStatus` for the volume of each secondary.
- **Notation of answer structures:** `element ×n @attribute = "sample text"`; indentation = nesting.

---

## 2. Status

| Endpoint | Function | Official |
|---|---|:---:|
| `/Status` | playback and volume state, long polling | ✓ |
| `/SyncStatus` | player identity, volume and grouping, long polling | ✓ |

### `/Status`

```
/Status?timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `timeout` | Long polling: seconds the player may hold the request. Recommended 100. |
| `etag` | `etag` attribute of the previous answer's root. The answer returns early only if the state changed. |

**Response format**

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

**Notes**

- Without parameters the answer comes at once.
- Clients must advance `secs` themselves while `state` is `play` or `stream`.
- `play` and `stream` mean the same.
- `quality` is `hd` here but `hr` in the library filter (verified). MP3 files report their bitrate as `quality`; recognise MP3 by `streamFormat`.
- Verified: during playback the player holds each long-poll request for the full 100 s and answers at once on a change (title, position jump, volume, shuffle, repeat, `pid`).

### `/SyncStatus`

```
/SyncStatus?timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `timeout` | Long polling: seconds the player may hold the request. Recommended 180. |
| `etag` | `etag` attribute of the previous answer's root. |

**Response format**

```
SyncStatus @etag @syncStat @id="<ip>:<port>" @name @brand @model @modelName @icon @mac
           @volume (0–100, -1 fixed) @db @mute @muteVolume @muteDb @group @initialized
           @schemaVersion @zone @zoneMaster @zoneSlave @outlevel
  master @port @reconnecting = "<ip>"     only on a secondary player
  slave ×n @id @port                      only on the primary player
  battery @level @charging @icon
```

**Notes**

- Poll `/SyncStatus` when only name, volume and grouping matter; `/Status` for playback.
- `initialized="false"`: the player still needs setup in the BluOS app.
- `zone`, `zoneMaster`, `zoneSlave` describe fixed groups.

---

## 3. Volume

| Endpoint | Function | Official |
|---|---|:---:|
| `/Volume` | read / set the volume, step in dB, mute | ✓ |

### `/Volume`

```
/Volume?level=<0–100>&abs_db=<dB>&db=<±dB>&mute=<0|1>&tell_slaves=<0|1>&timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `level` | set the volume level, 0–100 |
| `abs_db` | set the volume in dB |
| `db` | relative change in dB, e.g. `2` (up) or `-2` (down) |
| `mute` | `1` = mute, `0` = unmute |
| `tell_slaves` | grouped players: `1` = change the whole group, `0` = only this player |
| `timeout`, `etag` | long polling of the read request, as with `/Status` |

**Response format**

```
volume @db @mute @offsetDb @etag [@muteDb @muteVolume] [@source] = "16"   (level 0–100, -1 fixed)
```

**Notes**

- Without parameters: read the volume. Use one of `level`, `abs_db`, `db` or `mute` per request.
- All variants are limited to the volume range configured in the BluOS app (typically -80…0 dB).
- The official parameter table says `mute=0` mutes, but its own examples (and community projects) use `mute=1` to mute – the examples are right.
- Verified: `level`, `db=2`, `db=-2`.

---

## 4. Playback control

| Endpoint | Function | Official |
|---|---|:---:|
| `/Action` | skip / back / love / ban on streaming radio | ✓ |
| `/Add` | add / play albums, tracks, playlists | |
| `/Back` | restart the track or previous track | ✓ |
| `/Pause` | pause or toggle play / pause | ✓ |
| `/Play` | play, resume, seek, play a queue entry, a URL or an input | ✓ |
| `/Repeat` | repeat queue / track / off | ✓ |
| `/Shuffle` | shuffle the queue on / off | ✓ |
| `/Skip` | next track | ✓ |
| `/Stop` | stop | ✓ |

### `/Action`

```
/Action?service=<service>&skip=<id>&back=<id>&love=<id>&ban=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | streaming service, e.g. `Slacker` |
| `skip`, `back`, `love`, `ban` | the action with the track id given by the player |

**Response format**

```
skip  |  back  |  love = "1"  |  love @skip="1" = "0"  (ban)  |  response = "<notification>"
```

**Notes**

- Streaming radio (e.g. Slacker, Radio Paradise, Amazon stations) does not use the queue. `/Status` then lists `<actions><action @name="back|skip|love|ban" @url @icon @text @notification @state/>`.
- Invoke the `url` exactly as given; it is usually `/Action?…`, but any URI is possible. An action without `url` is not available.
- If the root is `<response>`, its text is a notification for the user; otherwise show the action's `notification`.

### `/Add`

```
/Add?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&file=<file>&playnow=<1|-1>&where=<last|nextAlbum>&clear=0&shuffle=1&listindex=<n>&nextlist=1&cursor=last
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, a USB id, `Deezer`, `Tidal` |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |
| `file` | single track (file) |
| `playnow` | `1` = play now, `-1` = only add |
| `where` | seen: `last` (end of the queue), `nextAlbum` (after the current album) |
| `clear` | seen as `clear=0` in `add-now` URLs |
| `shuffle` | `1` = add shuffled |
| `listindex`, `nextlist`, `cursor` | used by `autoplayURL` (start at a track, fill the queue with the rest of the album) |

**Notes**

- Which parameters appear depends on the service and the action.
- Verified examples: album play `/Add?playnow=1&service=LocalMusic&album=…&artist=…`; album to the end `/Add?album=…&artist=…&playnow=-1&service=<svc>&where=last`; track `/Add?playnow=1&file=…`.
- Changes the queue id.
- Not documented as a request; appears as `playURL`, `autoplayURL` and `actionURL` in `/Browse` answers (also in the official examples). Take the URLs from the player instead of building them.

### `/Back`

```
/Back
```

No parameters.

**Response format**

```
id = "19"     (new queue position)
```

**Notes**

- After more than 4 s of playback: back to the start of the track; otherwise the previous track (from the first to the last), regardless of repeat.
- Same restrictions as `/Skip`.

### `/Pause`

```
/Pause?toggle=1
```

| Parameter | Meaning |
|---|---|
| `toggle` | `1` = toggle between play and pause |

**Response format**

```
state = "pause"     (with toggle: the new state)
```

**Notes**

- `/Pause` alone pauses. Cancels the timeout of a playing alarm.

### `/Play`

```
/Play?seek=<seconds>&id=<n>&url=<encoded URL>&inputTypeIndex=<type>-<n>&inputIndex=<n>
```

| Parameter | Meaning |
|---|---|
| `seek` | position in seconds within the current track (or within entry `id`) |
| `id` | queue entry to play |
| `url` | URL-encoded stream URL (e.g. an MP3 on the web), or the `URL` attribute of an input from [`/RadioBrowse?service=Capture`](#radiobrowse) (already encoded) |
| `inputTypeIndex` | select an input by type and number, e.g. `spdif-2` (BluOS ≥ 4.2.0) |
| `inputIndex` | select an input by position, from 1, Bluetooth excluded (BluOS 3.8.0 – 4.2.0) |

**Response format**

```
state = "play" | "stream"
```

**Notes**

- `/Play` alone starts / resumes the current source (only from `pause`, not from `stop`).
- `seek` only works when `/Status` has `totlen` / `canSeek=1`. `seek` + `id` is official since v1.6; `id` alone is verified.
- Use `seek` (+ `id`), `id`, `url`, `inputTypeIndex` or `inputIndex`, not several of them.
- `url` with an input: active inputs only; the only way to select inputs of a BluOS HUB (`Hub%3A%2F%2F<ip>%3A11000%2Finput0`). The source must be connected and not hidden.
- `inputTypeIndex`: also works for inactive inputs missing from `/RadioBrowse`; recommended for custom integration. Types: `spdif` (optical), `analog`, `coax`, `bluetooth`, `arc`, `earc`, `phono`, `computer`, `aesebu`, `balanced`, `microphone`; the number starts at 1 per type.
- `inputIndex`: position in `/Settings?id=capture&schemaVersion=32`. The official example writes `InputId`; the parameter table says `inputIndex`.

### `/Repeat`

```
/Repeat?state=<0|1|2>
```

| Parameter | Meaning |
|---|---|
| `state` | `0` = repeat the queue, `1` = repeat the track, `2` = off |

**Response format**

```
playlist @length @id @repeat
```

**Notes**

- Repeats never stop by themselves.

### `/Shuffle`

```
/Shuffle?state=<0|1>
```

| Parameter | Meaning |
|---|---|
| `state` | `1` = shuffle on, `0` = off |

**Response format**

```
playlist @name @modified @length @shuffle @id
```

**Notes**

- `1` builds a shuffled copy of the queue (no effect if already shuffled); `0` restores the original order.
- Changes the queue id (verified).

### `/Skip`

```
/Skip
```

No parameters.

**Response format**

```
id = "21"     (new queue position)
```

**Notes**

- From the last track it goes to the first, regardless of repeat.
- Only for queue playback (no `<streamUrl>` in `/Status`); streaming radio uses [`/Action`](#action).

### `/Stop`

```
/Stop
```

No parameters.

**Response format**

```
state = "stop"
```

**Notes**

- Cancels the timeout of a playing alarm.

---

## 5. Playlist

The play queue is the list the player plays from. Saved playlists belong to the service `BluOS`; in `/Browse` they appear in the top menu (`browseKey="playlists"`) with play URLs and context menus.

| Endpoint | Function | Official |
|---|---|:---:|
| `/Clear` | clear the queue | ✓ |
| `/Delete` | remove a queue entry or delete a saved playlist | ✓ |
| `/Load` | load a saved playlist (or a service playlist) | |
| `/Move` | move a queue entry | ✓ |
| `/Playlist` | list the queue or its status | ✓ |
| `/Playlists` | names of the saved playlists | |
| `/Save` | save the queue as a playlist | ✓ |

### `/Clear`

```
/Clear
```

No parameters.

**Response format**

```
playlist @modified @length="0" @id
```

### `/Delete`

```
/Delete?id=<n>&service=BluOS&name=<name>
```

| Parameter | Meaning |
|---|---|
| `id` | queue position of the entry to remove |
| `service` | `BluOS` – together with `name` |
| `name` | name of the saved playlist to delete |

**Response format**

```
deleted = "9"          (queue entry)
```

**Notes**

- Two functions: `id` removes a **queue entry** (official); `service=BluOS&name=…` deletes a **saved playlist** (verified, context menu type `delete` in `/Browse`; ask the user first). Use one form per request.

### `/Load`

```
/Load?service=<service>&name=<name>&id=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS` for saved playlists, or a streaming service |
| `name` | name of the saved playlist |
| `id` | playlist id of a streaming service (e.g. Tidal) |

**Response format**

Not documented; the queue id changes (verified).

**Notes**

- Replaces the queue with the playlist and plays it. Take the URL from `/Browse` (playlist `playURL`) or from `/Presets` (e.g. `/Load?service=Tidal&id=<uuid>`).

### `/Move`

```
/Move?new=<to>&old=<from>
```

| Parameter | Meaning |
|---|---|
| `new` | new position |
| `old` | current position |

**Response format**

```
moved = "moved"
```

### `/Playlist`

```
/Playlist?start=<first>&end=<last>&length=1
```

| Parameter | Meaning |
|---|---|
| `start` | first entry (0-based) |
| `end` | last entry (inclusive) |
| `length` | `1` = queue status only, no entries |

**Response format**

```
playlist @name @modified (0|1) @length @id (= pid of /Status) [@shuffle]
  song ×n @id (queue position = song of /Status) @service @albumid @artistid @songid
    title, art, alb, fn
```

**Notes**

- `/Playlist` without parameters returns the whole queue – not recommended (very large). Use `start` / `end` for paging.
- Verified: `id` changes on add, remove, shuffle on / off, clear and load.

### `/Playlists`

```
/Playlists?service=BluOS
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS`; has no effect (verified) |

**Response format**

```
playlists @service="BluOS"
  name ×n @image = "<playlist name>"
```

**Notes**

- One request, no paging; `start` / `end` have no effect (verified).
- No play URL – that comes from `/Browse`.

### `/Save`

```
/Save?name=<name>
```

| Parameter | Meaning |
|---|---|
| `name` | name of the new BluOS playlist |

**Response format**

```
saved > entries = "126"
```

**Notes**

- Fails when the queue is empty (community projects).

---

## 6. Presets

Presets are created and deleted only in the BluOS app; they can hold radio stations, playlists and inputs.

| Endpoint | Function | Official |
|---|---|:---:|
| `/Preset` | load a preset, the next or the previous one | ✓ |
| `/Presets` | list the presets | ✓ |
| `/SetPreset` | list the presets (parameters for changing them unknown) | |

### `/Preset`

```
/Preset?id=<id|+1|-1>
```

| Parameter | Meaning |
|---|---|
| `id` | preset id, `+1` = next preset, `-1` = previous preset |

**Response format**

```
loaded @service > entries = "60"      (list of tracks)
state = "stream"                      (radio)
```

**Notes**

- Ids need not be consecutive; `+1` / `-1` wrap around.

### `/Presets`

```
/Presets
```

No parameters.

**Response format**

```
presets @prid (= prid of /Status; changes when presets change)
  preset ×n @id @name @url @image
```

**Notes**

- `url` is the source URL used to load the preset (e.g. `/Load?service=Tidal&id=…` or a radio key).

### `/SetPreset`

```
/SetPreset
```

No known parameters.

**Response format**

```
presets @prid
  preset ×n @id @name @url @image @volume
```

**Notes**

- Verified without parameters: answers the preset list like [`/Presets`](#presets), each preset with `@volume` (volume set when the preset is loaded) and `@url` as a ready request (e.g. `/Play?url=RadioParadise:/42:4/Serenity`, `/Play?url=TuneIn:s16252`).
- The name suggests that presets can be stored or changed with parameters; they are not known and need checking in Bruno before use.

---

## 7. Browse and search

| Endpoint | Function | Official |
|---|---|:---:|
| `/Browse` | menu tree, lists, context menus, search | ✓ |
| `/RadioBrowse` | list of the inputs | ✓ |

### `/Browse`

```
/Browse?key=<key>&q=<text>&withContextMenuItems=<0|1>
```

| Parameter | Meaning |
|---|---|
| `key` | opaque key from `browseKey`, `nextKey`, `parentKey`, `contextMenuKey` or `searchKey` of an earlier answer, URL-encoded. Without `key`: top menu. |
| `q` | search text, together with a `searchKey`; without `key`: top-level search |
| `withContextMenuItems` | `1` = every item gets an inline `<contextMenu>`; `0` drops only the `contextMenu` children, keys and URLs stay (verified) |

**Response format**

```
browse @type @sid @service @serviceName @serviceIcon @searchKey @nextKey @parentKey [@playURL]
  item ×n @type @text @text2 @image @browseKey @playURL @autoplayURL @contextMenuKey @actionURL
          [@inputType @duration @tracks]
    contextMenu > item ×n @type @text @actionURL        (with withContextMenuItems=1)
  category ×n @text @nextKey @parentKey > item ×n        (some answers group the items)
```

**Notes**

- `browse@type`: `menu`, `contextMenu`, `artists`, `composers`, `albums`, `playlists`, `tracks`, `genres`, `sections` (alphabetic sections), `items` (mixed), `folders`.
- `item@type`: `link` (leads further), `audio` (directly playable), `artist`, `composer`, `album`, `playlist`, `track`, `text`, `section`, `folder`.
- `browseKey` = can be opened; `playURL` = default play action (usually clear the queue and play); `autoplayURL` = play this track and fill the queue with the rest of its container; `contextMenuKey` = key of the item's context menu; `actionURL` = action of a context menu item. Which of `playURL` / `autoplayURL` is the default should be a user preference.
- Context menu item types: `favourite-add`, `favourite-delete`, `add-now` (play now), `add-next`, `add-last`, `add-shuffle`, `addAll-now`, `addAll-next`, `addAll-last`, `playRadio`, `delete` (ask the user first).
- Paging: `nextKey` on `browse` or `category`; the chunk size is fixed by the player.
- Streaming services use keys like `/Albums?service=Tidal&category=masters`; their search answers link to `/Artists|Albums|Songs|Playlists?service=…&expr=…`.
- Verified keys for the local library (`<svc>` = `LocalMusic` or the USB id):

  | key | Answer | Size |
  |---|---|---:|
  | (none) | `@type="menu"` · sources, playlists, inputs, radio (`item @browseKey @text @image @type @playURL @inputType`) | 1.2 KB |
  | `<svc>:` | `item ×7` (Artists, Albums, Songs, Genres, Playlists, Composers, Favourites); USB: 6 | 1.0 KB |
  | `…bySection:Album/…` | `@type="sections"` · `item ×27 @browseKey @text @text2` – **`text2` = number of albums in the section**; USB lists only filled sections | 4.4 KB |
  | `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | like Album, with counts | 4–5 KB |
  | `…S:Album/…&section=A` | `@type="albums"` · `item ×143 @browseKey @contextMenuKey @playURL @text @text2 @tracks @image` + context menus | 204 KB (68 KB without context menus) |
  | `<svc>:GG/Genres` | `@type="genres"` · `item ×34 @browseKey @text` | 3.4 KB |
  | `<svc>:MG/LocalMusic-Genre?genre=…` | empty – genre menus have other keys, take them from the genre list | 0.2 KB |
  | `<svc>:MG/LocalMusic-Artist?artist=…` | `item ×2` (albums, songs of the artist); the "Albums" key `<svc>:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=…&service=<svc>` returns all albums of the artist with URLs and context menus, no paging | 0.4 KB |
  | `<svc>:MG/LocalMusic-Favourites` | `item ×4` (favourites by type) | 0.7 KB |
  | `<svc>:MG/LocalMusic-Album?album=…&artist=…` | `@type="tracks" @playURL` · `item ×9 @contextMenuKey @playURL @autoplayURL @text @duration @image` (`type="track"`) | 16.8 KB (7.2 KB without context menus) |
  | `<svc>:CM/LocalMusic-Album?album=…&artist=…[&isFavourite=1]` | `@type="contextMenu"` · `item ×5 @actionURL @text @type` (`favourite-add/-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last`) | 1.0 KB |
  | `<svc>:Search` + `q=love` | `@type="menu"` · `item ×4` (links to artists, albums, songs, composers); every list returns all hits | 0.7 KB |
  | `LocalMusic:Playlist/…imported=1` | imported playlists (empty here) | 0.2 KB |

### `/RadioBrowse`

```
/RadioBrowse?service=Capture
```

| Parameter | Meaning |
|---|---|
| `service` | `Capture` = inputs |

**Response format**

```
radiotime @service="Capture"
  item ×n @text @inputType @id @URL @image @type="audio" @playerName [@serviceType]
  category @text @icon > remoteitem ×n …     (inputs of a BluOS HUB)
```

**Notes**

- Lists the active inputs, cloud sources (e.g. Spotify) and HUB inputs. Play an entry with [`/Play?url=<URL>`](#play).

---

## 8. Favourites

These endpoints appear as `actionURL` values in `/Browse` context menus (also in the official examples), but are not documented as requests. Take the URLs from the player instead of building them.

| Endpoint | Function | Official |
|---|---|:---:|
| `/AddFavourite` | mark a favourite | |
| `/DeleteFavourite` | remove a favourite | |

### `/AddFavourite`

```
/AddFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |

**Notes**

- Verified for the library. The current state shows in the context menu (`favourite-add` or `favourite-delete`) and in `@isFavourite` of `/library/v1` answers.
- USB albums have no favourite actions (verified).

### `/DeleteFavourite`

```
/DeleteFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |

**Notes**

- Verified for the library. Counterpart of [`/AddFavourite`](#addfavourite).

---

## 9. Library

All endpoints of this section answer on port 11000 like every other request. The short forms (`/Albums`, `/Artists`, …) only redirect to the library server on port 11004, which also answers the `/library/v1/…` requests; call `/library/v1/…` directly on port 11000. Everything in this section is verified.

| Endpoint | Function | Official |
|---|---|:---:|
| `/Albums` | redirect to `/library/v1/Albums` | |
| `/Artists` | redirect to `/library/v1/Artists` | |
| `/Composers` | redirect to `/library/v1/Composers` | |
| `/Folders` | redirect to `/library/v1/Folders` | |
| `/Genres` | redirect to `/library/v1/Genres` | |
| `/library/v1/Albums` | albums by section, newest, favourites, quality, genre, artist | |
| `/library/v1/Artists` | artist names | |
| `/library/v1/Composers` | composers | |
| `/library/v1/Folders` | folder tree | |
| `/library/v1/Genres` | all genre names | |
| `/library/v1/Search` | artists, albums, songs for a search term | |
| `/library/v1/Songs` | songs with technical data | |
| `/Songs` | tracks of a saved playlist; otherwise redirect to `/library/v1/Songs` | |

General:
- The root of every answer carries `id` (library: a fixed number, USB: `1`) and `service`, plus all filters passed as attributes.
- `limit` and `start` are **ignored** with `section=`: a section always comes complete.
- `sort=` (according to `/Services`: `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate`) gives an empty answer for albums.
- Paging: `<nextlink>` with the full URL of the next page.
- **No genre per album** in any answer.

### Aliases on port 11000

```
/Artists?…   /Albums?…   /Genres?…   /Composers?…   /Folders?…
```

Parameters: the same as the `/library/v1` endpoint of the same name.

**Response format**

HTTP **302** to `http://<player>:11004/library/v1/<same>?<same parameters>`.

**Notes**

- All tested variants (no parameters, `service`, `start` / `end`, `artist`, `genre`, `album` + `artist`) redirect. Use `/library/v1/…` directly.
- `/Songs` redirects the same way, except with `playlist=` – see [`/Songs`](#songs).

### `/library/v1/Albums`

```
/library/v1/Albums?service=<svc>&section=<letter>&recent=1&category=FAVOURITES&quality=<hr|cd|mqa>&genre=<genre>&artist=<artist>&album=<album>&composer=<composer>&limit=<n>&start=<n>&sort=<sort>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | alphabetic section, e.g. `A` – all albums of the section |
| `recent` | `1` = newest albums (50 per page + `nextlink`) |
| `category` | `FAVOURITES` = favourite albums, one request |
| `quality` | `hr` (HD), `cd`, `mqa` – only together with `section` |
| `genre` | albums of a genre – only together with `section` |
| `artist` | all albums of the artist, one request |
| `album` | with `artist`: one album including `cover` |
| `composer` | albums with songs of the composer |
| `limit`, `start` | ignored with `section` |
| `sort` | gives an empty answer |

**Response format**

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

**Notes**

- Without a filter (or only `service`) the answer is empty.
- Depending on the form the title is `title`, `alb` or the text of `album`.
- Sample: `section=A` = 143 albums, 16.5 KB.

### `/library/v1/Artists`

```
/library/v1/Artists?service=<svc>&section=<letter>&category=FAVOURITES&genre=<genre>&artist=<artist>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | artists of the section |
| `category` | `FAVOURITES` = favourite artists |
| `genre` | artists of a genre – together with `section` |
| `artist` | only the name of this artist |

**Response format**

```
artists @id @service
  sections > section @name > art ×n @isFavourite     (section)
  art @isFavourite                                   (category)
```

**Notes**

- Empty without a filter.

### `/library/v1/Composers`

```
/library/v1/Composers?service=<svc>&section=<letter>&genre=<genre>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | composers of the section |
| `genre` | with `section`: composers of the genre |

**Response format**

```
composers @id @service
  composer ×51                                       (no filter, + nextlink)
  sections > section > composer ×n                   (section)
```

**Notes**

- Without a filter: pages of 51 with `nextlink`.

### `/library/v1/Folders`

```
/library/v1/Folders?service=<svc>&path=<path>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `path` | folder to list; without it the root of the share |

**Response format**

```
folders > subfolders > folder ×n
  songs > song ×n                                    (with path)
```

### `/library/v1/Genres`

```
/library/v1/Genres?service=<svc>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |

**Response format**

```
genres @id @service @length="34"
  genre ×34 = "Alternative Rock"
```

**Notes**

- All genre names in one request (1 KB), but no keys for `/Browse`.
- `category`, `album` and `artist` are ignored.

### `/library/v1/Search`

```
/library/v1/Search?service=<svc>&expr=<text>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `expr` | search term |

**Response format**

```
search @expr @id @service
  artists > artist ×≤25 > name
  albums  > album ×≤25 @tracks > title, art, cover
  songs   > song ×≤25 > title, art, alb, fn, track, time, date, quality, …
```

**Notes**

- At most 25 hits per type, no `nextlink`. The search via `/Browse` returns all hits.

### `/library/v1/Songs`

```
/library/v1/Songs?service=<svc>&album=<album>&artist=<artist>&composer=<composer>&section=<letter>&genre=<genre>&category=FAVOURITES&limit=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `album` | with `artist`: all songs of the album with technical data |
| `artist` | alone: all songs of the artist, one request |
| `composer` | songs of the composer |
| `section` | songs of the section, paged |
| `genre` | with `section`: songs of the genre, 50 per page |
| `category` | `FAVOURITES` – empty (no song favourites) |
| `limit` | page size; works here (e.g. `section=A&limit=5`) |

**Response format**

```
songs @album @artist @id @service
  song ×n @samplerate @samplebits @channels @bitrate @atype
    songID, art, alb, title, track, date, time, quality, fn
    (depending on the song also: discno, composer, compilation, albumartist)
  nextlink                                           (paged lists)
```

**Notes**

- Empty with only `service`.
- The lists (`section`, `genre`) lack the technical attributes and `songID`, `track`, `date`, `time`.
- `quality` of MP3 files is the bitrate; recognise them by `atype`.

### `/Songs`

```
/Songs?service=BluOS&playlist=<name>&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS` |
| `playlist` | name of the saved playlist |
| `offset` | first track of the page (from `nextlink`) |

**Response format**

```
songs @service="BluOS" @playlist
  song ×10 @service
    art, alb, title, track, date, time, fn, quality
  nextlink = "/Songs?playlist=…&offset=10"
```

**Notes**

- Verified; 10 tracks per page. Runs on port 11000 (no redirect), unlike the other `/Songs` requests.
- Without `playlist`, `/Songs` is only a 302 redirect to [`/library/v1/Songs`](#libraryv1songs) (see [aliases](#aliases-on-port-11000)).

---

## 10. Artwork

| Endpoint | Function | Official |
|---|---|:---:|
| `/Artwork` | cover art of albums, tracks, playlists, stations | ✓ |
| `/library/v1/Artwork` | album cover from the library server | |

### `/Artwork`

```
/Artwork?service=<svc>&album=<album>&artist=<artist>&songid=<id>&albumid=<id>&fn=<file>&playlistimage=<id>&followRedirects=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the image |
| `album`, `artist` | album of the local library |
| `songid`, `albumid` | track / album of a streaming service |
| `fn` | file of the local library (e.g. image of a saved playlist) |
| `playlistimage` | image of a streaming playlist |
| `followRedirects` | `1` = answer with the image itself instead of a redirect |

**Response format**

The image (200, e.g. `image/jpeg`); without `followRedirects=1` a **301** to `http://<player>:11004/library/v1/Artwork?…` (library).

**Notes**

- Which identifying parameters appear depends on the service; take the URL from the `image` attribute of an answer and append `followRedirects=1` (official since v1.7, verified).
- Other image paths in answers (`/images/…`, `/Sources/images/…`) are static files on the player.

### `/library/v1/Artwork`

```
/library/v1/Artwork?service=<svc>&album=<album>&artist=<artist>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `album`, `artist` | the album |

**Response format**

The image itself (200, `image/jpeg`).

**Notes**

- Target of the `/Artwork` redirect (there on port 11004); also answers on port 11000. Only `artist=` → 200 without content.

---

## 11. Player grouping

The primary player selects the source; secondary players follow. Fixed groups (home theatre, stereo pairs) are set up in the BluOS app.

| Endpoint | Function | Official |
|---|---|:---:|
| `/AddSlave` | add players to a group | ✓ |
| `/proxyToSlave` | forward a request to a group member | |
| `/RemoveSlave` | remove players from a group | ✓ |

### `/AddSlave`

```
/AddSlave?slave=<ip>&port=<port>&group=<name>&slaves=<ip1>,<ip2>&ports=<p1>,<p2>
```

| Parameter | Meaning |
|---|---|
| `slave` | IP address of one secondary player |
| `port` | its port (default 11000) |
| `group` | optional group name; without it BluOS picks one |
| `slaves` | comma-separated IP addresses of several secondary players |
| `ports` | their ports, comma-separated |

**Response format**

```
addSlave
  slave ×n @id @port
```

**Notes**

- Send to the primary player. Use `slave` + `port` or `slaves` + `ports`.
- An NAD CI580 needs the node port.

### `/proxyToSlave`

```
/proxyToSlave?slave=<ip>%3A<port>&url=<encoded path>
```

| Parameter | Meaning |
|---|---|
| `slave` | address and port of the group member |
| `url` | URL-encoded request to forward, e.g. `%2Faudiomodes` |

**Notes**

- Seen as `url` of fixed group members in `/Settings` (audio settings of a surround speaker).

### `/RemoveSlave`

```
/RemoveSlave?slave=<ip>&port=<port>&slaves=<ip1>,<ip2>&ports=<p1>,<p2>
```

| Parameter | Meaning |
|---|---|
| `slave`, `port` | one player to remove |
| `slaves`, `ports` | several players, comma-separated |

**Response format**

The [`/SyncStatus`](#syncstatus) answer of the primary player.

**Notes**

- Removing the primary of a group of 3 or more players leaves the rest as a new group.
- Also the "Delete fixed group" button in `/Settings`.
- To leave a group, community projects call `/RemoveSlave` with the player's own address.

---

## 12. System

| Endpoint | Function | Official |
|---|---|:---:|
| `/Alarms` | list of the alarms with time, days, source and volume | |
| `/alsa_setting` | listening mode and tone controls | |
| `/audiomodes` | audio and Bluetooth modes | ✓ |
| `/audioPreset` | current listening mode and its choices | |
| `/Doorbell` | play the doorbell chime | ✓ |
| `/GitVersion` | BluOS version | |
| `/LastScanCode` | last received IR code | |
| `/Name` | player name | |
| `/reboot` | soft reboot (POST, port 80) | ✓ |
| `/Reindex` | rescan the music library | |
| `/Services` | self-description of the sources | |
| `/setting` | change a simple setting | |
| `/Settings` | settings tree of the player | ✓ |
| `/sharecfg` | web page for network shares (port 80) | |
| `/ShowIRCodes` | IR codes learned from a paired remote control | |
| `/Sleep` | step the sleep timer | |
| `/update` | purpose unknown (presumably firmware update status) | |
| `/upgrade` | redirect to a web page, presumably the firmware upgrade | |
| `/Version` | API version | |

### `/Alarms`

```
/Alarms
```

No known parameters.

**Response format**

```
alarms @supportsEndTime="true"
  alarm ×n @id @enable @hour @minute @days @duration @end @volume @voldb @fadein
           @source @url @image @useBackup
```

**Notes**

- Verified. Without alarms the list is empty.
- Alarm attributes (sample: `hour="8" minute="0" days="0000001" duration="60" end="0900"`):

  | Attribute | Meaning |
  |---|---|
  | `id` | alarm id |
  | `enable` | `1` = on, `0` = off |
  | `hour`, `minute` | start time |
  | `days` | seven flags, one per weekday from Sunday to Saturday (`1` = active), e.g. `0000001` = Saturday (verified with a Saturday alarm) |
  | `duration` | playing time in minutes |
  | `end` | end time `HHMM` (start + `duration`) |
  | `volume`, `voldb` | alarm volume (0–100) and the same in dB |
  | `fadein` | `1` = fade the volume in |
  | `source`, `url`, `image` | what plays: name, play request (e.g. `/Play?url=RadioParadise:/1:4/Mellow Mix`), image |
  | `useBackup` | presumably a fallback sound when the source is not available |

- `@supportsEndTime`: alarms can have an end time; while an alarm plays, `/Status` shows the rest in `alarmsecondsremaining`.
- `/Settings` shows the alarms as a setting of class `alarms` with `@count` and `@enabled`.

### `/alsa_setting`

```
/alsa_setting?preset=<mode>&eq-switch=<ON|OFF>&eq-treble=<n>&eq-bass=<n>&eq-balance=<n>&eq-centre-trim=<n>&eq-crossover=<n>
```

| Parameter | Meaning |
|---|---|
| `preset` | listening mode, a `value@name` from [`/audioPreset`](#audiopreset) (e.g. `MUSIC`, `MOVIE`, `TV`) |
| `eq-switch` | tone controls ON / OFF |
| `eq-treble`, `eq-bass` | treble, bass |
| `eq-balance` | balance |
| `eq-centre-trim` | centre level |
| `eq-crossover` | crossover frequency |

**Notes**

- From community projects; for players with DSP.

### `/audiomodes`

```
/audiomodes?bluetoothAutoplay=<0–3>&subwoofer=<name>&ears=<ON|OFF>&mqaDisable=<ON|OFF>&fixedVolume=<ON|OFF>&volumeLimits=<min>,<max>&replayGainMode=<name>&channelMode=<name>&enableClockTrim=<ON|OFF>
```

| Parameter | Meaning |
|---|---|
| `bluetoothAutoplay` | Bluetooth mode: `0` = manual, `1` = automatic, `2` = guest, `3` = disabled |
| `subwoofer` | subwoofer mode |
| `ears` | ON / OFF |
| `mqaDisable` | MQA decoding off (ON) / on (OFF) |
| `fixedVolume` | fixed volume ON / OFF |
| `volumeLimits` | minimum and maximum volume in dB |
| `replayGainMode` | replay gain mode |
| `channelMode` | channel mode |
| `enableClockTrim` | ON / OFF |

**Notes**

- Only `bluetoothAutoplay` is official (no answer body); the others come from community projects. `/Settings?id=audio` shows the current values and choices.

### `/audioPreset`

```
/audioPreset
```

No known parameters.

**Response format**

```
setting @id="preset" @name="preset" @displayName="Listening Mode" @url="http://<player>:11000/alsa_setting"
        @class="list" @value="MUSIC" @refresh @required @style
  value ×n @name @displayName @icon @iconActive        (e.g. MUSIC, MOVIE, TV)
```

**Notes**

- Verified: answers the listening mode setting in the format of `/Settings`; `@value` is the current mode.
- Change it with [`/alsa_setting?preset=<name>`](#alsa_setting) (the `@url` of the answer), using a `value@name` as `<name>`.

### `/Doorbell`

```
/Doorbell?play=1
```

| Parameter | Meaning |
|---|---|
| `play` | always `1` |

**Response format**

```
status @enable @volume @chime="Doorbell:audio/chime_1.mp3"
```

### `/GitVersion`

```
/GitVersion
```

No parameters.

**Response format**

```
version = "4.18.18"
```

### `/LastScanCode`

```
/LastScanCode
```

No known parameters.

**Response format**

```
lastscancode = "-1465131975"
```

**Notes**

- Verified: the code of the last IR signal the player received, as a signed 32-bit number. As unsigned hex it is the `value` of [`/ShowIRCodes`](#showircodes): after pressing volume down on a paired remote the answer was `-1465131975` = `0xa8abdc39` = `KEY_VOLUMEDOWN`.
- Useful when learning a remote control: press a button, then read the code.

### `/Name`

```
/Name
```

No parameters.

**Response format**

```
name = "Living Room"
```

**Notes**

- Verified. The same name is in `@name` of [`/SyncStatus`](#syncstatus).

### `/reboot`

```
POST http://<player>:80/reboot   (form field yes=1)
```

| Parameter | Meaning |
|---|---|
| `yes` | any value |

**Response format**

An HTML page ("Rebooting…").

**Notes**

- Example: `curl -d yes=1 http://<player>/reboot`.

### `/Reindex`

```
/Reindex
```

No parameters.

**Notes**

- Starts a rescan of the music library ("Reindex music collection" button in `/Settings`).
- `/Status` has an `<indexing>` element (0 in the official sample), presumably the indexing state.

### `/Services`

```
/Services
```

No parameters.

**Notes**

- Per service the `browseRequest`, `requestParameter`, `requestItemParameter`, `genreItemParameter`, `filter`, `sort` and `search` definitions. Source of the `/library/v1` parameter names in [Library](#9-library).

### `/setting`

```
/setting?<name>=<value>
```

| Parameter | Meaning |
|---|---|
| `<name>` | `@name` of a setting whose `@url` is `/setting`, e.g. `zonename`, `amplifierStandby`, `resizeall`, `server`, `centre` |
| `<value>` | new value; booleans use `ON` / `OFF` |

**Notes**

- The form is presumed from community projects (`/setting?centre=ON|OFF`); the names come from `/Settings`.

### `/Settings`

```
/Settings?id=<menu id>&schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `id` | sub menu, e.g. `audio`, `capture`; without it the top level |
| `schemaVersion` | schema the client understands (32 in the official example) |

**Response format**

```
settings @schemaVersion
  setting @id @name @displayName @class @value @url @icon [@description @explanation @pattern …]
  menuGroup @id @displayName @url @icon [@inline @description] > setting ×n, menuGroup ×n
```

**Notes**

- The tree the BluOS app shows. `@class` tells the control (`text`, `boolean`, `list`, `button`, `alarms`, `sleep`, …); `@url` is the endpoint that changes the setting (`/setting`, `/audiomodes`, `/Reindex`, `/RemoveSlave`, `/proxyToSlave?…`, `http://<player>:80/sharecfg?noheader=1`).
- Verified on the Powernode (schema 28 without the parameter): alarms, sleep timer, audio, room / zone name (`zonename`), amplifier standby, fixed group members, network shares (`sharecfg`), reindex, artwork optimisation (`resizeall`), server mode (`server`).

### `/sharecfg`

```
http://<player>:80/sharecfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Notes**

- Web page of the player for the network shares of the library; seen in `/Settings`.

### `/ShowIRCodes`

```
/ShowIRCodes
```

No known parameters.

**Response format**

```
IRCodes @test
  code ×n
    key   = "KEY_PLAY"
    value = "0x8fe633c"
```

**Notes**

- Verified with a paired (learned) IR remote control: one `code` per learned button, `key` = player function, `value` = learned IR code (hex).
- Keys seen: `KEY_0` … `KEY_9` (presumably the presets), `KEY_PLAY`, `KEY_PAUSE`, `KEY_NEXTSONG`, `KEY_PREVIOUSSONG`, `KEY_VOLUMEUP`, `KEY_VOLUMEDOWN`, `KEY_MUTE`.
- Without a paired remote the list is presumably empty.

### `/Sleep`

```
/Sleep
```

No parameters.

**Response format**

```
sleep = "30"     (minutes until the player switches off)
```

**Notes**

- Verified: the answer is the minutes until the player switches off.
- Each call steps the timer: 15 → 30 → 45 → 60 → 90 min → off (community projects), so even a call just to read the value changes the timer. To only read it, use `<sleep>` in [`/Status`](#status).

### `/update`

```
/update
```

No known parameters.

**Response format**

```
update = "no message"
```

**Notes**

- Verified without parameters; the purpose is unknown. The name and the answer suggest a firmware update status or message ("no message" = nothing to report); the upgrade itself presumably runs via [`/upgrade`](#upgrade).
- Do not try parameters on a real player without care: an update endpoint may start a firmware update.

### `/upgrade`

```
/upgrade
```

No known parameters.

**Response format**

An HTTP redirect to a web page (not XML).

**Notes**

- Seen on the player: the request redirects to a web page, presumably the firmware upgrade page of the player. Not checked further.
- Open it only on purpose: the page may start a firmware upgrade. Compare [`/update`](#update).

### `/Version`

```
/Version
```

No parameters.

**Response format**

```
version = "v0.5.43"
```
