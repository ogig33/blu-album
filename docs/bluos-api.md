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
13. [App UI](#13-app-ui)

---

## 1. Basics

- **Requests:** HTTP GET, `http://<player>:<port>/<Request>?<parameters>`; parameters are URL-encoded name/value pairs (UTF-8). Answers are UTF-8 XML. Exceptions: `/reboot` (POST, port 80), `/upload_playlists_api` (POST, port 80). The BluOS app sends settings (`/setting`, `/audiomodes`, `/alsa_setting`, also through `/proxyToSlave`) as POST with a JSON body `{"<name>":"<value>"}`; the same settings also work as GET with `?<name>=<value>` (verified).
- **Ports:**

  | Port | Use |
  |---|---|
  | 11000 | control API of every player |
  | 11010, 11020, 11030 | nodes 2–4 of an NAD CI580 (node 1 = 11000); discover via mDNS |
  | 11004 | library server; the short library endpoints (`/Albums`, `/Artwork`, …) redirect here. The same `/library/v1/…` requests also answer on 11000 |
  | 80 | web pages of the player: `/reboot`, `/sharecfg`, `/wificfg`, `/triggercfg`, `/download_playlists_api`, `/upload_playlists_api` |

- **Official / unofficial:** the column "Official" in each category overview marks endpoints of the official documentation. Unofficial endpoints come from the player's own answers (`url`, `playURL`, `actionURL` attributes), from community projects, from captures of the BluOS app's traffic (Wireshark) or from tests; they may change with any BluOS update.
- **Verified** (column in each category overview, and in the notes) means checked on a Bluesound Powernode, BluOS 4.18.18, API v0.5.43, library on a network share (`service=LocalMusic`) and a USB drive (`service=<USB id>`), with the Bruno collection `tests/api`.
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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Status` | playback and volume state, long polling | ✓ | ✓ |
| `/SyncStatus` | player identity, volume and grouping, long polling | ✓ | ✓ |

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
  service, serviceName, serviceType, serviceIcon, image, currentImage, stationImage, infourl, lyricsid, fn
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
- Radio streams may lack `title3` (verified with Radio Paradise: only `title1`, `title2`); `infourl` and `lyricsid` feed [`/Info`](#info).

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
SyncStatus @etag @syncStat @id="<ip>:<port>" @name @brand @model @modelName @class @icon @mac @version
           @volume (0–100, -1 fixed) @db @mute @muteVolume @muteDb @group @initialized @schemaVersion
           @zone @zoneController @zoneMaster @zoneSlave @zoneUngroup @channelMode @channelName @distance @outlevel
  master @port @reconnecting = "<ip>"     only on a secondary player
  slave ×n @id @port                      only on the primary player of a normal group
  zoneSlave ×n @id @port @name @model @modelName @icon @channelMode @channelName @distance @zoneSubnet
                                          members of a fixed group (home theatre, stereo pair)
  zoneOptions @multi
  pairWithSub, bluetoothOutput
  audioPresetUrl @url="/audioPreset"
  battery @level @charging @icon
```

**Notes**

- Verified (fixed home theatre group): `version` = BluOS version, `class` (e.g. `streamer-amplifier`), `zoneController="true"` on the primary of the fixed group, `zoneUngroup` = request that dissolves it (`/RemoveSlave?slaves=…&ports=…`), one `zoneSlave` per surround speaker with its `channelMode` (`side_left`, `side_right`, …) and `distance` in m; `audioPresetUrl` points to [`/audioPreset`](#audiopreset).
- Poll `/SyncStatus` when only name, volume and grouping matter; `/Status` for playback.
- `initialized="false"`: the player still needs setup in the BluOS app.

---

## 3. Volume

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Volume` | read / set the volume, step in dB, mute | ✓ | ✓ |

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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Action` | skip / back / love / ban on streaming radio | ✓ | ✓ |
| `/Add` | add / play albums, tracks, playlists | | ✓ |
| `/Back` | restart the track or previous track | ✓ | ✓ |
| `/Pause` | pause or toggle play / pause | ✓ | ✓ |
| `/Play` | play, resume, seek, play a queue entry, a URL or an input | ✓ | ✓ |
| `/Repeat` | repeat queue / track / off | ✓ | ✓ |
| `/Shuffle` | shuffle the queue on / off | ✓ | ✓ |
| `/Skip` | next track | ✓ | ✓ |
| `/Stop` | stop | ✓ | ✓ |

### `/Action`

```
/Action?service=<service>&skip=<id>&next=<id>&back=<id>&love=<id>&ban=<id>&action=<addFavourite|deleteFavourite>
```

| Parameter | Meaning |
|---|---|
| `service` | streaming service, e.g. `Slacker` |
| `skip`, `next`, `back`, `love`, `ban` | the action with the track id given by the player (Radio Paradise uses `next` for its skip action) |
| `action` | `addFavourite` / `deleteFavourite`: favourite of a streaming item (from [`/Services`](#services)) |

**Response format**

```
skip [= "1"]  |  back  |  love = "1"  |  love @skip="1" = "0"  (ban)  |  response = "<notification>"
```

**Notes**

- Streaming radio (e.g. Slacker, Radio Paradise, Amazon stations) does not use the queue. `/Status` then lists `<actions><action @name="back|skip|love|ban" @url @icon @text @notification @state/>`.
- Invoke the `url` exactly as given; it is usually `/Action?…`, but any URI is possible. An action without `url` is not available.
- Verified with Radio Paradise: `/Status` offered `<action name="back"/>` (no url, not available) and `<action name="skip" url="/Action?service=RadioParadise&next=55833"/>`; the skip answered `<skip>1</skip>`.
- If the root is `<response>`, its text is a notification for the user; otherwise show the action's `notification`.

### `/Add`

```
/Add?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&genre=<genre>&path=<path>&playlist=<name>&playlistid=<id>&file=<file>&playnow=<1|-1>&where=<next|nextAlbum|last>&clear=0&shuffle=<0|1>&listindex=<n>&nextlist=1&cursor=last
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, a USB id, `Deezer`, `Tidal` |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |
| `genre` | all songs of a genre |
| `path` | all songs of a folder |
| `playlist`, `playlistid` | a saved playlist (name) or a service playlist (id) |
| `file` | single track (file) |
| `playnow` | `1` = play now, `-1` = only add |
| `where` | `next` (after the current track), `nextAlbum` (after the current album), `last` (end of the queue) |
| `clear` | `0` in all "play now" requests |
| `shuffle` | `1` = add shuffled, `0` = in order |
| `listindex`, `nextlist`, `cursor` | used by `autoplayURL` (start at a track, fill the queue with the rest of the album) |

**Notes**

- Which parameters appear depends on the service and the action; [`/Services`](#services) lists them per menu entry (play now, shuffle, add next, add last).
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
/Play?seek=<seconds>&id=<n>&url=<encoded URL>&title=<name>&image=<image>&inputTypeIndex=<type>-<n>&inputIndex=<n>
```

| Parameter | Meaning |
|---|---|
| `seek` | position in seconds within the current track (or within entry `id`) |
| `id` | queue entry to play |
| `url` | URL-encoded stream URL (e.g. an MP3 on the web), or the `URL` attribute of an input from [`/RadioBrowse?service=Capture`](#radiobrowse) (already encoded) |
| `inputTypeIndex` | select an input by type and number, e.g. `spdif-2` (BluOS ≥ 4.2.0) |
| `inputIndex` | select an input by position, from 1, Bluetooth excluded (BluOS 3.8.0 – 4.2.0) |
| `title`, `image` | the BluOS app sends them with an input URL (name and icon of the input) |

**Response format**

```
state = "play" | "stream"
```

**Notes**

- `/Play` alone starts / resumes the current source (only from `pause`, not from `stop`).
- `seek` only works when `/Status` has `totlen` / `canSeek=1`. `seek` + `id` (official since v1.6) and `id` alone are verified; `seek` + `id` also returns from a radio stream to the queue (answer `<state>play</state>`).
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

- Verified. Cancels the timeout of a playing alarm.

---

## 5. Playlist

The play queue is the list the player plays from. Saved playlists belong to the service `BluOS`; in `/Browse` they appear in the top menu (`browseKey="playlists"`) with play URLs and context menus.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/AddToPlaylist` | add an album or a song to a saved playlist | | ✓ |
| `/AddToPlaylistOptions` | choices for adding an album or a song to a saved playlist | | ✓ |
| `/Clear` | clear the queue | ✓ | ✓ |
| `/Delete` | remove a queue entry or delete a saved playlist | ✓ | ✓ |
| `/Load` | load a saved playlist (or a service playlist) | | ✓ |
| `/Move` | move a queue entry | ✓ | ✓ |
| `/Playlist` | list the queue or its status | ✓ | ✓ |
| `/Playlists` | names of the saved playlists | | ✓ |
| `/Save` | save the queue as a playlist | ✓ | ✓ |

### `/AddToPlaylist`

```
/AddToPlaylist?sourceService=<svc>&album=<album>&artist=<artist>&name=<playlist>
```

| Parameter | Meaning |
|---|---|
| `sourceService` | source of the item |
| `album` + `artist` | album to add (or the item parameters of the song) |
| `name` | name of the saved playlist to add to |

**Response format**

```
addToPlaylist @service="BluOS"
```

**Notes**

- The request is built from the answer of [`/AddToPlaylistOptions`](#addtoplaylistoptions): its `urlPath` with the `requestParameter` values, plus `name`.
- Verified: adding a library album to a test playlist made the playlist longer (counted with [`/Songs`](#songs)); the test playlist was deleted again.

### `/AddToPlaylistOptions`

```
/AddToPlaylistOptions?service=<svc>&album=<album>&artist=<artist>&songid=<id>&saveQueue=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the item |
| `album` + `artist` | album to add |
| `songid` | song to add |
| `saveQueue` | `1` = options for saving the queue as a playlist (result type `SaveQueueOptions`, seen in `/ui/Queue`; read by Bruno V24) |

**Response format**

```
addToPlaylistOptions @service
  urlPath = "/AddToPlaylist"
  requestParameter ×n = "sourceService=LocalMusic" | "album=…" | "artist=…"
  playlists @service @create="1" @serviceName="BluOS" @serviceIcon
    name ×n @image = "<playlist name>"
```

**Notes**

- Verified (library album): the answer describes the follow-up request – [`/AddToPlaylist`](#addtoplaylist) with the given parameters – and lists the saved playlists to choose from; `create="1"` = a new playlist may be created.
- Read only; nothing is added.
- With `saveQueue=1` (verified) the answer is `saveQueueOptions` with `urlPath` = `/Save`, the current queue `name`, an `overwrite` entry (`service=BluOS`, `name=…`), an `explanation` (e.g. songs from the library can only be saved in a BluOS playlist) and the playlists per service (`create`, `disable`).

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

**Notes**

- Verified: moving entry 0 to position 1 and back.

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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Preset` | load a preset, the next or the previous one | ✓ | ✓ |
| `/Presets` | list the presets | ✓ | ✓ |
| `/SetPreset` | store an item as a preset; without parameters the preset list | | ✓ |

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

- Verified with `id=+1` (radio preset): answer `<state>stream</state>`.
- Ids need not be consecutive; `+1` / `-1` wrap around.
- The preset's `volume` (see [`/Presets`](#presets)) is applied.

### `/Presets`

```
/Presets
```

No parameters.

**Response format**

```
presets @prid (= prid of /Status; changes when presets change)
  preset ×n @id @name @url @image @volume
```

**Notes**

- Verified. `url` is the ready request that plays the preset, e.g. `/Play?url=RadioParadise:/42:4/Serenity` or `/Play?url=TuneIn:s16252` (the official example also shows `/Load?service=Tidal&id=…`).
- `volume`: volume set when the preset is loaded.
- Ids need not be consecutive (here 1–4 and 6).

### `/SetPreset`

```
/SetPreset?id=<slot>&name=<name>&url=<url>&encoded_url=<url>&image=<image url>&volume=<0–100>
```

| Parameter | Meaning |
|---|---|
| `id` | preset slot; alone (`/SetPreset?id=5`) it deletes the preset |
| `name` | name of the preset |
| `url` | play request of the item (e.g. its `playURL`) |
| `encoded_url` | source URL as the app sends it, e.g. `RadioParadise:/3:20/The%20Globe` |
| `image` | image of the preset |
| `volume` | volume set when the preset is loaded |

**Response format**

```
presets @prid
  preset ×n @id @name @url @image @volume
```

**Notes**

- Without parameters (verified) the answer is the preset list, the same as [`/Presets`](#presets).
- Verified with `name`, `url`, `image` (parameters from [`/Services`](#services)): stores the preset in the first free slot (here id 5), answers the new preset list; `prid` changes; `url` is stored URL-encoded and without `volume`.
- The BluOS app edits a preset with `id`, `name`, `volume`, `image`, `encoded_url` and deletes it with `id` alone (seen in a capture of the BluOS app (Wireshark); deleted the test preset).

---

## 7. Browse and search

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Browse` | menu tree, lists, context menus, search | ✓ | ✓ |
| `/Info` | information on an artist, album, track or station (last.fm, lyrics, technical data) | | ✓ |
| `/RadioBrowse` | list of the inputs; radio menus | ✓ | ✓ |

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

### `/Info`

```
/Info?service=<svc>&artist=<artist>&album=<album>&title=<title>&category=technical&filename=<file>&lyricsid=<id>&infourl=<url>&url=<url>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic` or the USB id |
| `artist` | artist info; with `album` album info, with `album` + `title` track info |
| `category` | `technical` together with `filename`: technical data of a file (short form, result type `BriefInfo`) |
| `filename` | file of the track |
| `lyricsid` | lyrics of a track (short form, result type `BriefInfo`) |
| `infourl` | info page of the playing item (compare `<infourl>` in `/Status`) |
| `url` | info on a radio station or stream |

**Notes**

- The variants come from the player's description in [`/Services`](#services) (menu entries of type `info`).
- Verified: artist / album / track info of the library redirects to last.fm; `category=technical&filename=…` answered empty. Not usable for BluAlbum.
- Verified with `infourl` (Radio Paradise, `<infourl>` from `/Status`): answers the info web page itself (here a Wikipedia page, HTML).
- `lyricsid` and `url` not tried yet.

### `/RadioBrowse`

```
/RadioBrowse?service=<service>&url=<url>&c=<category>
```

| Parameter | Meaning |
|---|---|
| `service` | `Capture` = inputs; `Presets` = presets as browse list; `Alarms` = sources for an alarm; otherwise a radio service (e.g. `TuneIn`, `RadioParadise`) |
| `url` | e.g. `presets` (favourite stations of a service), `playlists` (with `service=Alarms`) |
| `c` | radio menus: `station`, `podcast`, `related` (related stations), `selectStream` |

**Response format**

```
radiotime @service="Capture"
  item ×n @text @id @type="audio" @inputType @typeIndex @URL @image [@playerName @serviceType]
  category @text @icon > remoteitem ×n …     (inputs of a BluOS HUB)
```

**Notes**

- Verified with `service=Capture`: lists the active inputs (here Bluetooth, HDMI ARC, optical input 1), cloud sources (e.g. Spotify) and HUB inputs. `typeIndex` (e.g. `spdif-1`, `arc-1`) is the value for [`/Play?inputTypeIndex=`](#play); play an entry with `/Play?url=<URL>`.
- The radio variants (`url`, `c`) come from the player's description in [`/Services`](#services); not tried yet.
- `service=Presets`, `service=Alarms` (also `&url=playlists`) and `service=RadioParadise` seen in a capture of the BluOS app (Wireshark).

---

## 8. Favourites

These endpoints appear as `actionURL` values in `/Browse` context menus (also in the official examples), but are not documented as requests. Take the URLs from the player instead of building them.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/AddFavourite` | mark a favourite | | ✓ |
| `/DeleteFavourite` | remove a favourite | | ✓ |

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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Albums` | redirect to `/library/v1/Albums` | | ✓ |
| `/Artists` | redirect to `/library/v1/Artists` | | ✓ |
| `/Composers` | redirect to `/library/v1/Composers` | | ✓ |
| `/Folders` | redirect to `/library/v1/Folders` | | ✓ |
| `/Genres` | redirect to `/library/v1/Genres` | | ✓ |
| `/library/v1/Albums` | albums by section, newest, favourites, quality, genre, artist | | ✓ |
| `/library/v1/Artists` | artist names | | ✓ |
| `/library/v1/Composers` | composers | | ✓ |
| `/library/v1/Folders` | folder tree | | ✓ |
| `/library/v1/Genres` | all genre names | | ✓ |
| `/library/v1/Playlists` | imported or favourite playlists of the library | | ✓ |
| `/library/v1/Search` | artists, albums, songs for a search term | | ✓ |
| `/library/v1/Songs` | songs with technical data | | ✓ |
| `/Songs` | tracks of a saved playlist; otherwise redirect to `/library/v1/Songs` | | ✓ |

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

### `/library/v1/Playlists`

```
/library/v1/Playlists?service=<svc>&imported=1&category=FAVOURITES
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `imported` | `1` = playlists imported from the share (e.g. M3U files) |
| `category` | `FAVOURITES` = favourite playlists |

**Response format**

```
playlists @imported | @category @id @service
  (entries not seen yet)
```

**Notes**

- Verified: both variants answer, empty on the test player (no imported or favourite playlists). Parameters from the player's description in [`/Services`](#services).

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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Artwork` | cover art of albums, tracks, playlists, stations | ✓ | ✓ |
| `/library/v1/Artwork` | album cover from the library server | | ✓ |

### `/Artwork`

```
/Artwork?service=<svc>&album=<album>&artist=<artist>&songid=<id>&albumid=<id>&fn=<file>&playlistimage=<id>&width=<px>&height=<px>&followRedirects=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the image |
| `album`, `artist` | album of the local library |
| `songid`, `albumid` | track / album of a streaming service |
| `fn` | file of the local library (e.g. image of a saved playlist) |
| `playlistimage` | image of a streaming playlist |
| `width`, `height` | size of the image in pixels (the app asks e.g. 480 × 480, 75 × 75) |
| `followRedirects` | `1` = answer with the image itself instead of a redirect |

**Response format**

The image (200, e.g. `image/jpeg`); without `followRedirects=1` a **301** to `http://<player>:11004/library/v1/Artwork?…` (library).

**Notes**

- Which identifying parameters appear depends on the service; take the URL from the `image` attribute of an answer and append `followRedirects=1` (official since v1.7, verified).
- Other image paths in answers (`/images/…`, `/Sources/images/…`) are static files on the player; they also take `width`, `height` and `style` (e.g. `Bluesound`).

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

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/AddSlave` | add players to a group | ✓ | |
| `/proxyToSlave` | forward a request to a group member | | ✓ |
| `/RemoveSlave` | remove players from a group | ✓ | |
| `/SlaveVolume` | level trim of a member of a fixed group | | ✓ |

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

**Response format**

The answer of the forwarded request, e.g. the `SyncStatus` of the member.

**Notes**

- Seen as `url` of fixed group members in `/Settings` (audio settings of a surround speaker).
- Verified with `url=%2FSyncStatus`: answers the member's `/SyncStatus` (with `managedZoneSlave="true"`, `pairSlaveOnly`, `master`, `slaveVol`).
- Changes settings of a group member: the app sends `POST /proxyToSlave?slave=<ip>%3A<port>&url=%2Fsetting` with the JSON body of the setting, e.g. `{"ledbrightness":"dim"}` (seen in a capture of the app).

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

### `/SlaveVolume`

```
/SlaveVolume?slave=<ip>:<port>&db=<dB>
```

| Parameter | Meaning |
|---|---|
| `slave` | address and port of the group member |
| `db` | level trim in dB, -30 … 30 in steps of 1 |

**Response format**

```
slaveVolume @min="-30" @max="30" @step="1" @isBalance="false" = "1"     (new trim in dB)
```

**Notes**

- Seen in `/Settings?id=audio` of a fixed home theatre group ("Right Surround Trim", setting name `db`).
- Verified: trim 0 → 1 dB, read back from `/Settings?id=audio`, restored. The member's own `/SyncStatus` shows the trim as `<slaveVol>`.

---

## 12. System

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/Alarms` | list of the alarms with time, days, source and volume | | ✓ |
| `/alsa_setting` | listening mode and tone controls | | ✓ |
| `/audiomodes` | audio and Bluetooth modes | ✓ | ✓ |
| `/audioPreset` | current listening mode and its choices | | ✓ |
| `/Doorbell` | play the doorbell chime | ✓ | ✓ |
| `/download_playlists_api` | backup of the saved playlists (port 80) | | ✓ |
| `/GitVersion` | BluOS version | | ✓ |
| `/LastScanCode` | last received IR code | | ✓ |
| `/Name` | player name | | ✓ |
| `/reboot` | soft reboot (POST, port 80) | ✓ | ✓ |
| `/redirectToCp` | redirect to a page of the web interface | | ✓ |
| `/Reindex` | rescan the music library | | ✓ |
| `/Services` | self-description of the sources | | ✓ |
| `/setting` | change a simple setting | | ✓ |
| `/Settings` | settings tree of the player | ✓ | ✓ |
| `/sharecfg` | web page for network shares (port 80) | | ✓ |
| `/ShowIRCodes` | IR codes learned from a paired remote control | | ✓ |
| `/Sleep` | step the sleep timer | | ✓ |
| `/triggercfg` | web page for learning IR remote codes (port 80) | | ✓ |
| `/update` | purpose unknown (presumably firmware update status) | | ✓ |
| `/upgrade` | redirect to a web page, presumably the firmware upgrade | | ✓ |
| `/upload_playlists_api` | restore the saved playlists (port 80) | | |
| `/Version` | API version | | ✓ |
| `/wificfg` | web page for the Wi-Fi settings (port 80) | | ✓ |

### `/Alarms`

```
/Alarms?tz=<time zone>&id=<id>&enable=<0|1>&days=<flags>&hour=<HH>&minute=<MM>&end=<HHMM>&fadein=<0|1>&volume=<0–100>&source=<name>&url=<play request>&image=<image url>&shuffle=<true|false>&canShuffle=<true|false>&useBackup=<true|false>&delete=1
```

| Parameter | Meaning |
|---|---|
| `tz` | time zone of the client, e.g. `Europe/Berlin`; the app sends it with every request |
| `id` | alarm to change; without `id` (and with the alarm parameters) a new alarm is created |
| `enable` | `1` = on, `0` = off; `/Alarms?id=1&enable=0` switches an alarm off |
| `delete` | `1` together with `id`: deletes the alarm (`/Alarms?delete=1&id=2`) |
| `days` | seven flags from Sunday to Saturday, e.g. `0001000` = Wednesday |
| `hour`, `minute` | start time |
| `end` | end time `HHMM` |
| `fadein` | `1` = fade the volume in |
| `volume` | alarm volume 0–100 |
| `source`, `url`, `image` | what plays: name, play request (e.g. `/Load?name=TTT` for a saved playlist), image |
| `shuffle`, `canShuffle` | play the source shuffled / whether it can be shuffled |
| `useBackup` | presumably a fallback sound when the source is not available |

**Response format**

```
alarms @supportsEndTime="true"
  alarm ×n @id @enable @hour @minute @days @duration @end @volume @voldb @fadein
           @source @url @image @useBackup
```

**Notes**

- Reading (`/Alarms`, `/Alarms?tz=…`) verified; without alarms the list is empty.
- Switching an alarm off (`id` + `enable`) and creating one (all alarm parameters, no `id`) and deleting (`delete=1&id=…`) seen in a capture of the BluOS app (Wireshark). The sources to choose from come from [`/RadioBrowse?service=Alarms`](#radiobrowse).
- Alarm attributes (sample: `hour="8" minute="0" days="0000001" duration="60" end="0900"`):

  | Attribute | Meaning |
  |---|---|
  | `id` | alarm id |
  | `enable` | `1` = on, `0` = off |
  | `hour`, `minute` | start time |
  | `days` | seven flags, one per weekday from Sunday to Saturday (`1` = active), e.g. `0000001` = Saturday, `0001000` = Wednesday (verified with a Saturday and a Wednesday alarm) |
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
/alsa_setting?preset=<mode>&eq-switch=<ON|OFF>&eq-treble=<dB>&eq-bass=<dB>&eq-balance=<n>&eq-centre-trim=<n>&eq-crossover=<Hz>&reset&resetPreset
```

| Parameter | Meaning |
|---|---|
| `preset` | listening mode, a `value@name` from [`/audioPreset`](#audiopreset) (e.g. `MUSIC`, `MOVIE`, `TV`) |
| `eq-switch` | tone controls `ON` / `OFF` |
| `eq-treble`, `eq-bass` | treble, bass: -6 … 6 dB in steps of 0.5 (only with `eq-switch=ON`) |
| `eq-balance` | balance: -7 … 7 in steps of 0.5 |
| `eq-centre-trim` | centre level: -10 … 10 in steps of 0.5 (only with centre channel on) |
| `eq-crossover` | subwoofer crossover: 40 … 200 Hz in steps of 10 (only with a subwoofer) |
| `reset` | "Reset All" button: all listening modes back to the defaults |
| `resetPreset` | "Reset Music Mode" button: only the current listening mode |

**Response format**

No answer body (HTTP 200, empty).

**Notes**

- Names, ranges and dependencies are from the player's own `/Settings?id=audio` answer (verified read); the form `/alsa_setting?<name>=<value>` comes from community projects. Verified with `eq-balance` (0 ↔ 0.5, read back from `/Settings?id=audio`, restored).
- Which settings exist depends on the player (DSP, centre, subwoofer).
- The BluOS app sends it as **POST** with a JSON body, e.g. `{"preset":"MOVIE"}` (seen in a capture of the app); GET with `?<name>=<value>` works as well (verified). Seen: `preset` (`MUSIC`, `MOVIE`, `TV`).

### `/audiomodes`

```
/audiomodes?bluetoothAutoplay=<0–3>&subwoofer=<default|withsub>&ears=<ON|OFF>&volumeLimits=<min>,<max>&replayGainMode=<none|track|album|smart>&mqaDisable=<ON|OFF>&fixedVolume=<ON|OFF>&channelMode=<name>&enableClockTrim=<ON|OFF>
```

| Parameter | Meaning |
|---|---|
| `bluetoothAutoplay` | Bluetooth mode: `0` = manual, `1` = automatic, `2` = guest, `3` = disabled |
| `subwoofer` | `default` = off, `withsub` = on |
| `ears` | stereo surround `ON` / `OFF` |
| `volumeLimits` | minimum and maximum volume in dB, e.g. `-70,-10` (range -90 … 0, at least 30 dB apart) |
| `replayGainMode` | `none`, `track`, `album`, `smart` |
| `mqaDisable` | MQA decoding off (`ON`) / on (`OFF`) |
| `fixedVolume` | fixed volume `ON` / `OFF` |
| `channelMode` | channel mode |
| `enableClockTrim` | `ON` / `OFF` |

**Response format**

No answer body (HTTP 200, empty).

**Notes**

- Only `bluetoothAutoplay` is official (no answer body). `subwoofer`, `ears`, `volumeLimits`, `replayGainMode` with their values are from the player's own answers to `/Settings?id=audio` and `/Settings?id=capture` (verified read); `mqaDisable`, `fixedVolume`, `channelMode`, `enableClockTrim` only from community projects. Verified with `replayGainMode` (`album` ↔ `track`, read back from `/Settings?id=audio`, restored).
- The BluOS app sends it as **POST** with a JSON body, e.g. `{"replayGainMode":"none"}` (seen in a capture of the app); GET with `?<name>=<value>` works as well (verified). Seen: `replayGainMode` (`none`, `track`, `album`, `smart`), `subwoofer` (`withsub`, `default`).

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

**Notes**
- Verified on the Powernode: `<error>Not supported</error>` – the doorbell chime depends on the player model.

### `/download_playlists_api`

```
http://<player>:80/download_playlists_api
```

No known parameters.

**Response format**

```
[ { "name": "<playlist>", "ctime": <unix time>, "shuffle": false, "repeat": 1,
    "files": [ "<32 hex digits>", … ] }, … ]
```

`files` are ids of the tracks (hashes), not paths.

**Notes**

- Verified (3 playlists → 3 objects). Setting "Backup playlists" (class `download`) in `/Settings?id=managePlaylists`: downloads all saved BluOS playlists.

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

An HTML page "Confirmation": "Settings Updated – Rebooting. Please close this window. – Please wait…", with a refresh to `/` after 15 s.

**Notes**

- Example: `curl -d yes=1 http://<player>/reboot`.
- Verified (Bruno M07–M08): the player restarts and answers `/SyncStatus` again after about 20 s (Powernode); playback stops.

### `/redirectToCp`

```
/redirectToCp?href=<encoded path>
```

| Parameter | Meaning |
|---|---|
| `href` | URL-encoded page of the web interface, e.g. `%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0` |

**Response format**

An HTTP redirect to that page (HTML).

**Notes**

- Seen as `@url` of the root of [`/Services`](#services) (link to the music services page); "Cp" presumably means control panel.
- Verified with `href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0`: ends on the HTML page "Configure Music Services" (port 80).

### `/Reindex`

```
/Reindex
```

No parameters.

**Response format**

```
indexing = "1"
```

**Notes**

- Starts a rescan of the music library ("Reindex music collection" button in `/Settings`).
- Verified: answers `<indexing>1</indexing>` and starts the rescan, which runs in the background (on the test player still running after several minutes).
- `<indexing>` in `/Status` does **not** show the rescan: 3 s after the start it was `0` while the rescan was still running. How to follow its progress is not known.

### `/Services`

```
/Services?schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `schemaVersion` | schema the client understands; the app sends `35` |

**Response format**

```
services @schemaVersion @sid @url="/redirectToCp?href=…"
  service ×n @name @type @displayname @icon
    menu > menuGroup / menuEntry @displayName
      browseRequest | request | contextRequest | artworkRequest @url @type @subtype @resultType
        requestItemParameter @name [@source @optional], requestParameter = "<name>=<value>"
      sort, filter, search, genreItemParameter, enableOnAttribute, disableOnAttribute, confirmAction
```

**Notes**

- Verified (62 KB). The player's self-description of every source (`BluOS` playlists, `Capture` inputs, `Alarms`, `LocalMusic` library, USB, `TuneIn`, `RadioParadise`, `Airable` radio): which menus exist and which request (endpoint + fixed and item parameters) each menu entry and context menu action sends.
- Best source for the parameters of requests that `/Browse` hands out as ready URLs, e.g. [`/Add`](#add), [`/SetPreset`](#setpreset), [`/AddToPlaylistOptions`](#addtoplaylistoptions), [`/library/v1/Playlists`](#libraryv1playlists).

### `/setting`

```
/setting?<name>=<value>
```

| Parameter | Meaning |
|---|---|
| `<name>` | `@name` of a setting whose `@url` (or its menu's `@url`) is `/setting`, see the table below |
| `<value>` | new value; booleans use `ON` / `OFF` |

**Response format**

No answer body (HTTP 200, empty).

**Notes**

- Verified with `ledbrightness` (`dim` ↔ `default`, read back from `/Settings?id=player`, restored). The names, classes and ranges come from the player's `/Settings` tree:

  | Name | Class | Values | Menu |
  |---|---|---|---|
  | `zonename` | text | room / group name | top level |
  | `amplifierStandby` | boolean | `ON` / `OFF` | top level |
  | `resizeall` | boolean | optimise artwork | `library` |
  | `server` | boolean | server mode (share the USB drive) | `library` |
  | `centre` | boolean | centre channel | `audio` |
  | `ledbrightness` | list | `default`, `dim`, `off` | `player`, group members via `/proxyToSlave` |
  | `zoneap-enable` | boolean | Wi-Fi Direct | `player` |
  | `proximity_enable` | boolean | proximity sensor | `proximity` |
  | `proximity_timeout` | range | 2 … 10 s | `proximity` |
  | `bluos_remote_enable` | boolean | BluOS IR remote | `bluos_remote` |
  | `bluos_remote_channel` | list | IR channel `0` … `7` | `bluos_remote` |
  | `capture-input<n>-name` | text | name of input `n` | `capture-input<n>` |
  | `capture-input<n>-icon` | iconlist | an `/images/capture/ic_….png` path | `capture-input<n>` |
  | `capture-input<n>-preset` | list | listening mode of the input (e.g. `MUSIC`, `TV`) | `capture-input<n>` |
  | `capture-input<n>-autosense`, `…-autosenseUngroup` | boolean | switch to the input on signal, ungroup then | `capture-input<n>` |
  | `capture-input<n>-lowLatency` | boolean | A/V mode | `capture-input<n>` |
  | `capture-input<n>-latency` | range | lip-sync delay 50 … 150 ms, steps of 10 | `capture-input<n>` |
  | `capture-input<n>-groupCompress` | boolean | compressed audio to grouped players | `capture-input<n>` |
  | `capture-input<n>-isMqaSource` | boolean | MQA pass-through (optical inputs) | `capture-input<n>` |
  | `capture-input<n>-hide` | boolean | hide the source | `capture-input<n>` |
- The BluOS app sends it as **POST** with a JSON body, e.g. `{"capture-input0-hide":"OFF"}` (seen in a capture of the app); GET with `?<name>=<value>` works as well (verified). Names seen in the capture: `capture-input<n>-hide`, `centre`, `amplifierStandby`, `proximity_enable`.

### `/Settings`

```
/Settings?id=<menu id>&schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `id` | menu page (the `@id` of a `menuGroup`); without it the top level |
| `schemaVersion` | schema the client understands; the player reports its own in `/SyncStatus` (`schemaVersion="36"` on the test player). Lower values hide newer menus |

**Response format**

```
settings @pageId @schemaVersion
  setting @id @name @displayName @class @value @url @icon [@description @explanation @pattern @refresh @hideIfDisabled …]
    value ×n @name @displayName [@min @max @step @units @minRange]    (choices or range)
    dependsOn @name @value                                            (shown only when that setting has that value)
    webview @url                                                      (setting opens a web page)
  menuGroup @id @displayName @url @icon [@inline @description] > setting ×n, menuGroup ×n
```

**Notes**

- The settings tree the BluOS app shows. `@class` tells the control: `text`, `boolean`, `list`, `range`, `dual-range`, `iconlist`, `button`, `download`, `upload`, `alarms`, `sleep`.
- `@url` is the endpoint that changes the setting; a setting without `@url` uses the `@url` of its `menuGroup`. Seen: [`/setting`](#setting), [`/audiomodes`](#audiomodes), [`/alsa_setting`](#alsa_setting), [`/SlaveVolume`](#slavevolume), [`/proxyToSlave`](#proxytoslave), [`/Reindex`](#reindex), [`/RemoveSlave`](#removeslave), and on port 80 [`/sharecfg`](#sharecfg), [`/wificfg`](#wificfg), [`/triggercfg`](#triggercfg), [`/download_playlists_api`](#download_playlists_api), [`/upload_playlists_api`](#upload_playlists_api).
- Verified with schema 36, all menu pages read (Bruno V12): top level (alarms, sleep timer, room name, amplifier standby, fixed group, library, playlists), `audio`, `audioPreset`, `zone`, `zone_player-<ip><port>` (per group member), `player` (Wi-Fi, indicator brightness, Wi-Fi Direct), `proximity`, `ir_remote`, `bluos_remote`, `library`, `managePlaylists`, `capture`, `capture-input<n>` (per input).

### `/sharecfg`

```
http://<player>:80/sharecfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

An HTML page (single-page web app "BluOS", the script loads the content).

**Notes**

- Verified. Web page of the player for the network shares of the library; linked in `/Settings` as `<webview url=…>`.

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

### `/triggercfg`

```
http://<player>:80/triggercfg?noheader=1&playnum=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1`; meaning not known |

**Notes**

- Setting "IR Learning" (`<webview>`) in `/Settings?id=ir_remote`: web page to learn the codes of a remote control; the result shows in [`/ShowIRCodes`](#showircodes).
- Verified: answers the HTML shell of the web app "BluOS" (like `/sharecfg`); opening it did not change anything noticeable.

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

### `/upload_playlists_api`

```
POST http://<player>:80/upload_playlists_api   (multipart/form-data, field file)
```

| Parameter | Meaning |
|---|---|
| `file` | form field (`filename="blob"`, `application/octet-stream`) with the JSON of [`/download_playlists_api`](#download_playlists_api) |

**Notes**

- Setting "Restore Playlists" (class `upload`) in `/Settings?id=managePlaylists`: restores the saved playlists from a backup. Seen in a capture of the BluOS app (Wireshark); not called by the tests – it replaces the saved playlists.

### `/Version`

```
/Version
```

No parameters.

**Response format**

```
version = "v0.5.43"
```

### `/wificfg`

```
http://<player>:80/wificfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Notes**

- Setting "WiFi" (`<webview>`) in `/Settings?id=player`.
- Verified: answers the HTML shell of the web app "BluOS" (like `/sharecfg`).

---

## 13. App UI

Screens and menus of the BluOS app (BluOS 4): the app asks the player for ready-made screen content under `/ui/…`. Every button and list entry carries the request it sends, so these answers show which player requests a screen uses. For an own app the endpoints of the other sections are the stable ones.

Common answer structure (verified):

```
screen @id @screenTitle @version @refreshOnPlayerChange [@service @navigationTitle @navigationIcon]
  refreshOnStatusChange @key @value          (reload when this /Status value changes, e.g. prid, pid, sid)
  menuAction @type @text > action
  sortMenu > item @text @selected > action   styleSelector @text @type > action
  row @id @title @scrollable > item | source | input | service | teaser | button …
  list > item @title @subTitle @subSubTitle @image @quality @duration @counter
           action, playAction, contextMenu, nowPlayingMatch @key @value
action @type @URI [@resultType @title @refreshScreen @haptic @notification @notificationIcon]
```

Action types: `player-link` (send the player request in `URI`), `browse` (load another `/ui` screen or a context menu), `context-browse`, `webpage` (open a web page, e.g. `/redirectToCp?…`), `setting` (open `/Settings?id=…`), `confirmation` (ask first, then send `URI`), `deep-link` (navigation inside the app, e.g. `/settings`, `/add-preset`, `/edit-queue`, `/reorder-presets`, `/customise-screen`, `/music-service/<svc>` – not player endpoints), `reorder`, `add`.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `/ui/action` | change a display option of a screen | | |
| `/ui/browseContext` | header of a browse page (e.g. a playlist with play / shuffle buttons) | | ✓ |
| `/ui/BrowseObjects` | list of objects of a browse request (e.g. the saved playlists) | | ✓ |
| `/ui/clearUsageHistory` | clear the "recent" rows of the home screen | | |
| `/ui/Configuration` | configuration of the app screens | | ✓ |
| `/ui/ContextMenu` | context menu of an object (play, add, edit, delete) | | ✓ |
| `/ui/Favourites` | favourites of a source | | ✓ |
| `/ui/Home` | home screen of the app | | ✓ |
| `/ui/myPlaylistsRow` | row "My playlists" of the home screen per source | | ✓ |
| `/ui/News` | news screen | | |
| `/ui/nowPlayingCM` | context menu of the playing item | | |
| `/ui/presets` | preset screen of the app | | ✓ |
| `/ui/prf` | runs a player request for the app | | |
| `/ui/Queue` | queue screen of the app | | ✓ |
| `/ui/queueItemCM` | context menu of a queue entry | | ✓ |
| `/ui/RecentlyPlayed` | recently played screen | | ✓ |
| `/ui/resolveSoviURL` | resolve a "Sovi" URL (meaning not known) | | |
| `/ui/Search` | search screen | | |
| `/ui/Sources` | list of sources (navigation drawer) | | ✓ |

### `/ui/action`

```
/ui/action?Cstyle=<style>~<type>
```

| Parameter | Meaning |
|---|---|
| `Cstyle` | display style per object type, e.g. `grid~Playlist` |

**Notes**

- Seen in `/ui/BrowseObjects` (style selector); not called by the tests (it changes the display).

### `/ui/browseContext`

```
/ui/browseContext?service=<svc>&type=<type>&title=<title>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist` |
| `title` | title of the page |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&playlist=TTT&playlistid=` |

**Response format**

```
screen @id="screen-BluOS-Playlist" @service
  contextMenu (/ui/ContextMenu?context=Playlist&…)
  header @title @image > button "Play all" (/Load?service=BluOS&name=…&shuffle=0), button "Shuffle" (/Add?playlist=…&shuffle=1)
  list > item ×n @title @subTitle @quality @duration > action (/Add?playnow=1&file=…), contextMenu (context=Song), nowPlayingMatch @key="fn"
    nextLink = "/ui/BrowseObjects?…&listContinuation=10&…"
```

**Notes**

- Verified with a saved playlist: header with the playlist's play requests, then the tracks (10 per page, `nextLink` → `/ui/BrowseObjects?…&listContinuation=10…`). With a playlist name that does not exist the answer is `<error service="BluOS"><message>not found</message></error>`.

### `/ui/BrowseObjects`

```
/ui/BrowseObjects?service=<svc>&menuGroupId=<id>&type=<type>&browseIndex=<n>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `menuGroupId` | menu group of `/Services`, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist` |
| `browseIndex` | page / index, e.g. `0` |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&myPlaylists=1` |

**Response format**

```
screen @id @screenTitle @service @navigationTitle @navigationIcon
  sortMenu > item (sort=recent | alpha), styleSelector (/ui/action?Cstyle=…)
  list > item ×n @title @image > action @type="context-browse" (/Playlists?service=BluOS&playlist=…), contextMenu
```

**Notes**

- Verified with the saved BluOS playlists. Other `url` values seen in `/ui/Home` and `/ui/Sources`: `/Albums?recent=1` (library, USB), `/RadioBrowse` (TuneIn, Radio Paradise, Airable).

### `/ui/clearUsageHistory`

```
/ui/clearUsageHistory?stations=1&queued=1
```

| Parameter | Meaning |
|---|---|
| `stations` | `1` = recent stations (row on the home screen) |
| `queued` | `1` = recently played ("Clear" in `/ui/RecentlyPlayed`) |

**Notes**

- Seen in `/ui/Home`; not called by the tests (it deletes the history).

### `/ui/Configuration`

```
/ui/Configuration
```

No known parameters.

**Response format**

```
configuration
  item ×n @id @URI [@resultType @listeningModesURL]
    home → /ui/Home, recentlyPlayed → /ui/RecentlyPlayed, news → /ui/News, favourites → /ui/Favourites,
    sources → /ui/Sources, search → /ui/Search, nowPlayingContextMenu → /ui/nowPlayingCM,
    queueItemContextMenu → /ui/queueItemCM, resolveSoviURL → /ui/resolveSoviURL, queue → /ui/Queue,
    presets → /ui/presets (listeningModesURL="/audioPreset")
```

**Notes**

- Verified. Lists the app's entry screens; the app asks it first when it connects. `/ui/News`, `/ui/Search`, `/ui/nowPlayingCM` and `/ui/resolveSoviURL` are only known from this list.

### `/ui/ContextMenu`

```
/ui/ContextMenu?context=<context>&sourceContext=<context>&service=<svc>&type=<type>&id=<id>&name=<name>&title=<title>&playlist=<name>&album=<album>&artist=<artist>&isFavourite=1&url=<url>&image=<image>&volume=<0–100>&noFavCMItems=1
```

| Parameter | Meaning |
|---|---|
| `context`, `sourceContext` | object type of the menu: `Playlist`, `Album`, `Artist`, `Song` (with `filename`) |
| `type` | e.g. `preset` |
| `service` | source of the object |
| `id`, `name`, `title`, `playlist`, `album`, `artist`, `isFavourite`, `url`, `image`, `volume` | the object's own attributes, e.g. of a preset, a playlist or an album |
| `noFavCMItems` | `1` = without favourite entries |

**Response format**

```
contextMenu @title
  item ×n @text @icon > action @type="player-link" | "confirmation" @URI @notification
```

**Notes**

- Verified with a playlist: entries Play now, Shuffle, Add next, Add last, Delete with their requests (`/Add?…`, `/Delete?name=…&service=BluOS`). The menu is built from the parameters alone – the playlist is not checked.
- More variants seen in `/ui/Home`: albums (`context=Album&album=…&artist=…[&isFavourite=1]`), `noFavCMItems=1` (no favourite entries).

### `/ui/Favourites`

```
/ui/Favourites?service=<svc>&singleService=1&title=<title>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, `TuneIn` |
| `singleService` | `1` = only this source |
| `title` | screen title |

**Response format**

```
screen @id="screen-<svc>-Favourites" @screenTitle
  row ×n @title (Artists, Albums, …) > action (/ui/BrowseObjects?…&url=/library/v1/…?category=FAVOURITES…), list > item ×n
```

**Notes**

- Verified (library): one row per type (Artists, Albums, …) with the favourites and their browse / context menu requests.

### `/ui/Home`

```
/ui/Home
```

No known parameters.

**Response format**

```
screen @id="screen-home" @screenTitle="Home"
  row ×n @id   (teaser, mostUsed, presets, recent-stations, recent, <svc>-myPlaylists)
```

**Notes**

- Verified: rows for teasers, most used sources, presets, recent stations, recently played and the BluOS playlists; every entry with its play request (e.g. `/Play?url=…`, `/Preset?id=…`, `/Load?…`).

### `/ui/myPlaylistsRow`

```
/ui/myPlaylistsRow?service=<svc>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |

**Notes**

- Verified: empty answer when the source has no playlists (no row on the home screen).

### `/ui/News`

```
/ui/News
```

Parameters not known.

**Notes**

- Only known from [`/ui/Configuration`](#uiconfiguration); not called yet.

### `/ui/nowPlayingCM`

```
/ui/nowPlayingCM
```

Parameters not known.

**Notes**

- Only known from [`/ui/Configuration`](#uiconfiguration); not called yet.

### `/ui/presets`

```
/ui/presets
```

No known parameters.

**Response format**

```
screen @id="screen-presets" @screenTitle="Presets"
  menuAction @type="add"
  list > item ×n @title @image @counter > action (/Preset?id=<id>), contextMenu (/ui/ContextMenu?…&type=preset)
```

**Notes**

- Verified.

### `/ui/prf`

```
/ui/prf?u=<encoded request>&cgsc=1
```

| Parameter | Meaning |
|---|---|
| `cgsc` | seen as `1` (with `/AddFavourite` in `/ui/queueItemCM`); meaning not known |
| `u` | URL-encoded player request, e.g. `/Add?playlist=TTT&playnow=1&service=BluOS&shuffle=1` |

**Notes**

- Seen in a capture of the BluOS app; not called by the tests (it runs the request).

### `/ui/Queue`

```
/ui/Queue?offset=<n>
```

| Parameter | Meaning |
|---|---|
| `offset` | first entry, e.g. `0` |

**Response format**

```
queue @offset @total @id (= pid) @modified @name
  button ×n (Save → /AddToPlaylistOptions?saveQueue=1, Edit, Clear → /Clear)
  item ×n @title @subTitle @subSubTitle @image @quality @duration
    action (/Play?id=<n>), contextMenu (/ui/queueItemCM?id=<n>), nowPlayingMatch @key="song"
```

**Notes**

- Verified.

### `/ui/queueItemCM`

```
/ui/queueItemCM?id=<n>
```

| Parameter | Meaning |
|---|---|
| `id` | queue position |

**Response format**

```
contextMenu @title @subTitle @image
  item ×n @text @icon > action @type @URI
```

**Notes**

- Verified: entries like Favourite (`/ui/prf?cgsc=1&u=/AddFavourite?fn=…`), Add to playlist (`/AddToPlaylistOptions?service=…&songid=…`).

### `/ui/RecentlyPlayed`

```
/ui/RecentlyPlayed
```

No known parameters.

**Response format**

```
screen @id="screen-recentlyPlayed"
  menuAction "Clear" (/ui/clearUsageHistory?queued=1)
  list @id="recent" > item ×n @title @image @icon @objectType (playlist | album | …) > action, contextMenu
```

**Notes**

- Verified: recently played playlists, albums, stations with `objectType` and their requests; "Clear" sends `/ui/clearUsageHistory?queued=1`.

### `/ui/resolveSoviURL`

```
/ui/resolveSoviURL
```

Parameters not known.

**Notes**

- Only known from [`/ui/Configuration`](#uiconfiguration); not called yet.

### `/ui/Search`

```
/ui/Search
```

Parameters not known.

**Notes**

- Only known from [`/ui/Configuration`](#uiconfiguration); not called yet.

### `/ui/Sources`

```
/ui/Sources
```

No known parameters.

**Response format**

```
screen @id="screen-sources" @screenTitle="Music Sources"
  row @id="inputs" > input ×n @title @icon > action (/Play?url=…&title=…&image=…), nowPlayingMatch @key="inputId"
  row … > service ×n                    (library, USB, radio services → /ui/BrowseObjects …)
```

**Notes**

- Verified. Inputs with their play requests, music sources with their browse screens.
