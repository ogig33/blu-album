# BluOS API reference

All known BluOS HTTP endpoints by category: the official *BluOS Custom Integration API* and unofficial endpoints.

- **Official documentation:** [BluOS Custom Integration API v1.7](https://bluos.io/wp-content/uploads/2025/06/BluOS-Custom-Integration-API_v1.7.pdf) ([bluos.io/downloads](https://bluos.io/downloads/)); column "Official" in the overview of each category.
- **Verified:** column "Verified" = checked on a Bluesound Powernode N331 with BluOS 4.18.26 (API v0.5.51); other players and versions may differ.

## Table of contents

1. [Basics](#1-basics)
2. [Status](#2-status)
3. [Volume](#3-volume)
4. [Playback control](#4-playback-control)
5. [Queue](#5-queue)
6. [BluOS playlists](#6-bluos-playlists)
7. [Presets](#7-presets)
8. [Browse and search](#8-browse-and-search)
9. [Favourites](#9-favourites)
10. [Service functions](#10-service-functions)
11. [Library functions](#11-library-functions)
12. [Player grouping](#12-player-grouping)
13. [System](#13-system)
14. [BluOS Controller UI](#14-bluos-controller-ui)
15. [MCP server](#15-mcp-server)

---

## 1. Basics

- **Requests:** `http://<player>:11000/Volume?level=20`; parameters are URL-encoded (UTF-8). The HTTP method is given at each endpoint. Answers are UTF-8 XML unless the endpoint says otherwise.
- **Port:** 11000 is the control API of every player. Endpoints on another port (80: web pages of the player; 11004: library server) show it in their request line.
- **Errors:** HTTP errors or an `<error>` root element (one `<message>`, zero or more `<detail>`) instead of the expected root; check the root element name.
- **Unknown elements:** answers may contain more elements and attributes than listed here; ignore unknown ones.
- **Relative URIs** in answers (`playURL`, `actionURL`, `image`, …) are absolute paths, resolved against the player address. Invoke them as they are; do not parse or build them.
- **Polling:** without long polling at most one request every 30 s; with long polling (`timeout` + `etag` of the previous answer's root) never two requests for the same resource less than 1 s apart.
- **Language:** answers follow the `Accept-Language` header (e.g. `serviceName="Bibliothek"` for German). Send `Accept-Language: en` to get the answers documented here; browsers send the system language by default (see `/Browse` for an album track list that stays empty otherwise).
- **Grouped players:** most requests to a secondary player (status, playback, queue, browse) are proxied to the primary.
- **Notation:** response examples are shortened, well-formed XML; `<!-- … -->` and `…` mark left-out parts. In request lines `<…>` stands for a value to fill in.

---

## 2. Status

Playback, volume and grouping state of the player, with long polling.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Status` | playback and volume state, long polling | ✓ | ✓ |
| `GET /SyncStatus` | player identity, volume and grouping, long polling | ✓ | ✓ |

### `GET /Status`

```
GET /Status?timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `timeout` | long polling: seconds the player may hold the request; recommended 100 |
| `etag` | `etag` of the previous answer's root; the answer returns early only on a change |

**Response format**

```xml
<status etag="4e266c9fbfba6d13d1a4d6ff4bd2e1e6">
  <actions>
    <action name="back"/>
    <action name="skip" url="/Action?service=RadioParadise&amp;next=2960598"/>
  </actions>
  <album>Ambient Explorations 04</album>
  <artist>Rule 42</artist>
  <canSeek>0</canSeek>
  <image>https://img.radioparadise.com/covers/l/19334.jpg</image>
  <infourl>https://en.wikipedia.org/wiki/</infourl>
  <lyricsid>893</lyricsid>
  <name>3C 273</name>
  <pid>615</pid>
  <prid>2</prid>
  <quality>cd</quality>
  <repeat>2</repeat>
  <secs>39</secs>
  <service>RadioParadise</service>
  <serviceName>Radio Paradise</serviceName>
  <serviceType>RadioService</serviceType>
  <shuffle>0</shuffle>
  <sleep>10</sleep>
  <song>0</song>
  <state>stream</state>
  <streamFormat>FLAC 16/44.1</streamFormat>
  <streamUrl>RadioParadise:/42:4/Serenity</streamUrl>
  <syncStat>44</syncStat>
  <title1>Serenity</title1>
  <title2>3C 273</title2>
  <title3>Rule 42 • Ambient Explorations 04</title3>
  <totlen>877</totlen>
  <volume>14</volume>
  <!-- more elements, see the table -->
</status>
```

| Element | Meaning |
|---|---|
| `title1`, `title2`, `title3` | three lines of now-playing text (MUST be used for 3-line UIs); radio streams may lack `title3` |
| `twoline_title1`, `twoline_title2` | if present: MUST be used for 2-line UIs |
| `album`, `artist`, `name` | raw metadata (not for display) |
| `state` | `play`, `pause`, `stop`, `stream`, `connecting`, …; `play` and `stream` mean the same |
| `secs`, `totlen` | position and length in seconds; `secs` does not change the `etag` |
| `canSeek` | `1` = `/Play?seek=` possible |
| `song` | queue position of the current track |
| `pid` | queue id (= `id` of `/Playlist`); changes with every queue change |
| `prid` | preset list id (= `prid` of `/Presets`) |
| `syncStat` | changes whenever `/SyncStatus` changes |
| `shuffle`, `repeat` | shuffle `0` / `1`; repeat `0` = queue, `1` = track, `2` = off |
| `volume`, `db`, `mute`, `muteVolume`, `muteDb` | volume 0–100 (`-1` = fixed), in dB, mute state |
| `quality` | `cd`, `hd`, `dolbyAudio`, `mqa`, `mqaAuthored`, or the bitrate (lossy) |
| `streamFormat` | e.g. `MP3 320 kb/s`, `FLAC 16/44.1` |
| `service`, `serviceName`, `serviceType`, `serviceIcon` | source of the playing item |
| `image`, `currentImage`, `stationImage` | images |
| `infourl`, `lyricsid` | values for [`/Info`](#get-info) |
| `fn` | file / item id |
| `isFavourite` | `1` = the playing track is a favourite |
| `streamUrl` | present: not playing from the queue (no `song`, shuffle, repeat, skip) |
| `actions` > `action` (`name`, `url`, `icon`, `text`, `notification`, `state`) | radio actions, see [`/Action`](#get-action) |
| `sleep` | minutes left on the sleep timer |
| `groupName`, `groupVolume` | only on the primary player of a group |
| `battery` (`level`, `charging`, `icon`) | players with a battery |
| `alarmsecondsremaining` | seconds left of a playing alarm |
| `indexing` | `0`; during a library rescan the number of files read so far (in steps of 500) |
| `notifyurl`, `canMovePlayback`, `mid`, `mode`, `sid`, `cursor`, `settingsGroupId` | further elements; `settingsGroupId` empty, purpose unknown |

**Notes**

- Without parameters the answer comes at once; with `timeout` the player holds the request up to `timeout` seconds and answers at once on a change (title, position jump, volume, shuffle, repeat, `pid`).
- Clients advance `secs` themselves while `state` is `play` or `stream`.
- `quality` is `hd` here but `hr` in the library filter. MP3 files report their bitrate; recognise MP3 by `streamFormat`.
- One long poll on `/Status` *or* [`/SyncStatus`](#get-syncstatus) is usually enough: `syncStat` changes whenever `/SyncStatus` changes.
- Grouped players: `/Status` of a secondary player is a copy of the primary's; use [`/SyncStatus`](#get-syncstatus) for the volume of each secondary.

### `GET /SyncStatus`

```
GET /SyncStatus?timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `timeout` | long polling: seconds the player may hold the request; recommended 180 |
| `etag` | `etag` of the previous answer's root |

**Response format**

```xml
<SyncStatus etag="2230" syncStat="2230" version="4.18.26" id="192.168.1.100:11000" db="-53.7" volume="14"
            name="Living Room" model="N331" modelName="Home Theatre Group" class="streamer-amplifier"
            icon="/images/players/ic_fixed_group_surround.png" brand="Bluesound" schemaVersion="36"
            initialized="true" zoneController="true" zone="Living Room" group="Living Room"
            zoneUngroup="/RemoveSlave?slaves=192.168.1.101,192.168.1.102&amp;ports=11000,11000"
            mac="90:56:82:9F:02:78" channelMode="front" channelName="Front">
  <zoneOptions multi="false"/>
  <zoneSlave id="192.168.1.101" port="11000" zoneSlave="true" channelMode="side_right" channelName="Right Surround"
             distance="1.4" zoneSubnet="true" name="Right" model="P130" modelName="PULSE FLEX"
             icon="/images/players/P130_nt.png"/>
  <zoneSlave id="192.168.1.102" port="11000" channelMode="side_left" channelName="Left Surround"/>
  <pairWithSub/>
  <bluetoothOutput/>
  <audioPresetUrl url="/audioPreset"/>
</SyncStatus>
```

| Element / attribute | Meaning |
|---|---|
| `etag`, `syncStat` | change counter (= `syncStat` of `/Status`) |
| `version` | BluOS version |
| `id`, `mac` | address with port, MAC address |
| `name`, `zone`, `group` | player, zone and group name |
| `model`, `modelName`, `class`, `brand`, `icon` | player model and type (e.g. `streamer-amplifier`) |
| `volume`, `db` | volume 0–100 and in dB |
| `schemaVersion` | settings schema of the player (for [`/Settings`](#get-settings)) |
| `initialized` | `false` = the player still needs setup in the BluOS Controller |
| `zoneController`, `zoneUngroup` | primary of a fixed group; request that dissolves it |
| `channelMode`, `channelName` | channel of this player in a fixed group |
| `zoneSlave` (`id`, `port`, `channelMode`, `channelName`, `distance` in m, `name`, `model`, …) | one member (e.g. surround speaker) of a fixed group |
| `slave` (`id`, `port`) | one secondary player of a normal group (on the primary) |
| `master` (`port`, text = address) | the primary player (on a secondary) |
| `battery` (`level`, `charging`, `icon`) | players with a battery |
| `audioPresetUrl` | link to [`/audioPreset`](#get-audiopreset) (players with listening modes) |
| `zoneOptions`, `pairWithSub`, `bluetoothOutput` | grouping options |

**Notes**

- Poll `/SyncStatus` when only name, volume and grouping matter; `/Status` for playback.

---

## 3. Volume

Volume level, dB steps and mute of the player or the group.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Volume` | read / set the volume, step in dB, mute | ✓ | ✓ |

### `GET /Volume`

```
GET /Volume?level=<0–100>&abs_db=<dB>&db=<±dB>&mute=<0|1>&tell_slaves=<0|1>&timeout=<seconds>&etag=<etag>
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

```xml
<volume db="-50.9" offsetDb="0" mute="0" etag="672e82cf69c0bc0cc6dcf3bbcba6131a" source="">16</volume>
```

| Element / attribute | Meaning |
|---|---|
| text | level 0–100 (`-1` = fixed volume) |
| `db`, `offsetDb` | volume in dB, offset |
| `mute` | `1` = muted; then also `muteDb` and `muteVolume` (level before muting) |
| `etag` | for long polling |

**Notes**

- Without parameters: read the volume. Use one of `level`, `abs_db`, `db` or `mute` per request.
- All variants are limited to the configured volume range (`volumeLimits` of [`/audiomodes`](#get-post-audiomodes)).
- `mute=1` mutes; the official parameter table wrongly says `mute=0`.

---

## 4. Playback control

Play, pause, seek, skip, repeat and shuffle of the current source.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Action` | skip / back / love / ban on streaming radio | ✓ | ✓ |
| `GET /Add` | add / play albums, tracks, playlists | | ✓ |
| `GET /Back` | restart the track or previous track | ✓ | ✓ |
| `GET /Pause` | pause or toggle play / pause | ✓ | ✓ |
| `GET /Play` | play, resume, seek, play a queue entry, a URL or an input | ✓ | ✓ |
| `POST /playurl` | play a URL through the web form (port 80) | | ✓ |
| `GET /Repeat` | repeat queue / track / off | ✓ | ✓ |
| `GET /Shuffle` | shuffle the queue on / off | ✓ | ✓ |
| `GET /Skip` | next track | ✓ | ✓ |
| `GET /Stop` | stop | ✓ | ✓ |

### `GET /Action`

```
GET /Action?service=<service>&skip=<id>&next=<id>&back=<id>&love=<id>&ban=<id>&action=<addFavourite|deleteFavourite|back>&preset_id=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | streaming service, e.g. `Slacker`, `RadioParadise` |
| `skip`, `next`, `back`, `love`, `ban` | the action with the track id given by the player (Radio Paradise uses `next` to skip) |
| `action` | `addFavourite` / `deleteFavourite`: favourite of a streaming item (from [`/Services`](#get-services)); `back` (Airable) |
| `preset_id` | station id for `action=addFavourite`, e.g. `s16252` (TuneIn) |

**Response format**

```xml
<skip>1</skip>
```

| Element | Meaning |
|---|---|
| `skip`, `back`, `love` | the action done; ban answers `<love skip="1">0</love>` |
| `response` | text = notification for the user |

**Notes**

- Streaming radio (e.g. Slacker, Radio Paradise, Amazon stations) does not use the queue; `/Status` lists the available actions in `<actions>`. Invoke an action's `url` exactly as given; an action without `url` is not available.
- If the root is `<response>`, show its text; otherwise the action's `notification`.

### `GET /Add`

```
GET /Add?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&genre=<genre>&path=<path>&playlist=<name>&playlistid=<id>&file=<file>&composer=<composer>&category=FAVOURITES&playnow=<1|-1>&where=<next|nextAlbum|last>&clear=0&shuffle=<0|1>&listindex=<n>&nextlist=1&cursor=last&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, a USB id, `Deezer`, `Tidal` |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |
| `genre` | all songs of a genre |
| `path` | all songs of a folder |
| `playlist`, `playlistid` | a BluOS playlist (name), a service playlist (id) or a library playlist (both, with `service=LocalMusic`) |
| `file` | single track (file) |
| `composer` | all songs of a composer |
| `category` | `FAVOURITES`: the favourite songs of the library |
| `playnow` | `1` = play now, `-1` = only add |
| `where` | `next` (after the current track), `nextAlbum` (after the current album), `last` (end of the queue) |
| `clear` | `0` in all "play now" requests |
| `shuffle` | `1` = add shuffled, `0` = in order |
| `listindex`, `nextlist`, `cursor` | `autoplayURL`: start at a track, fill the queue with the rest of the list |
| `offset` | `autoplayURL` of a later list page: the queue gets the songs from this position on, `listindex` counts within them |

**Response format**

```xml
<playlist length="18" id="646" modified="1" count="9" shuffle="0" repeat="2"></playlist>
```

| Attribute | Meaning |
|---|---|
| `length` | entries of the queue now |
| `count` | entries added |
| `id` | new queue id (= `pid` of `/Status`) |
| `modified` | missing when an album is played with `playnow=1` |
| `shuffle`, `repeat` | as in `/Status` |

**Notes**

- Not documented as a request; appears as `playURL`, `autoplayURL` and `actionURL` in [`/Browse`](#get-browse) answers. Take the URLs from the player instead of building them; [`/Services`](#get-services) lists the parameters per menu entry.
- Examples: album `/Add?playnow=1&service=LocalMusic&album=…&artist=…`; album to the end `/Add?album=…&artist=…&playnow=-1&service=LocalMusic&where=last`; track `/Add?playnow=1&file=…`.
- An `autoplayURL` (e.g. `/Add?service=LocalMusic&listindex=0&nextlist=1&where=last&cursor=last&playnow=1&category=FAVOURITES`) replaces the queue with the songs of the list and plays the song at `listindex`.
- Changes the queue id.

### `GET /Back`

```
GET /Back
```

No parameters.

**Response format**

```xml
<id>19</id>
```

| Element | Meaning |
|---|---|
| `id` | new queue position |

**Notes**

- After more than 4 s of playback: back to the start of the track; otherwise the previous track (from the first to the last), regardless of repeat.
- Only for queue playback, like [`/Skip`](#get-skip).

### `GET /Pause`

```
GET /Pause?toggle=1
```

| Parameter | Meaning |
|---|---|
| `toggle` | `1` = toggle between play and pause |

**Response format**

```xml
<state>pause</state>
```

| Element | Meaning |
|---|---|
| `state` | new state (`pause`, with `toggle=1` also `play`) |

**Notes**

- `/Pause` alone pauses. Cancels the timeout of a playing alarm.

### `GET /Play`

```
GET /Play?seek=<seconds>&id=<n>&url=<encoded URL>&title=<name>&title1=<name>&image=<image>&inputTypeIndex=<type>-<n>&inputIndex=<n>
```

| Parameter | Meaning |
|---|---|
| `seek` | position in seconds within the current track (or within entry `id`) |
| `id` | queue entry to play |
| `url` | URL-encoded stream URL, or the `URL` of an input from [`/RadioBrowse?service=Capture`](#get-radiobrowse) (already encoded) |
| `inputTypeIndex` | input by type and number, e.g. `spdif-2` (BluOS ≥ 4.2.0) |
| `inputIndex` | input by position, from 1, Bluetooth excluded (BluOS 3.8.0 – 4.2.0) |
| `title`, `image` | name and icon of an input, sent with its `url` |
| `title1` | name shown for a stream, e.g. a radio station |

**Response format**

```xml
<state>play</state>
```

| Element | Meaning |
|---|---|
| `state` | `play`, or `stream` for streams and inputs |

**Notes**

- `/Play` alone resumes the current source (only from `pause`, not from `stop`).
- Use one of `seek` (+ `id`), `id`, `url`, `inputTypeIndex` or `inputIndex` per request.
- `seek` only works when `/Status` has `canSeek=1`; `seek` + `id` also returns from a radio stream to the queue.
- `url` with an input: active inputs only; the only way to select inputs of a BluOS HUB (`Hub%3A%2F%2F192.168.1.149%3A11000%2Finput0`). The source must be connected and not hidden.
- `inputTypeIndex` also works for inactive inputs missing from `/RadioBrowse`; recommended. Types: `spdif` (optical), `analog`, `coax`, `bluetooth`, `arc`, `earc`, `phono`, `computer`, `aesebu`, `balanced`, `microphone`; numbering starts at 1 per type.
- `inputIndex` is the position in `/Settings?id=capture&schemaVersion=32`; the official example writes `InputId`.
- Radio examples: `/Play?url=TuneIn:s16252/e113900962/https://…&title1=…` (stream from `/RadioBrowse?c=selectStream`), `/Play?url=Airable:radio:https://…&title1=…&image=…`, `/Play?url=RadioParadise:/1:20/Mellow%20Mix&title1=…&image=…`.

### `POST /playurl`

```
POST http://<player>:80/playurl   (form field url)
```

| Parameter | Meaning |
|---|---|
| `url` | what to play, e.g. `TuneIn:s16252` or a stream URL (form field, URL-encoded) |

**Response format**

An HTML page "Confirmation" ("Settings Updated – Playing TuneIn:s16252 – Please wait…").

**Notes**

- Same as [`/Play?url=`](#get-play), through the old web form of the player.

### `GET /Repeat`

```
GET /Repeat?state=<0|1|2>
```

| Parameter | Meaning |
|---|---|
| `state` | `0` = repeat the queue, `1` = repeat the track, `2` = off |

**Response format**

```xml
<playlist length="17" id="718" modified="1" shuffle="0" repeat="0"></playlist>
```

| Attribute | Meaning |
|---|---|
| `repeat` | new repeat state |
| `length`, `id`, `modified`, `shuffle` | queue status, as in [`/Playlist`](#get-playlist) |

**Notes**

- Repeats never stop by themselves.

### `GET /Shuffle`

```
GET /Shuffle?state=<0|1>
```

| Parameter | Meaning |
|---|---|
| `state` | `1` = shuffle on, `0` = off |

**Response format**

```xml
<playlist length="10" id="724" name="My Playlist" shuffle="1" repeat="2"></playlist>
```

| Attribute | Meaning |
|---|---|
| `shuffle` | new shuffle state |
| `length`, `id`, `name`, `repeat` | queue status, as in [`/Playlist`](#get-playlist) |

**Notes**

- `1` builds a shuffled copy of the queue (no effect if already shuffled); `0` restores the original order. Changes the queue id.
- `/Shuffle` **without** `state` switches shuffle off; read the state from `shuffle` of [`/Status`](#get-status).

### `GET /Skip`

```
GET /Skip
```

No parameters.

**Response format**

```xml
<id>21</id>
```

| Element | Meaning |
|---|---|
| `id` | new queue position |

**Notes**

- From the last track it goes to the first, regardless of repeat.
- Only for queue playback (no `streamUrl` in `/Status`); streaming radio uses [`/Action`](#get-action).

### `GET /Stop`

```
GET /Stop
```

No parameters.

**Response format**

```xml
<state>stop</state>
```

| Element | Meaning |
|---|---|
| `state` | `stop` |

**Notes**

- Cancels the timeout of a playing alarm.

---

## 5. Queue

List and change the queue the player plays from.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Clear` | clear the queue | ✓ | ✓ |
| `GET /Delete` | remove a queue entry or delete a BluOS playlist | ✓ | ✓ |
| `GET /Move` | move a queue entry | ✓ | ✓ |
| `GET /Playlist` | list the queue or its status | ✓ | ✓ |

### `GET /Clear`

```
GET /Clear
```

No parameters.

**Response format**

```xml
<playlist modified="0" length="0" id="1056"/>
```

| Attribute | Meaning |
|---|---|
| `id` | new queue id |
| `length`, `modified` | empty queue |

### `GET /Delete`

```
GET /Delete?id=<n>&service=BluOS&name=<name>
```

| Parameter | Meaning |
|---|---|
| `id` | queue position of the entry to remove |
| `service` | `BluOS` – together with `name` |
| `name` | BluOS playlist to delete |

**Response format**

```xml
<deleted>9</deleted>
```

| Element | Meaning |
|---|---|
| `deleted` | queue entry removed; deleting a BluOS playlist answers without it |

**Notes**

- Two functions, one per request: `id` removes a queue entry (official); `service=BluOS&name=…` deletes a BluOS playlist (context menu type `delete` in `/Browse`).

### `GET /Move`

```
GET /Move?new=<to>&old=<from>
```

| Parameter | Meaning |
|---|---|
| `new` | position of the entry after the move |
| `old` | current position |

**Response format**

```xml
<moved>moved</moved>
```

| Element | Meaning |
|---|---|
| `moved` | done |

**Notes**

- The entry is taken out, then inserted at `new`: `old=0&new=3` puts the first entry at index 3 and moves entries 1–3 up by one.
- Gives the queue a new id. Playback goes on; `song` of `/Status` follows the playing entry to its new position.

### `GET /Playlist`

```
GET /Playlist?start=<first>&end=<last>&length=1
```

| Parameter | Meaning |
|---|---|
| `start` | first entry (0-based) |
| `end` | last entry (inclusive) |
| `length` | `1` = queue status only, no entries |

**Response format**

```xml
<playlist name="My Playlist" modified="0" shuffle="0" repeat="2" length="12" id="485">
  <song service="LocalMusic" id="0">
    <art>Brian Eno</art>
    <alb>Apollo: Atmospheres &amp; Soundtracks</alb>
    <title>Under Stars</title>
    <track>1</track>
    <date>1983</date>
    <time>270</time>
    <fn>/var/mnt/nas-Music/By Artist/E/Brian Eno/1983_Apollo/01. Under Stars.flac</fn>
    <quality>cd</quality>
    <image>/Artwork?service=LocalMusic&amp;artist=Brian+Eno&amp;album=Apollo…</image>
  </song>
  <!-- one <song> per entry -->
</playlist>
```

| Element / attribute | Meaning |
|---|---|
| `playlist` `id` | queue id (= `pid` of `/Status`); changes on add, move, remove, shuffle, clear and load |
| `playlist` `name`, `modified` | name of the loaded or saved playlist; `1` = changed since |
| `playlist` `length`, `shuffle`, `repeat` | number of entries, shuffle and repeat state |
| `song` `id` | queue position (= `song` of `/Status`) |
| `art`, `alb`, `title`, `track`, `discno`, `date`, `time` | track artist, album, title, track and disc number, year, length in s |
| `fn`, `quality`, `image` | file, quality, cover |
| `albumid`, `artistid`, `songid` | streaming services only |

**Notes**

- Without parameters the whole queue – use `start` / `end` for paging.
- `start` = `end` = `song` of `/Status` gives the playing track with its year (`/Status` has none).

---

## 6. BluOS playlists

Save, fill, load and delete the playlists stored in the player (service `BluOS`).

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /AddToPlaylist` | add an album or a song to a BluOS playlist | | ✓ |
| `GET /AddToPlaylistOptions` | choices for adding an album or a song to a BluOS playlist | | ✓ |
| `GET /Load` | load a BluOS playlist (or a service playlist) | | ✓ |
| `GET /Save` | save the queue as a playlist | ✓ | ✓ |
| [`GET /Delete`](#get-delete) | delete a BluOS playlist (see [Queue](#5-queue)) | | ✓ |
| [`GET /Playlists`](#get-playlists) | list the BluOS playlists (see [Service functions](#10-service-functions)) | | ✓ |
| [`GET /Songs`](#get-songs) | tracks of a BluOS playlist (see [Service functions](#10-service-functions)) | | ✓ |

### `GET /AddToPlaylist`

```
GET /AddToPlaylist?service=<svc>&sourceService=<svc>&album=<album>&artist=<artist>&name=<playlist>
```

| Parameter | Meaning |
|---|---|
| `service`, `sourceService` | source of the item |
| `album` + `artist` | album to add (or the item parameters of a song) |
| `name` | BluOS playlist to add to; a new name creates the playlist |

**Response format**

```xml
<addToPlaylist service="BluOS"></addToPlaylist>
```

| Element | Meaning |
|---|---|
| `addToPlaylist` | done; `service` = where the playlist is stored |

**Notes**

- Built from the answer of [`/AddToPlaylistOptions`](#get-addtoplaylistoptions): its `urlPath` with the `requestParameter` values, plus `name`.

### `GET /AddToPlaylistOptions`

```
GET /AddToPlaylistOptions?service=<svc>&album=<album>&artist=<artist>&songid=<id>&saveQueue=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the item |
| `album` + `artist` | album to add |
| `songid` | song to add |
| `saveQueue` | `1` = options for saving the queue as a playlist |

**Response format**

```xml
<addToPlaylistOptions service="LocalMusic">
  <urlPath>/AddToPlaylist</urlPath>
  <requestParameter>sourceService=LocalMusic</requestParameter>
  <requestParameter>album=Kosmopolites</requestParameter>
  <requestParameter>artist=Paolo+Fresu</requestParameter>
  <playlists service="LocalMusic" create="1" serviceName="BluOS" serviceIcon="/images/BluOSIcon.png">
    <name image="/Artwork?service=LocalMusic&amp;fn=…">My Playlist</name>
    <name image="/Artwork?service=LocalMusic&amp;fn=…">Party</name>
  </playlists>
</addToPlaylistOptions>
```

With `saveQueue=1`:

```xml
<saveQueueOptions service="LocalMusic">
  <urlPath>/Save</urlPath>
  <name>My Playlist</name>
  <overwrite name="My Playlist" service="BluOS">
    <requestParameter>service=BluOS</requestParameter>
    <requestParameter>name=My Playlist</requestParameter>
  </overwrite>
  <explanation>Songs from Library can only be saved in a BluOS playlist</explanation>
  <playlists create="0" disable="1" service="LocalMusic" serviceName="Library" serviceIcon="/images/LibraryIcon.png"/>
  <playlists service="BluOS" create="1" serviceName="BluOS" serviceIcon="/images/BluOSIcon.png">
    <name image="/Artwork?…">My Playlist</name>
  </playlists>
</saveQueueOptions>
```

| Element / attribute | Meaning |
|---|---|
| `urlPath` + `requestParameter` | the follow-up request: [`/AddToPlaylist`](#get-addtoplaylist) or [`/Save`](#get-save) |
| `playlists` (`service`, `serviceName`, `create`, `disable`) | target service; `create="1"` = a new playlist may be created, `disable="1"` = not selectable |
| `playlists` > `name` (`image`) | existing BluOS playlist |
| `name` | name of the current queue (`saveQueue=1`) |
| `overwrite` | request parameters to save under the existing name |
| `explanation` | text for the user |

**Notes**

- Read only; nothing is added.

### `GET /Load`

```
GET /Load?service=<service>&name=<name>&id=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS` (BluOS playlist), `LocalMusic` (library playlist) or a streaming service |
| `name` | name of the BluOS playlist (also sent for a library playlist) |
| `id` | playlist id of a library playlist or of a streaming service |

**Response format**

```xml
<loaded service="BluOS"><entries>12</entries></loaded>
```

| Element | Meaning |
|---|---|
| `entries` | number of tracks loaded |

**Notes**

- Replaces the queue with the playlist and plays it. Take the URL from `/Browse` (`playURL` of the playlist) or from `/Presets` (e.g. `/Load?service=Tidal&id=fd3f797e-…`).

### `GET /Save`

```
GET /Save?name=<name>&service=BluOS&create=1
```

| Parameter | Meaning |
|---|---|
| `name` | name of the BluOS playlist |
| `service` | `BluOS` |
| `create` | `1` = create a new playlist (sent when saving under a new name) |

**Response format**

```xml
<saved>
  <entries>126</entries>
</saved>
```

| Element | Meaning |
|---|---|
| `entries` | number of tracks saved |

**Notes**

- Fails when the queue is empty.
- The target is chosen with [`/AddToPlaylistOptions?saveQueue=1`](#get-addtoplaylistoptions).

---

## 7. Presets

Store, list and play presets (BluOS playlists, inputs and radio stations).

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Preset` | load a preset, the next or the previous one | ✓ | ✓ |
| `GET /Presets` | list the presets | ✓ | ✓ |
| `POST /Presets/edit` | presumably reorder the presets (GET answers 405) | | |
| `GET /SetPreset` | store or delete a preset; without parameters the preset list | | ✓ |

### `GET /Preset`

```
GET /Preset?id=<id|+1|-1>
```

| Parameter | Meaning |
|---|---|
| `id` | preset id, `+1` = next, `-1` = previous preset |

**Response format**

```xml
<state>stream</state>
```

| Element | Meaning |
|---|---|
| `state` | radio preset: new state |
| `loaded` (`service`) > `entries` | preset with a list of tracks: number of tracks loaded |

**Notes**

- Ids need not be consecutive; `+1` / `-1` wrap around.
- The preset's `volume` (see [`/Presets`](#get-presets)) is applied.

### `GET /Presets`

```
GET /Presets
```

No parameters.

**Response format**

```xml
<presets prid="0">
  <preset id="1" name="Mellow Mix" url="/Play?url=RadioParadise:/1:4/Mellow Mix"
          image="https://img.radioparadise.com/channels/0/1/cover_512x512/0.jpg" volume="16"/>
  <preset id="6" name="Radio Köln" url="/Play?url=TuneIn:s16252"
          image="http://cdn-profiles.tunein.com/s16252/images/logog.png" volume="16"/>
</presets>
```

| Element / attribute | Meaning |
|---|---|
| `presets` `prid` | id of the preset list (= `prid` of `/Status`); changes with every change |
| `preset` `id` | slot; ids need not be consecutive |
| `name`, `image` | name and image |
| `url` | request that plays the preset, e.g. `/Play?url=TuneIn:s16252`, `/Load?service=Tidal&id=…` |
| `volume` | volume set when the preset is loaded |

### `POST /Presets/edit`

```
POST /Presets/edit?prid=<prid>
```

| Parameter | Meaning |
|---|---|
| `prid` | `prid` of `/Presets` |

**Response format**

Not known.

**Notes**

- Target of the deep link `/reorder-presets?url=%2FPresets%2Fedit%3Fprid%3D7` of [`/ui/presets`](#get-uipresets) ("Reorder Presets").
- `GET`, `HEAD` and `OPTIONS` answer HTTP 405; presumably takes a `POST` with the new order (body not known).

### `GET /SetPreset`

```
GET /SetPreset?id=<slot>&name=<name>&url=<url>&encoded_url=<url>&image=<image url>&volume=<0–100>&service=<svc>&delete=1
```

| Parameter | Meaning |
|---|---|
| `id` | preset slot; alone it deletes the preset |
| `name` | name of the preset |
| `url` | play request of the item (e.g. its `playURL`) |
| `encoded_url` | source URL, e.g. `RadioParadise:/3:20/The%20Globe` |
| `image` | image of the preset |
| `volume` | volume set when the preset is loaded |
| `service` | source of the item, e.g. `RadioParadise` (not verified) |
| `delete` | `1` together with `id`: deletes the preset |

**Response format**

The new preset list with a new `prid`, as [`/Presets`](#get-presets).

**Notes**

- Without parameters: the preset list.
- `name`, `url`, `image` (from [`/Services`](#get-services)) store the preset in the first free slot; `url` is stored URL-encoded.
- Moving a preset = store it under the new `id`, then `/SetPreset?id=<old>&delete=1`.
- Sources for a new preset: [`/RadioBrowse?service=Presets`](#get-radiobrowse) (BluOS playlists, inputs, radio); albums, artists and songs are not offered.

---

## 8. Browse and search

Navigate the menus of all sources, get play URLs and context menus, and search.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Browse` | menu tree, lists, context menus, search | ✓ | ✓ |
| `GET /Info` | information on an artist, album, track or station (last.fm, lyrics, web page) | | ✓ |
| `GET /RadioBrowse` | list of the inputs; radio menus | ✓ | ✓ |

### `GET /Browse`

```
GET /Browse?key=<key>&q=<text>&withContextMenuItems=<0|1>
```

| Parameter | Meaning |
|---|---|
| `key` | opaque key from `browseKey`, `nextKey`, `parentKey`, `contextMenuKey` or `searchKey` of an earlier answer, URL-encoded; without `key`: top menu |
| `q` | search text, together with a `searchKey`; without `key`: top-level search |
| `withContextMenuItems` | `1` = every item gets an inline `<contextMenu>`; `0` drops only these, keys and URLs stay |

**Response format**

Album list of a library section (with `withContextMenuItems=1`):

```xml
<browse serviceIcon="/images/LibraryIcon.png" serviceName="Library" searchKey="LocalMusic:Search" type="albums">
  <item browseKey="LocalMusic:MG/LocalMusic-Album?album=1&amp;artist=Peter+Gabriel"
        contextMenuKey="LocalMusic:CM/LocalMusic-Album?album=1&amp;artist=Peter+Gabriel&amp;isFavourite=1"
        playURL="/Add?playnow=1&amp;service=LocalMusic&amp;album=1&amp;artist=Peter+Gabriel"
        text="1" text2="Peter Gabriel" tracks="9" isFavourite="true"
        image="/Artwork?service=LocalMusic&amp;album=1&amp;artist=Peter+Gabriel" type="album">
    <contextMenu>
      <item actionURL="/DeleteFavourite?album=1&amp;artist=Peter+Gabriel&amp;service=LocalMusic" text="Remove favourite" type="favourite-delete"/>
      <item actionURL="/Add?album=1&amp;artist=Peter+Gabriel&amp;clear=0&amp;playnow=1&amp;service=LocalMusic&amp;shuffle=0&amp;where=nextAlbum" text="Play now" type="add-now"/>
      <!-- add-shuffle, addAll-next, addAll-last -->
    </contextMenu>
  </item>
  <!-- one <item> per album; nextKey on <browse> when there are more pages -->
</browse>
```

Tracks of an album:

```xml
<browse serviceName="Library" searchKey="LocalMusic:Search" type="tracks"
        playURL="/Add?service=LocalMusic&amp;album=1&amp;artist=Peter+Gabriel&amp;playnow=1">
  <item text="1. Moribund The Burgermeister" duration="260" type="track"
        playURL="/Add?playnow=1&amp;file=%2Fvar%2Fmnt%2F…flac"
        autoplayURL="/Add?service=LocalMusic&amp;listindex=0&amp;nextlist=1&amp;where=last&amp;cursor=last&amp;playnow=1&amp;album=1&amp;artist=Peter+Gabriel"
        contextMenuKey="LocalMusic:CM/LocalMusic-Song?album=1&amp;artist=Peter+Gabriel&amp;filename=…&amp;title=…"
        image="/Artwork?service=LocalMusic&amp;artist=Peter+Gabriel&amp;album=1"/>
</browse>
```

| Element / attribute | Meaning |
|---|---|
| `browse` `type` | `menu`, `contextMenu`, `artists`, `composers`, `albums`, `playlists`, `tracks`, `genres`, `sections` (alphabetic sections), `items` (mixed), `folders` |
| `browse` `serviceName`, `serviceIcon`, `searchKey` | source of the list; key for a search in it |
| `browse` `nextKey`, `parentKey`, `playURL` | next page; parent list; play the whole list |
| `category` (`text`, `nextKey`) | group of items in some answers |
| `item` `type` | `link` (leads further), `audio` (directly playable), `artist`, `composer`, `album`, `playlist`, `track`, `text`, `section`, `folder` |
| `item` `text`, `text2`, `image`, `duration`, `tracks` | title, subtitle (artist, or "track artist • album"), cover, length in s, number of tracks |
| `item` `browseKey` | the item can be opened |
| `item` `playURL` | default play action (usually clear the queue and play) |
| `item` `autoplayURL` | play this track and fill the queue with the rest of its list |
| `item` `contextMenuKey` | key of the item's context menu |
| `item` `isFavourite` | `true` = favourite |
| `contextMenu` > `item` (`actionURL`, `text`, `type`) | menu action: `favourite-add`, `favourite-delete`, `add-now`, `add-next`, `add-last`, `add-shuffle`, `addAll-now`, `addAll-next`, `addAll-last`, `addAll-shuffle`, `playRadio`, `delete` |

**Notes**

- Keys are opaque: pass them unchanged, URL-encoded, as `key=`. Paging with `nextKey`; the page size is fixed by the player.
- With a German `Accept-Language` (as browsers send it) some album keys (`LocalMusic:MG/LocalMusic-Album?…`) answer an empty `<browse type="menu"/>` instead of the tracks; with `Accept-Language: en` or without the header they answer normally.
- Multi-disc albums: the track list has no disc marker; all discs follow in one list. Track *i* is song *i* of [`/library/v1/Songs`](#get-libraryv1songs) for the same album (sorted by `discno`, then `track`), which gives its disc. The number in `text` is the `track` tag; titles may repeat on different discs.
- Streaming services use keys like `/Albums?service=Tidal&category=masters`; their search answers link to `/Artists|Albums|Songs|Playlists?service=…&expr=…`.
- Keys of the local library (`LocalMusic`; for the USB drive they start with its id, e.g. `1A2B_3C4D:`):

  | key | Answer |
  |---|---|
  | (none) | `type="menu"`: sources, playlists, inputs, radio (`browseKey`, `text`, `image`, `type`, `playURL`, `inputType`) |
  | `LocalMusic:` | Artists, Albums, Songs, Genres, Playlists, Composers, Favourites (USB: no Favourites) |
  | `…bySection:Album/…` | `type="sections"`: one `item` per section with `browseKey`, `text`, `text2` = number of albums; USB lists only filled sections |
  | `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | like Album, with counts |
  | `…S:Album/…&section=A` | `type="albums"`: the albums of the section with `browseKey`, `contextMenuKey`, `playURL`, `text`, `text2`, `tracks`, `image` and favourite state |
  | `LocalMusic:GG/Genres` | `type="genres"`: one `item` per genre with `browseKey`, `contextMenuKey` (`LocalMusic:CM/LocalMusic-Genre?genre=…`), `text` and its `contextMenu` (`addAll-now`, `addAll-shuffle`) |
  | `LocalMusic:MG/LocalMusic-Genre?genre=…` | empty – take the genre keys from the genre list |
  | `LocalMusic:MG/LocalMusic-Artist?artist=…` | links "Albums" and "Songs" of the artist; "Albums" (`LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=…&service=LocalMusic`) lists all albums with URLs and context menus, no paging, but **without favourite state** (no `isFavourite`, menu offers `favourite-add` also for favourites) |
  | `LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3F<filter>&service=LocalMusic` | a `/library/v1/Albums` request as browse list with URLs, context menus and favourite state: `recent=1` (50 per page, `nextKey`), `category=FAVOURITES` (one answer); `genre=…` answers **empty** |
  | `LocalMusic:S:Album/%2Flibrary%2Fv1%2FAlbums%3Fquality=cd&service=LocalMusic&limit=50&section=A` | the quality albums of the section with URLs, context menus and favourite state (same albums as `/library/v1/Albums?quality=cd&section=A`) |
  | `LocalMusic:MG/LocalMusic-Favourites` | favourites by type (artists, albums, songs, playlists) |
  | `LocalMusic:MG/LocalMusic-Album?album=…&artist=…` | `type="tracks"` with `playURL`: one `item type="track"` per track with `contextMenuKey`, `playURL`, `autoplayURL`, `text`, `duration`, `image` |
  | `LocalMusic:CM/LocalMusic-Album?album=…&artist=…[&isFavourite=1]` | `type="contextMenu"`: `favourite-add` / `-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last` |
  | `LocalMusic:Search` + `q=love` | `type="menu"`: links to artists, albums, songs, composers; songs and composers come in pages (50 songs, 51 composers) |
  | `LocalMusic:MG/LocalMusic-Composer?composer=…` | links "Albums" (`LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fcomposer=…`) and "Songs" |
  | `LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fcomposer=…&service=LocalMusic` | `type="albums"`: albums with songs of the composer, with URLs and favourite state; `tracks` = number of the composer's songs on the album |
  | `LocalMusic:Song/%2Flibrary%2Fv1%2FSongs%3Fexpr=…&service=LocalMusic` (search link "Songs") | `type="tracks"`, 50 per page: `contextMenuKey` (`artist` = track artist), `playURL` (`/Add?playnow=1&file=…`), `autoplayURL`, `text`, `text2` ("track artist • album"), `duration`, `image`; **no `browseKey`**, no link to the album |
  | `LocalMusic:CM/LocalMusic-Song?…` | `favourite-add`, `add-now`, `add-next`, `add-last`; no "Go to album" |
  | `LocalMusic:Playlist/…imported=1` | `type="playlists"`: the library playlists (see [`/library/v1/Playlists`](#get-libraryv1playlists)) |
  | `BluOS:MG/BluOS-Playlist?playlist=…` | `type="tracks"` with `playURL` `/Load?service=BluOS&name=…`, 10 tracks per page: `playURL`, `autoplayURL` (`/Add?service=BluOS&listindex=<n>&…&playlist=…`), `text`, `text2`, `duration`, `image`, `contextMenuKey` (`BluOS:CM/BluOS-Song?filename=…`: `add-now`, `add-next`, `add-last`); no `browseKey`; with more than 10 tracks `nextKey` `BluOS:Song/%2FSongs%3Fplaylist=…&offset=10`; on later pages `listindex` starts at 0 and the `autoplayURL` carries `offset` |

- Library search: every result list wraps the `/library/v1` endpoint of its type with `expr=<q>` (e.g. `LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fexpr=love&service=LocalMusic`).
  - A term matches at the start of a word, not inside a word; case and accents are ignored (`buble` finds `Bublé`); several words are matched as one string, punctuation included.
  - Albums: title and track artists of the album's songs; **not the album artist**, not song titles, not composers. Songs: title only (not the track artist). Composers: composer name. Artists: track artists only.
  - Album artists are only in the sectioned artists list (`…bySection:Artist/…`, [`/library/v1/Artists`](#get-libraryv1artists)) and in `<art>` of [`/library/v1/Albums`](#get-libraryv1albums).

### `GET /Info`

```
GET /Info?service=<svc>&artist=<artist>&album=<album>&title=<title>&category=technical&filename=<file>&lyricsid=<id>&infourl=<url>&url=<url>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, `RadioParadise` |
| `artist` | artist info; with `album` album info, with `album` + `title` track info |
| `category`, `filename` | `technical` + file of the track: technical data |
| `lyricsid` | lyrics of a track (`lyricsid` of `/Status`) |
| `infourl` | info page of the playing item (`infourl` of `/Status`) |
| `url` | info on a radio station or stream (not verified) |

**Response format**

| Variant | Answer |
|---|---|
| `artist`, `album`, `title` | redirect to last.fm (HTML) |
| `category=technical&filename=…` | HTML table: file path, format (e.g. `FLAC 16/44.1`), sample rate, sample size, channels |
| `infourl=…` | the info web page itself (HTML, e.g. Wikipedia) |
| `lyricsid=…` | HTML page with the lyrics |

### `GET /RadioBrowse`

```
GET /RadioBrowse?service=<service>&url=<url>&key=<key>&c=<category>&id=<station id>
```

| Parameter | Meaning |
|---|---|
| `service` | `Capture` = inputs; `Presets` = sources for a new preset; `Alarms` = sources for an alarm; otherwise a radio service (e.g. `TuneIn`, `RadioParadise`, `Airable`) |
| `url` | e.g. `presets` (favourite stations), `playlists` (with `service=Alarms` / `Presets`), `alarms` (with `service=Airable`), or a full directory URL of the service |
| `c` | radio menus: `station`, `podcast`, `related` (related stations), `selectStream` |
| `key` | e.g. `directory` (with an Airable directory `url`) |
| `id` | station for `c=selectStream`, e.g. `s16252` (TuneIn) |

**Response format**

```xml
<radiotime service="Capture">
  <item text="Bluetooth" id="bluetooth" type="audio" inputType="bluetooth"
        URL="Capture%3Abluez%3Abluetooth" image="/images/BluetoothIcon.png"/>
  <item text="HDMI ARC" id="input4" type="audio" inputType="arc" typeIndex="arc-1"
        URL="Capture%3Ahw%3Aimxspdif%2C0%2F1%2F25%2F2%3Fid%3Dinput4" image="/images/capture/ic_tv.png"/>
  <!-- inputs of a BluOS HUB: <category text="…" icon="…"><remoteitem/></category> -->
</radiotime>
```

| Attribute | Meaning |
|---|---|
| `text`, `image` | name, icon |
| `id`, `type`, `inputType` | item id, `audio` (playable), input type or `station` |
| `URL` | play with [`/Play?url=`](#get-play) (already encoded) |
| `typeIndex` | value for [`/Play?inputTypeIndex=`](#get-play), e.g. `spdif-1` |
| `preset_id`, `is_preset`, `subtext` | radio: station id, `1` = favourite, what is playing now |
| `hasInfo`, `preset_url` | Airable: info available, play URL for presets |

**Notes**

- `service=Capture` lists the active inputs, cloud sources (e.g. Spotify) and HUB inputs.
- `service=Presets` lists My Playlists (`URL="playlists"`; `&url=playlists` gives the BluOS playlists with `URL` `/Load?name=…`), Inputs, Radio (Airable), Radio Paradise and TuneIn; no library albums.
- Radio item attributes are the parameters of [`/ui/ContextMenu`](#get-uicontextmenu).

---

## 9. Favourites

Mark and unmark favourites of the library and of radio services.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /AddFavourite` | mark a favourite | | ✓ |
| `GET /DeleteFavourite` | remove a favourite | | ✓ |
| `GET /RadioAddPreset` | add a URL favourite (radio) | | ✓ |

### `GET /AddFavourite`

```
GET /AddFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&fn=<file>&playlistid=<id>&preset_id=<station id>&url=<action url>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `artist` alone | artist of the local library |
| `albumid` | album of a streaming service |
| `fn` | song of the local library (its file, as `fn` of `/Status`) |
| `playlistid` | library playlist (with `service=LocalMusic`) |
| `preset_id` | TuneIn station, e.g. `s2730` (with `service=TuneIn`) |
| `url` | Airable station: its favourite action URL `https://….airable.io/radio/action/…` (with `service=Airable`) |

**Response format**

```xml
<favourite service="LocalMusic">added</favourite>
```

| Element | Meaning |
|---|---|
| `favourite` | `added`; `service` = source |

**Notes**

- Not documented as a request; appears as `actionURL` in `/Browse` context menus. Take the URLs from the player.
- The state shows in the context menu (`favourite-add` or `favourite-delete`) and in `isFavourite` of `/Browse` and `/library/v1` answers.
- Favourites by kind:

  | Kind | Add | Remove | URLs from | List |
  |---|---|---|---|---|
  | Album (library) | `/AddFavourite?album=…&artist=…` | `/DeleteFavourite?album=…&artist=…` | album context menu | `/library/v1/Albums?category=FAVOURITES` |
  | Artist (library) | `/AddFavourite?artist=…` | `/DeleteFavourite?artist=…` | artist context menu | `/library/v1/Artists?category=FAVOURITES` |
  | Song (library) | `/AddFavourite?fn=…` | `/DeleteFavourite?fn=…` | song context menu, `/ui/queueItemCM` | `/library/v1/Songs?category=FAVOURITES` |
  | Library playlist | `/AddFavourite?playlistid=…` | `/DeleteFavourite?playlistid=…` | playlist context menu | `/library/v1/Playlists?category=FAVOURITES` |
  | Album (streaming service) | `/AddFavourite?albumid=…` | `/DeleteFavourite?albumid=…` | service context menu (not verified) | – |
  | TuneIn station | `/AddFavourite?preset_id=…&service=TuneIn` | `/DeleteFavourite?id=…&service=TuneIn` | station context menu | `/RadioBrowse?service=TuneIn&url=presets` |
  | Airable station | `/AddFavourite?url=…&service=Airable` | `/DeleteFavourite?url=…&service=Airable` | station context menu | `is_preset=1` on the station |
  | URL (radio) | [`/RadioAddPreset`](#get-radioaddpreset) | `/DeleteFavourite?id=u…&service=TuneIn` | TuneIn › Favorites | TuneIn › Favorites, category "Url" |

- USB drives have no favourites (no favourite actions in their menus).
- Radio favourites are TuneIn favourites (stations `s…`, programs `p…`, URL favourites `u…`) of the player's TuneIn account.
- Airable without a login answers `<error service="Airable"><message>Login to use favourites</message></error>`.

### `GET /DeleteFavourite`

```
GET /DeleteFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&fn=<file>&playlistid=<id>&id=<station id>&url=<action url>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `artist` alone | artist of the local library |
| `albumid` | album of a streaming service |
| `fn` | song of the local library |
| `playlistid` | library playlist (with `service=LocalMusic`) |
| `id` | TuneIn favourite: `s…` (station), `p…` (program), `u…` (URL favourite) (with `service=TuneIn`) |
| `url` | Airable station: the same action URL as for `/AddFavourite` (not verified) |

**Response format**

```xml
<favourite service="LocalMusic">deleted</favourite>
```

| Element | Meaning |
|---|---|
| `favourite` | `deleted`; `service` = source |

**Notes**

- Counterpart of [`/AddFavourite`](#get-addfavourite); URLs from the context menu of a favourite.
- Without parameters the answer is also `deleted`, but nothing changes – the answer does not prove a removal.
- TuneIn: `preset_id` adds a station, `id` removes it.

### `GET /RadioAddPreset`

```
GET /RadioAddPreset?service=<service>&name=<name>&url=<url>
```

| Parameter | Meaning |
|---|---|
| `service` | radio service, e.g. `TuneIn` |
| `name` | name of the favourite |
| `url` | stream URL to play |

**Response format**

Empty answer.

**Notes**

- Adds a TuneIn favourite of the category "Url" (`preset_id` `u…`), not a station favourite; remove it with `/DeleteFavourite?id=u…&service=TuneIn`.
- The player prefixes `url` with `TuneIn:` (`url=TuneIn:s16252` is stored as `TuneIn:TuneIn%3As16252`), so `url` takes a plain stream URL.

---

## 10. Service functions

Lists and cover art of every music service, answered by the service named in `service`.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Albums` | albums of a service | | ✓ |
| `GET /Artists` | artists of a service | | ✓ |
| `GET /Artwork` | cover art of albums, tracks, playlists, stations | ✓ | ✓ |
| `GET /Composers` | composers of a service | | ✓ |
| `GET /Folders` | folders of a library service | | ✓ |
| `GET /Genres` | genres of a service | | ✓ |
| `GET /Playlists` | playlists of a service; the BluOS playlists | | ✓ |
| `GET /Songs` | songs of a service; tracks of a BluOS playlist | | ✓ |

### `GET /Albums`, `/Artists`, `/Composers`, `/Folders`, `/Genres`

```
GET /Albums?service=<svc>&…
GET /Artists?service=<svc>&…
GET /Composers?service=<svc>&…
GET /Folders?service=<svc>&…
GET /Genres?service=<svc>&…
```

| Parameter | Meaning |
|---|---|
| `service` | the service that answers |
| others | the parameters of that service, e.g. `category=masters` (Tidal), `artist`, `section` (library) |

**Response format**

| `service` | Answer |
|---|---|
| none, `LocalMusic` or the USB id | HTTP **302** to the same request under `/library/v1` on port 11004, e.g. `/Albums?service=LocalMusic&artist=Adele` → `http://<player>:11004/library/v1/Albums?service=LocalMusic&artist=Adele` |
| a streaming or radio service (`Tidal`, `Qobuz`, `TuneIn`) | HTTP 200 with the answer of the service; without a login or for a list the service does not offer an `<error service="…">`; `/Folders` HTTP 404 |
| `BluOS` | HTTP 404 |
| unknown (e.g. `Capture`) | HTTP 404, the service name as body |

**Notes**

- They appear in the keys of [`/Browse`](#get-browse) (e.g. `/Albums?service=Tidal&category=masters`).
- For the library call [`/library/v1/…`](#11-library-functions) directly on port 11000 instead of following the redirect.
- `/Search` does not exist as a short form (HTTP 404); every service searches through `/Browse` with its `searchKey`.

### `GET /Artwork`

```
GET /Artwork?service=<svc>&album=<album>&artist=<artist>&songid=<id>&albumid=<id>&fn=<file>&playlistimage=<id>&width=<px>&height=<px>&followRedirects=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the image |
| `album`, `artist` | album of the local library |
| `songid`, `albumid` | track / album of a streaming service |
| `fn` | file of the local library (e.g. track cover, image of a BluOS playlist) |
| `playlistimage` | image of a streaming playlist |
| `width`, `height` | size in pixels; one of them alone also works |
| `followRedirects` | `1` = answer with the image instead of a redirect |

**Response format**

The image (HTTP 200, e.g. `image/jpeg`). Without `followRedirects=1` a library service answers HTTP **301** to the same request under [`/library/v1/Artwork`](#get-libraryv1artwork) on port 11004.

**Notes**

- Take the URL from the `image` attribute of an answer and append `followRedirects=1`.
- CORS: `Access-Control-Allow-Origin: *`, also for `Origin: null` (a page opened as a file).
- No cache headers (`Cache-Control`, `Expires`, `ETag`, `Last-Modified`).

### `GET /Playlists`

```
GET /Playlists?service=BluOS&sort=<alpha|recent>&playlist=<name>&playlistid=&myPlaylists=1
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS`; none or `LocalMusic` answer the same, the USB id HTTP 404; other services see [`/Albums`](#get-albums-artists-composers-folders-genres) |
| `sort` | `alpha` (default, A → Z, upper case before lower case) or `recent` ("Date added"); any other non-empty value sorts like `recent` |
| `playlist` | only this playlist (exact name, case-sensitive); unknown: `<error service="BluOS"><message>not found</message></error>` |
| `playlistid` | no effect |
| `myPlaylists` | `1` = only the user's own playlists (`myPlaylistsFilter` of `/Services`) |

**Response format**

```xml
<playlists service="BluOS">
  <name image="/Artwork?service=LocalMusic&amp;fn=…">My Playlist</name>
  <name image="/Artwork?service=LocalMusic&amp;fn=…">Party</name>
</playlists>
```

| Element / attribute | Meaning |
|---|---|
| `name` | name of a BluOS playlist |
| `name` `image` | image (cover of a track) |

**Notes**

- One answer, no paging (`start` / `end` have no effect); no play URL – that comes from `/Browse`.
- **No search:** `expr`, `search`, `q`, `filter`, `name`, `text` are ignored; the service `BluOS` has no `searchKey` (`/Browse?key=BluOS:Search` answers HTTP 500).
- Library playlists come from [`/library/v1/Playlists`](#get-libraryv1playlists).

### `GET /Songs`

```
GET /Songs?service=BluOS&playlist=<name>&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS`; ignored with `playlist` |
| `playlist` | name of the BluOS playlist |
| `offset` | first track of the page (from `nextlink`) |

**Response format**

```xml
<songs service="BluOS" playlist="My Playlist">
  <song service="LocalMusic">
    <art>Tanita Tikaram</art>
    <alb>Ancient Heart</alb>
    <title>Good Tradition</title>
    <track>1</track>
    <date>1988</date>
    <time>173</time>
    <fn>/var/mnt/nas-Music/…/01-Good Tradition.flac</fn>
    <quality>cd</quality>
  </song>
  <!-- 10 songs per page -->
  <nextlink>/Songs?playlist=My+Playlist&amp;offset=10</nextlink>
</songs>
```

| Element | Meaning |
|---|---|
| `song` `service` | source of the track |
| `art`, `alb`, `title`, `track`, `date`, `time` | track artist, album, title, track number, year, length in s |
| `fn`, `quality` | file, quality |
| `nextlink` | next page |

**Notes**

- 10 tracks per page. With `playlist` answered on port 11000 whatever the `service`.
- Without `playlist`: dispatched like [`/Albums`](#get-albums-artists-composers-folders-genres) (library → [`/library/v1/Songs`](#get-libraryv1songs); `BluOS` → `<error service="BluOS"><message>not found</message></error>`).

---

## 11. Library functions

Lists and cover art of the local library and the USB drive, answered by the library server (`/library/v1`).

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /library/v1/Albums` | albums by section, newest, favourites, quality, genre, artist | | ✓ |
| `GET /library/v1/Artists` | artist names | | ✓ |
| `GET /library/v1/Artwork` | album cover from the library server | | ✓ |
| `GET /library/v1/Composers` | composers | | ✓ |
| `GET /library/v1/Folders` | folder tree | | ✓ |
| `GET /library/v1/Genres` | all genre names | | ✓ |
| `GET /library/v1/Playlists` | library playlists or favourite playlists | | ✓ |
| `GET /library/v1/Search` | artists, albums, songs for a search term | | ✓ |
| `GET /library/v1/Songs` | songs with technical data | | ✓ |

**Common to all endpoints**

- `service`: `LocalMusic` (local library) or the id of the USB drive (e.g. `1A2B_3C4D`); other services answer `<error>no collection</error>`.
- Answered on port 11000 and on port 11004 (target of the redirects of the [service functions](#10-service-functions)).
- The root of every answer carries `id`, `service` and all filters passed as attributes.
- `id` of the library is the version of the library index, the same in every answer: it changes when a rescan ends (also without changed files; the old value stays during the scan) and with every favourite added or removed. Compare it for equality only: the upper 16 bits count the favourite changes and start again at 0 after a rescan. USB: always `1`.
- Paging with `<nextlink>` (full URL of the next page).

### `GET /library/v1/Albums`

```
GET /library/v1/Albums?service=<svc>&section=<letter|all>&length=1&recent=1&category=FAVOURITES&quality=<hr|cd|mqa>&genre=<genre>&artist=<artist>&album=<album>&composer=<composer>&expr=<text>&limit=<n>&start=<n>&sort=<sort>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | alphabetic section, e.g. `A`: all albums of the section; `all` = all sections in one answer |
| `length` | `1` with `section=all`: only the sections with their album counts |
| `recent` | `1` = the 1000 newest albums, 50 per page |
| `category` | `FAVOURITES` = favourite albums, one answer |
| `quality` | `hr` (HD), `cd`, `mqa` – only with `section`, `artist`, `category`, `recent` or `expr` |
| `genre` | albums of a genre – only with `section`, `artist`, `category` or `recent`; all albums of a genre: `section=all` |
| `artist` | all albums whose album artist or a track artist is exactly this name, one answer |
| `album` | with `artist`: one album with `cover` |
| `composer` | albums with songs of the composer |
| `expr` | search term (see [`/Browse`](#get-browse)) |
| `limit`, `start` | ignored with `section` |
| `sort` | `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate` (from `/Services`); empty answer without `section`; `decade` with `section=all&length=1` = one section per decade |

**Response format**

`section` (also with `quality` or `genre`; with `section=all` one `<section>` per letter):

```xml
<albums limit="500" quality="cd" section="A" id="327701" service="LocalMusic">
  <sections>
    <section name="A">
      <album tracks="10" date="1982">
        <title>A Broken Frame</title>
        <art>Depeche Mode</art>
      </album>
      <!-- one <album> per album of the section -->
    </section>
  </sections>
</albums>
```

`section=all&length=1&sort=decade` (without `sort` one `section` per letter):

```xml
<albums length="1" section="all" sort="decade" id="37" service="LocalMusic">
  <sections>
    <section name="1940" length="2"></section>
    <section name="1950" length="7"></section>
    <!-- one <section> per decade that has albums -->
  </sections>
</albums>
```

`recent=1` and `category=FAVOURITES`:

```xml
<albums recent="1" id="327701" service="LocalMusic">
  <album>
    <alb>Wish You Were Here (50th Anniversary)</alb>
    <art>Pink Floyd</art>
  </album>
  <album isFavourite="1">
    <alb>The Wall HiRes</alb>
    <art>Pink Floyd</art>
  </album>
  <!-- 50 per page -->
  <nextlink>/library/v1/Albums?count=50&amp;recent=1&amp;service=LocalMusic&amp;start=50</nextlink>
</albums>
```

`artist`:

```xml
<albums artist="Paolo Fresu" id="327705" service="LocalMusic">
  <artist name="Paolo Fresu">
    <album tracks="15" date="2005">Kosmopolites</album>
    <album tracks="29" date="2010">Songlines - Night &amp; Blue</album>
  </artist>
</albums>
```

`album` + `artist` (also `composer`):

```xml
<albums album="Kosmopolites" artist="Paolo Fresu" id="327705" service="LocalMusic">
  <album tracks="15" date="2005">
    <title>Kosmopolites</title>
    <art>Paolo Fresu</art>
    <cover>/Artwork?service=LocalMusic&amp;album=Kosmopolites&amp;artist=Paolo+Fresu</cover>
  </album>
</albums>
```

| Element / attribute | Meaning |
|---|---|
| `section` `name`, `length` | letter or decade; number of albums (index only) |
| `album` `tracks` | number of tracks |
| `album` `date` | year (four digits); missing without a year tag and in `recent` / `category` answers |
| `album` `isFavourite` | `1` = favourite |
| `title`, `alb`, album text | album title (depending on the form) |
| `art` | album artist |
| `cover` | cover URL |
| `nextlink` | next page |

**Notes**

- Without a filter (or only `service`) the answer is empty.
- `section=all` answers the same albums as the requests per section; no paging (`limit`, `count`, `start`, `offset` ignored). In a [`/Browse`](#get-browse) key only the first section is answered.
- `section=all` fails silently: `category`, `recent` and `composer` are ignored (all albums); `artist` and `expr` filter the list, but the index (`length=1`) counts 0.
- `genre` takes the value as in the `browseKey` of the genre (e.g. `R%26B`).
- Filters combine: `genre` and `quality` narrow `section`, `artist`, `category` and `recent` (with `recent` within the 1000 newest albums); `quality` also narrows `expr`, `genre` with `expr` answers empty. Alone, `genre` and `quality` answer empty.
- Of `expr`, `artist`, `category` and `recent` only one applies: `expr` wins over `artist`, `artist` over `category` and `recent`.
- No filter for other tags: `year`, `date`, `decade`, `albumartist`, `label`, `conductor`, `performer`, `discno`, `format`, `codec`, `atype`, `samplerate`, `samplebits`, `channels`, `mood`, `rating`, `comment`, `title` are ignored.
- Decades: the counts equal the `date` years of the letter sections; albums without a year tag are in no decade.
- One `date` per album, also when its songs have different years.
- **No compilation filter:** `compilation=1`, `compilations=1`, `category=COMPILATIONS`, `type=compilation` are ignored. The `compilation` tag is only in the songs of one album ([`/library/v1/Songs`](#get-libraryv1songs)); samplers are found only by their album artist (e.g. `artist=Various`).
- **No genre per album** in any answer; it follows only from the album lists of all genres (`genre=…&section=all`, one request per genre).
- **Albums with `mqaBrowse` songs are in no quality list** (player bug): albums whose songs all have `<quality>mqaBrowse</quality>` are missing from `quality=hr`, `cd`, `mqa` and `mqaBrowse`, while `/library/v1/Songs` finds their songs with `quality=mqa`.

### `GET /library/v1/Artists`

```
GET /library/v1/Artists?service=<svc>&section=<letter|all>&category=FAVOURITES&genre=<genre>&artist=<artist>&expr=<text>&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | artists of the section; `all` = all album artists in one answer |
| `category` | `FAVOURITES` = favourite artists |
| `genre` | artists of a genre – with `section` |
| `artist` | only this artist |
| `expr` | album and track artists with a word starting with the term |
| `offset` | without a filter: first entry of the page |

**Response format**

```xml
<artists section="A" id="327705" service="LocalMusic">
  <sections>
    <section name="A">
      <art>A-ha</art>
      <art isFavourite="1">AC-DC</art>
      <art>Adele</art>
      <!-- one <art> per artist of the section -->
    </section>
  </sections>
</artists>
```

| Element / attribute | Meaning |
|---|---|
| `section` `name` | letter |
| `art` | artist name; with `category=FAVOURITES` directly under the root |
| `art` `isFavourite` | `1` = favourite |

**Notes**

- Empty without a filter; with `offset` alone the list is paged.
- The sections list **album artists**, not artists that only appear on tracks.

### `GET /library/v1/Artwork`

```
GET /library/v1/Artwork?service=<svc>&album=<album>&artist=<artist>&fn=<file>&width=<px>&height=<px>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `album`, `artist` | the album |
| `fn` | file of a track |
| `width`, `height` | size in pixels, as with [`/Artwork`](#get-artwork) |

**Response format**

The image (HTTP 200, `image/jpeg`); `artist` alone: HTTP 200 without content.

**Notes**

- Target of the [`/Artwork`](#get-artwork) redirect (port 11004); also answers on port 11000.

### `GET /library/v1/Composers`

```
GET /library/v1/Composers?service=<svc>&section=<letter>&genre=<genre>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | composers of the section; `all` only with `length=1` (index), else empty |
| `genre` | with `section`: composers of the genre |

**Response format**

```xml
<composers id="327705" service="LocalMusic">
  <composer>Adolphe Adam</composer>
  <composer>Alan Silvestri</composer>
  <!-- 51 per page without a filter -->
  <nextlink>/library/v1/Composers?end=101&amp;service=LocalMusic&amp;start=51</nextlink>
</composers>
```

| Element | Meaning |
|---|---|
| `composer` | composer name; with `section` grouped in `<sections><section name="…">` |
| `nextlink` | next page |

**Notes**

- Without a filter: pages of 51. `artist` is ignored.

### `GET /library/v1/Folders`

```
GET /library/v1/Folders?service=<svc>&path=<path>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `path` | folder to list, e.g. `//nas/Music`; without it the shares |

**Response format**

```xml
<folders id="327705" service="LocalMusic">
  <subfolders>
    <folder>//nas/Music</folder>
  </subfolders>
  <!-- with path: also <songs> with the songs of the folder -->
</folders>
```

| Element | Meaning |
|---|---|
| `subfolders` > `folder` | sub folder (without `path`: share) |
| `songs` | songs of the folder (with `path`) |

### `GET /library/v1/Genres`

```
GET /library/v1/Genres?service=<svc>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |

**Response format**

```xml
<genres id="327701" service="LocalMusic" length="34">
  <genre>Alternative Rock</genre>
  <genre>Audiobook</genre>
</genres>
```

| Element / attribute | Meaning |
|---|---|
| `length` | number of genres |
| `genre` | genre name |

**Notes**

- All genre names in one answer, but no keys for `/Browse`. `category`, `album` and `artist` are ignored.

### `GET /library/v1/Playlists`

```
GET /library/v1/Playlists?service=<svc>&imported=1&category=FAVOURITES
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `imported` | `1` = library playlists: playlist files (e.g. M3U) of the share or USB drive, imported by the library index (same answer without it) |
| `category` | `FAVOURITES` = favourite library playlists |

**Response format**

```xml
<playlists imported="1" id="39" service="LocalMusic">
  <name id="756cf45008180e2a029f54c1153f0bf0" image="/Artwork?service=LocalMusic&amp;fn=/var/mnt/nas-Music/…/1-Someday.flac">My Mix</name>
</playlists>
```

| Element / attribute | Meaning |
|---|---|
| `name` | name of the library playlist |
| `name` `id` | playlist id (32 hex digits): `playlistid` of browse keys and `/Add`, `id` of `/Load` |
| `name` `image` | image (cover of a track) |
| `name` `isFavourite` | `1` = favourite |

**Notes**

- Not in the BluOS playlists ([`/Playlists`](#get-playlists)); read-only through the player.
- Tracks only through [`/Browse`](#get-browse): `/library/v1/Songs?playlist=<id>` answers empty.
- In `/Browse` the library menu link "Playlists" (`LocalMusic:Playlist/%2Flibrary%2Fv1%2FPlaylists%3Fimported=1&service=LocalMusic`) lists one `item type="playlist"` per playlist: `browseKey` `LocalMusic:MG/LocalMusic-Playlist?playlist=<name>&playlistid=<id>`, `contextMenuKey` `LocalMusic:CM/LocalMusic-Playlist?…`, `playURL` `/Load?service=LocalMusic&name=<name>&id=<id>`. The `browseKey` answers all tracks in one answer, each `autoplayURL` with `playlist` and `playlistid`.
- Context menu: `add-now`, `add-shuffle`, `add-next`, `add-last`, `favourite-add` / `favourite-delete` (`/AddFavourite?playlistid=<id>&service=LocalMusic`); no `delete`. A favourite has `isFavourite="true"` on its browse item and `&isFavourite=1` in its `contextMenuKey`, which comes right after `?` (album keys: at the end).
- BluOS playlists have no favourite: their context menu (`BluOS:CM/BluOS-Playlist?playlist=…`) offers `add-now`, `add-shuffle`, `add-next`, `add-last`, `delete`.

### `GET /library/v1/Search`

```
GET /library/v1/Search?service=<svc>&expr=<text>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `expr` | search term |

**Response format**

```xml
<search expr="a" id="327705" service="LocalMusic">
  <artists expr="a" id="327705" service="LocalMusic">
    <artist>
      <name>10cc</name>
    </artist>
  </artists>
  <albums expr="a" id="327705" service="LocalMusic">
    <album tracks="11">
      <title>10,000 Hz Legend</title>
      <art>Air</art>
      <cover>/Artwork?service=LocalMusic&amp;album=10%2C000+Hz+Legend&amp;artist=Air</cover>
    </album>
  </albums>
  <songs expr="a" id="327705" service="LocalMusic">
    <song>
      <title>#Addicted</title>
      <art>Riverside</art>
      <alb>Love, Fear and the Time Machine</alb>
      <fn>/var/mnt/nas-Music/…/03-#Addicted.flac</fn>
      <track>3</track>
      <discno>1</discno>
      <time>294</time>
      <date>2015</date>
      <quality>cd</quality>
    </song>
  </songs>
</search>
```

| Element | Meaning |
|---|---|
| `artists` > `artist` > `name` | track artist found |
| `albums` > `album` (`tracks`, `title`, `art`, `cover`) | album found |
| `songs` > `song` | song found, elements as in [`/library/v1/Songs`](#get-libraryv1songs) (also `composer`) |

**Notes**

- At most 25 hits per type, no `nextlink`; the search through `/Browse` returns all hits.
- Matches like the search through `/Browse`: albums by title and track artists, **not by the album artist**.

### `GET /library/v1/Songs`

```
GET /library/v1/Songs?service=<svc>&album=<album>&artist=<artist>&composer=<composer>&section=<letter>&genre=<genre>&category=FAVOURITES&quality=<quality>&expr=<text>&limit=<n>&all=1&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `album` | with `artist`: all songs of the album with technical data |
| `artist` | all songs whose album artist or track artist is exactly this name, one answer |
| `composer` | songs of the composer |
| `section` | songs of the section, paged; `all` only with `length=1` (index), else empty |
| `genre` | with `section` (50 per page) or `artist`: songs on albums of the genre |
| `category` | `FAVOURITES` = favourite songs |
| `quality` | with `section`, `artist`, `composer` or `expr`: songs of a quality, e.g. `cd`, `mqa`, `mqaBrowse` |
| `expr` | search term, song titles only (see [`/Browse`](#get-browse)) |
| `limit` | page size (e.g. `section=A&limit=5`); `limit=1` can answer only a `nextlink` |
| `all` | `1` = all songs of the source, paged with `offset` |
| `offset` | first entry of the page |

**Response format**

```xml
<songs album="La Migliore Canzone Italiana di Natale" artist="Various" id="2031641" service="LocalMusic">
  <song samplerate="44100" samplebits="16" channels="2" bitrate="747475" atype="flc">
    <songID>2cd2463cc377db14c2ae64ac9a6c420b</songID>
    <art>Laura Pausini, The Patrick Williams Orchestra</art>
    <alb>La Migliore Canzone Italiana di Natale</alb>
    <title>White Christmas</title>
    <composer>Irving Berlin</composer>
    <track>1</track>
    <discno>1</discno>
    <date>2023</date>
    <time>142</time>
    <compilation>1</compilation>
    <albumartist>Various</albumartist>
    <quality>cd</quality>
    <fn>/var/mnt/nas-Music/Compilations/…/1-White Christmas.flac</fn>
  </song>
  <!-- one <song> per track -->
</songs>
```

| Element / attribute | Meaning |
|---|---|
| `samplerate`, `samplebits`, `channels`, `bitrate`, `atype` | technical data; `atype` = file type (e.g. `flc`) |
| `songID` | song id |
| `art` | track artist |
| `alb`, `title`, `track`, `date`, `time` | album, title, track number, year, length in s |
| `composer` | composer (only with the tag) |
| `discno` | disc number (only with the tag) |
| `albumartist`, `compilation` | album artist and `1` on samplers (only with the tags) |
| `quality` | `hr`, `cd`, `mqa`, `mqaBrowse`, or the bitrate (MP3: recognise by `atype`) |
| `fn` | file |
| `isFavourite` | `1` = favourite |
| `nextlink` | next page |

**Notes**

- Empty with only `service`, and with `genre` or `quality` alone.
- `composer` wins over `artist`. No filter for other tags (e.g. `year`, `albumartist`, `discno`, `samplerate`).
- Paged lists (`section`, `genre`, `all`) lack the technical attributes and `songID`, `track`, `date`, `time`.
- Songs are sorted by `discno`, then `track` – the order of the album track list of [`/Browse`](#get-browse).
- Without `albumartist` the album artist is the `art` of the album in [`/library/v1/Albums`](#get-libraryv1albums).
- Songs with `quality` `mqaBrowse` are missing from the quality lists of `/library/v1/Albums`.

---

## 12. Player grouping

Group players; the primary player selects the source, secondary players follow.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /AddSlave` | add players to a group | ✓ | |
| `GET, POST /proxyToSlave` | forward a request to a group member | | ✓ |
| `GET /RemoveSlave` | remove players from a group | ✓ | |
| `GET, POST /SlaveVolume` | level trim of a member of a fixed group | | ✓ |

### `GET /AddSlave`

```
GET /AddSlave?slave=<ip>&port=<port>&group=<name>&slaves=<ip1>,<ip2>&ports=<p1>,<p2>
```

| Parameter | Meaning |
|---|---|
| `slave` | IP address of one secondary player |
| `port` | its port (default 11000) |
| `group` | group name; without it BluOS picks one |
| `slaves` | IP addresses of several secondary players, comma-separated |
| `ports` | their ports, comma-separated |

**Response format**

```xml
<addSlave>
  <slave port="11000" id="192.168.1.153"/>
  <slave port="11000" id="192.168.1.120"/>
</addSlave>
```

| Element | Meaning |
|---|---|
| `slave` (`id`, `port`) | player added |

**Notes**

- Send to the primary player. Use `slave` + `port` or `slaves` + `ports`.
- Fixed groups (home theatre, stereo pairs) are set up in the BluOS Controller.

### `GET, POST /proxyToSlave`

```
GET  /proxyToSlave?slave=<ip>%3A<port>&url=<encoded path>
POST /proxyToSlave?slave=<ip>%3A<port>&url=<encoded path>   (JSON body {"<name>":"<value>"})
```

| Parameter | Meaning |
|---|---|
| `slave` | address and port of the group member |
| `url` | URL-encoded request to forward, e.g. `%2FSyncStatus`, `%2Fsetting` |

**Response format**

The answer of the forwarded request, e.g. the `/SyncStatus` of the member (with `managedZoneSlave="true"`, `pairSlaveOnly`, `master`, `slaveVol`).

**Notes**

- `url` of fixed group members in [`/Settings`](#get-settings); changes their settings with POST, e.g. `url=%2Fsetting` and `{"ledbrightness":"dim"}`.

### `GET /RemoveSlave`

```
GET /RemoveSlave?slave=<ip>&port=<port>&slaves=<ip1>,<ip2>&ports=<p1>,<p2>
```

| Parameter | Meaning |
|---|---|
| `slave`, `port` | one player to remove |
| `slaves`, `ports` | several players, comma-separated |

**Response format**

The [`/SyncStatus`](#get-syncstatus) answer of the primary player.

**Notes**

- Removing the primary of a group of 3 or more players leaves the rest as a new group.
- To leave a group, a player calls `/RemoveSlave` with its own address.
- `zoneUngroup` of `/SyncStatus` and the "Delete fixed group" button in `/Settings` use it.

### `GET, POST /SlaveVolume`

```
GET  /SlaveVolume?slave=<ip>:<port>&db=<dB>
POST /SlaveVolume?slave=<ip>:<port>   (JSON body {"db":<dB>})
```

| Parameter | Meaning |
|---|---|
| `slave` | address and port of the group member |
| `db` | level trim in dB, -30 … 30 in steps of 1 |

**Response format**

```xml
<slaveVolume min="-30" max="30" step="1" isBalance="false">1</slaveVolume>
```

| Element / attribute | Meaning |
|---|---|
| text | new trim in dB |
| `min`, `max`, `step` | range |
| `isBalance` | `true` = balance instead of trim |

**Notes**

- In `/Settings?id=audio` of a fixed group (e.g. "Right Surround Trim"); the member's own `/SyncStatus` shows the trim as `slaveVol`.

---

## 13. System

Settings, alarms, sleep timer, library index, diagnostics and the web pages of the player.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Alarms` | list, create, change and delete alarms | | ✓ |
| `GET, POST /alsa_setting` | listening mode and tone controls | | ✓ |
| `GET /apmode` | web page "Force Hotspot Mode" (port 80) | | |
| `GET, POST /audiomodes` | audio and Bluetooth modes | ✓ | ✓ |
| `GET /audioPreset` | current listening mode and its choices | | ✓ |
| `GET /Dataexport` | system log of the player (port 80) | | ✓ |
| `GET, POST /delete_index` | web page "Rebuild Index": confirmation, then rebuild (port 80) | | ✓ |
| `GET /diag` | diagnostic report (port 80) | | ✓ |
| `GET /diagnostics` | web page "Diagnostics" (port 80) | | ✓ |
| `GET /Doorbell` | play the doorbell chime | ✓ | ✓ |
| `GET /download_playlists_api` | backup of the BluOS playlists (port 80) | | ✓ |
| `GET /error` | read and clear the last error message | | ✓ |
| `GET /GitVersion` | BluOS version | | ✓ |
| `GET /LastScanCode` | last received IR code | | ✓ |
| `GET /Name` | read or change the player name | | ✓ |
| `POST /reboot` | soft reboot (port 80) | ✓ | ✓ |
| `GET /redirectToCp` | redirect to a page of the web interface | | ✓ |
| `GET /Reindex` | rescan the music library | | ✓ |
| `GET /Services` | self-description of the sources | | ✓ |
| `GET /services` | web page "Configure Music Services" (port 80) | | ✓ |
| `GET, POST /setting` | change a simple setting | | ✓ |
| `GET /Settings` | settings tree of the player | ✓ | ✓ |
| `GET /settings/sendSupportRequest` | web page "Send support request" (port 80) | | ✓ |
| `GET /sharecfg` | web page for network shares (port 80) | | ✓ |
| `GET /Shares` | network shares of the library (port 80) | | ✓ |
| `GET /ShowIRCodes` | IR codes learned from a remote control | | ✓ |
| `GET /Sleep` | step the sleep timer | | ✓ |
| `GET /statistics` | switch the statistics collection (port 80) | | ✓ |
| `GET /triggercfg` | web page for learning IR codes (port 80) | | ✓ |
| `GET /update` | firmware upgrade notification with its choices | | ✓ |
| `GET /UpdateDNS` | purpose unknown (presumably refreshes the network name registration) | | ✓ |
| `GET /upgrade` | check for a firmware upgrade, start or delay it | | ✓ |
| `POST /upload_playlists_api` | restore the BluOS playlists (port 80) | | ✓ |
| `GET /Version` | API version | | ✓ |
| `GET /wificfg` | web page for the Wi-Fi settings (port 80) | | ✓ |

### `GET /Alarms`

```
GET /Alarms?tz=<time zone>&id=<id>&enable=<0|1>&days=<flags>&hour=<HH>&minute=<MM>&end=<HHMM>&fadein=<0|1>&volume=<0–100>&source=<name>&url=<play request>&image=<image url>&shuffle=<true|false>&canShuffle=<true|false>&useBackup=<true|false>&delete=1
```

| Parameter | Meaning |
|---|---|
| `tz` | time zone of the client, e.g. `Europe/Berlin`; sent with every request |
| `id` | alarm to change; without `id` (and with the alarm parameters) a new alarm is created |
| `enable` | `1` = on, `0` = off |
| `delete` | `1` with `id`: delete the alarm |
| `days` | seven flags from Sunday to Saturday, e.g. `0001000` = Wednesday |
| `hour`, `minute` | start time |
| `end` | end time `HHMM` |
| `fadein` | `1` = fade the volume in |
| `volume` | alarm volume 0–100 |
| `source`, `url`, `image` | what plays: name, play request (e.g. `/Load?name=…`), image |
| `shuffle`, `canShuffle` | play shuffled / whether the source can be shuffled |
| `useBackup` | presumably a fallback sound when the source is not available |

**Response format**

```xml
<alarms supportsEndTime="true">
  <alarm id="1" enable="1" hour="8" minute="0" days="0000001" duration="60" end="0900"
         volume="25" voldb="-40.8" fadein="1" source="Mellow Mix"
         url="/Play?url=RadioParadise:/1:4/Mellow Mix"
         image="https://img.radioparadise.com/channels/0/1/cover_512x512/0.jpg" useBackup="false"/>
</alarms>
```

| Attribute | Meaning |
|---|---|
| `supportsEndTime` | alarms can have an end time |
| `id`, `enable` | alarm id, `1` = on |
| `hour`, `minute`, `days` | start time, weekday flags (Sunday to Saturday, `0000001` = Saturday) |
| `duration`, `end` | playing time in minutes, end time `HHMM` |
| `volume`, `voldb`, `fadein` | alarm volume (0–100, dB), fade in |
| `source`, `url`, `image` | what plays |
| `useBackup` | presumably a fallback sound |

**Notes**

- Alarm sources: [`/RadioBrowse?service=Alarms`](#get-radiobrowse). While an alarm plays, `/Status` shows the rest in `alarmsecondsremaining`.

### `GET, POST /alsa_setting`

```
GET  /alsa_setting?preset=<mode>&eq-switch=<ON|OFF>&eq-treble=<dB>&eq-bass=<dB>&eq-balance=<n>&eq-centre-trim=<n>&eq-crossover=<Hz>&reset&resetPreset
POST /alsa_setting   (JSON body {"<name>":<value>})
```

| Parameter | Meaning |
|---|---|
| `preset` | listening mode, a `name` from [`/audioPreset`](#get-audiopreset) (e.g. `MUSIC`, `MOVIE`, `TV`) |
| `eq-switch` | tone controls `ON` / `OFF` |
| `eq-treble`, `eq-bass` | -6 … 6 dB in steps of 0.5 (only with `eq-switch=ON`) |
| `eq-balance` | -7 … 7 in steps of 0.5 |
| `eq-centre-trim` | -10 … 10 in steps of 0.5 (only with centre channel) |
| `eq-crossover` | subwoofer crossover 40 … 200 Hz in steps of 10 (only with a subwoofer) |
| `reset` | all listening modes back to the defaults |
| `resetPreset` | only the current listening mode |

**Response format**

Empty answer (HTTP 200); with `preset` HTTP 205.

**Notes**

- GET with name and value as query and POST with a JSON body work alike; numbers without quotes in JSON (`{"eq-bass":-1}`).
- Available settings, ranges and dependencies: `/Settings?id=audio`; they depend on the player (DSP, centre, subwoofer).
- A `preset` change ends a `/Status` long poll with `syncStat` + 1.

### `GET /apmode`

```
GET http://<player>:80/apmode?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

Not known.

**Notes**

- Linked on the diagnostics page. Presumably switches the player to its own Wi-Fi hotspot (setup mode), leaving the home network.

### `GET, POST /audiomodes`

```
GET  /audiomodes?bluetoothAutoplay=<0–3>&subwoofer=<default|withsub>&ears=<ON|OFF>&volumeLimits=<min>,<max>&replayGainMode=<none|track|album|smart>&mqaDisable=<ON|OFF>&fixedVolume=<ON|OFF>&channelMode=<name>&enableClockTrim=<ON|OFF>
POST /audiomodes   (JSON body {"<name>":"<value>"})
```

| Parameter | Meaning |
|---|---|
| `bluetoothAutoplay` | Bluetooth mode: `0` = manual, `1` = automatic, `2` = guest, `3` = disabled |
| `subwoofer` | `default` = off, `withsub` = on |
| `ears` | stereo surround `ON` / `OFF` |
| `volumeLimits` | minimum and maximum volume in dB, e.g. `-70,-10` (range -90 … 0, at least 30 dB apart) |
| `replayGainMode` | `none`, `track`, `album`, `smart` |
| `mqaDisable` | MQA decoding off (`ON`) / on (`OFF`) (not verified) |
| `fixedVolume` | fixed volume `ON` / `OFF` (not verified) |
| `channelMode` | channel mode (not verified) |
| `enableClockTrim` | clock trim `ON` / `OFF` (not verified) |

**Response format**

Empty answer (HTTP 200).

**Notes**

- GET with name and value as query and POST with a JSON body work alike.
- Without parameters the answer is empty; read the current values from `/Settings?id=audio`.

### `GET /audioPreset`

```
GET /audioPreset
```

No parameters.

**Response format**

```xml
<setting id="preset" name="preset" displayName="Listening Mode" url="http://192.168.1.100:11000/alsa_setting"
         class="list" value="MUSIC" refresh="true" required="true" style="inline">
  <value displayName="Music" name="MUSIC" icon="/images/settings/icon_music-mode.png" iconActive="…"/>
  <value displayName="Movie" name="MOVIE" icon="/images/settings/icon_movies-mode.png" iconActive="…"/>
  <value displayName="TV" name="TV" icon="/images/settings/icon_tv-mode.png" iconActive="…"/>
</setting>
```

| Element / attribute | Meaning |
|---|---|
| `setting` `value` | current listening mode |
| `setting` `url` | endpoint that changes it ([`/alsa_setting`](#get-post-alsa_setting)) |
| `value` `name`, `displayName` | a listening mode |
| `value` `icon`, `iconActive` | icons: PNG, white at 50 % / 70 % opacity, CORS `*` |
| other attributes | as in [`/Settings`](#get-settings) |

**Notes**

- Only players with listening modes have it; their [`/SyncStatus`](#get-syncstatus) carries `audioPresetUrl`.
- Change the mode with `/alsa_setting?preset=<name>`.
- `/Status` does not name the mode, but a change ends its long poll with `syncStat` + 1 as the only change: read `/audioPreset` again when `syncStat` changes.

### `GET /Dataexport`

```
GET http://<player>:80/Dataexport   (also HEAD)
```

No parameters.

**Response format**

Plain text: the system log of the player (`syslogd`, network, services …).

### `GET, POST /delete_index`

```
GET  http://<player>:80/delete_index?noheader=1
POST http://<player>:80/delete_index   (form fields noheader=1 and yes or no)
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `yes`, `no` | button of the confirmation form (POST) |

**Response format**

GET: HTML page "Confirmation" ("Rebuild index and start re-index?") with a form (`action="/delete_index" method="POST"`, buttons `yes` and `no`).

**Notes**

- Linked on the diagnostics page ("Rebuild Index"). The GET only asks; `no` keeps the index.
- `yes` presumably deletes the library index and scans the whole library again.

### `GET /diag`

```
GET http://<player>:80/diag?noheader=1&playnum=1&print=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1` |
| `print` | `1` = the diagnostic report instead of the web app |

**Response format**

HTML page (web app "BluOS"); with `print=1` the diagnostic report as text in `<pre>`.

**Notes**

- Opened through `/redirectToCp?href=/diag&noheader=1`.

### `GET /diagnostics`

```
GET http://<player>:80/diagnostics?noheader=1&playnum=1&slave=<ip>
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1` |
| `slave` | IP address of a group member: its page |

**Response format**

HTML page "Diagnostics": network and player state, statistics switch, links "Rebuild Index", "Force Hotspot Mode", "Reboot".

**Notes**

- The page sends [`/statistics`](#get-statistics) and links to [`/delete_index`](#get-post-delete_index), [`/apmode`](#get-apmode) and `/reboot?noheader=1`.

### `GET /Doorbell`

```
GET /Doorbell?play=1
```

| Parameter | Meaning |
|---|---|
| `play` | always `1` |

**Response format**

```xml
<status enable="1" volume="38" chime="Doorbell:audio/chime_1.mp3"/>
```

| Attribute | Meaning |
|---|---|
| `enable`, `volume`, `chime` | chime on, its volume and sound |

**Notes**

- Depends on the player model.

### `GET /download_playlists_api`

```
GET http://<player>:80/download_playlists_api
```

No parameters.

**Response format**

```json
[
  {
    "name": "My Playlist",
    "ctime": 1794689542,
    "shuffle": true,
    "repeat": 2,
    "files": [
      "f402aa2aa3c531adcf42329b901f0b1e",
      "57865cfd238783825168750831efb847"
    ]
  }
]
```

| Key | Meaning |
|---|---|
| `name` | BluOS playlist |
| `ctime` | creation time (Unix seconds) |
| `shuffle`, `repeat` | saved queue state |
| `files` | track ids (hashes), not paths |

**Notes**

- Setting "Backup playlists" (class `download`) in `/Settings?id=managePlaylists`; one object per BluOS playlist. Restore with [`/upload_playlists_api`](#post-upload_playlists_api).

### `GET /error`

```
GET /error?<counter>&clear=1&counter=<counter>
```

| Parameter | Meaning |
|---|---|
| `<counter>` | number of the error message to read, e.g. `/error?2` |
| `clear`, `counter` | `clear=1&counter=2` clears message 2 |

**Response format**

```xml
<notification>no errors</notification>
```

| Element | Meaning |
|---|---|
| `notification` | error message, or `no errors` |

**Notes**

- Holds the message of a failed command (e.g. `/Back` on a radio station); the counter counts up.

### `GET /GitVersion`

```
GET /GitVersion
```

No parameters.

**Response format**

```xml
<version>4.18.26</version>
```

| Element | Meaning |
|---|---|
| `version` | BluOS version |

### `GET /LastScanCode`

```
GET /LastScanCode
```

No parameters.

**Response format**

```xml
<lastscancode>-1465131975</lastscancode>
```

| Element | Meaning |
|---|---|
| `lastscancode` | last received IR code as a signed 32-bit number; as unsigned hex the `value` of [`/ShowIRCodes`](#get-showircodes) (`-1465131975` = `0xa8abdc39` = `KEY_VOLUMEDOWN`) |

### `GET /Name`

```
GET /Name?set=<name>
```

| Parameter | Meaning |
|---|---|
| `set` | new name of the player ("Room name") |

**Response format**

```xml
<name>Living Room</name>
```

| Element | Meaning |
|---|---|
| `name` | player name (= `name` of [`/SyncStatus`](#get-syncstatus)) |

### `POST /reboot`

```
POST http://<player>:80/reboot   (form field yes=1)
```

| Parameter | Meaning |
|---|---|
| `yes` | any value |

**Response format**

HTML page "Confirmation" ("Settings Updated – Rebooting…").

**Notes**

- Playback stops.
- `/reboot?noheader=1` is the web page with the reboot button.

### `GET /redirectToCp`

```
GET /redirectToCp?href=<encoded path>
```

| Parameter | Meaning |
|---|---|
| `href` | URL-encoded page of the web interface on port 80, e.g. `%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0`, `/diag&noheader=1` |

**Response format**

HTTP redirect to that page (HTML).

**Notes**

- `url` of the [`/Services`](#get-services) root.

### `GET /Reindex`

```
GET /Reindex
```

No parameters.

**Response format**

```xml
<indexing>1</indexing>
```

| Element | Meaning |
|---|---|
| `indexing` | `1` = rescan started |

**Notes**

- "Reindex music collection" in `/Settings`; the rescan runs in the background.
- Progress: `indexing` of [`/Status`](#get-status) counts the files read and is `0` again at the end; then the library `id` changes (see [Library functions](#11-library-functions)).
- With new or changed files the count may stand still for minutes before the end, and library requests may answer late meanwhile.

### `GET /Services`

```
GET /Services?schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `schemaVersion` | schema the client understands, e.g. `35` |

**Response format**

```xml
<services schemaVersion="36" sid="12" url="/redirectToCp?href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0">
  <service name="BluOS" type="BluOSPlaylists" displayname="BluOS" icon="/images/BluOSIcon.png" hasStableBrowse="true">
    <menu>
      <menuEntry displayName="Playlists" inlineRows="5">
        <sort name="sort" default="alpha">
          <value name="recent" displayName="Date added"/>
          <value name="alpha" displayName="A → Z"/>
        </sort>
        <browseRequest url="/Playlists" resultType="Playlist" myPlaylistsFilter="myPlaylists=1"/>
      </menuEntry>
      <menuGroup context="Playlist">
        <menuEntry displayName="Play now">
          <request url="/Add" type="add" subtype="now">
            <requestItemParameter name="playlist"/>
            <requestParameter>playnow=1</requestParameter>
            <requestParameter>clear=0</requestParameter>
          </request>
        </menuEntry>
        <!-- Shuffle, Add next, Add last, Delete … -->
      </menuGroup>
    </menu>
  </service>
  <!-- Capture, Alarms, LocalMusic, <USB id>, TuneIn, RadioParadise, Airable … -->
</services>
```

| Element / attribute | Meaning |
|---|---|
| `services` `sid`, `url` | change id (= `sid` of `/Status`); link to the music services page |
| `service` (`name`, `type`, `displayname`, `icon`) | a source |
| `service` `label`, `removable`, `subtype`, `backgroundImage` | volume label (library, USB); `1` / `usb` = removable drive; background image |
| `menu`, `menuGroup` (`context`, `mainMenu`), `menuEntry` (`displayName`, `defaultView`) | menus of the source; `mainMenu="true"` = top menu, `defaultView="true"` = entry opened first |
| `browseRequest` (`url`, `resultType`, `myPlaylistsFilter`) | list request of a menu entry |
| `request` (`url`, `type`, `subtype`) + `requestParameter`, `requestItemParameter` | action request: fixed parameters and parameters taken from the item |
| `request` `preset_name`, `preset_url`, `preset_image` | for `/SetPreset`: item attributes for name, URL and image |
| `sort` > `value` | sort options |
| `inlineEntry` | list shown inline on the source's start page, e.g. "New" (`/library/v1/Albums?recent=1`) |
| `genreGroup` + `genreItemParameter` | genre menu: genre list and the parameter each genre passes on |
| `contextRequest` | entry that opens another object, e.g. "Go to artist" |
| `artworkRequest` | how to load the cover of an item |
| `enableOnAttribute`, `disableOnAttribute` | show the entry only if the item has (has not) this attribute |
| `confirmAction` + `textItemSubstitution` | ask first; `%s` in `text` is replaced by an item attribute |
| `nofilter` | presumably: no filter field |
| `minimumSchemaVersion`, `maximumSchemaVersion` | the element applies only within this schema range |

**Notes**

- Self-description of every source: which menus exist and which request each menu entry and context menu action sends.
- Best source for the parameters of requests that `/Browse` hands out as ready URLs, e.g. [`/Add`](#get-add), [`/SetPreset`](#get-setpreset), [`/AddToPlaylistOptions`](#get-addtoplaylistoptions).

### `GET /services`

```
GET http://<player>:80/services?noheader=1&schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `schemaVersion` | schema of the client |

**Response format**

HTML page "Configure Music Services" with one link per streaming and radio service.

**Notes**

- Lower case, port 80 only (port 11000: 404); not the same as [`/Services`](#get-services).
- Opened through `/redirectToCp`. Its links lead to `/credentials?service=<service>&noheader=1&schemaVersion=<n>&playnum=1` (sign-in of a service) and `/spotifyinfo?service=Spotify&…`.

### `GET, POST /setting`

```
GET  /setting?<name>=<value>
POST /setting   (JSON body {"<name>":"<value>"})
```

| Parameter | Meaning |
|---|---|
| `<name>` | `name` of a setting whose `url` (or its menu's `url`) in [`/Settings`](#get-settings) is `/setting` |
| `<value>` | new value; booleans `ON` / `OFF` |

**Response format**

Empty answer (HTTP 200).

**Notes**

- GET with name and value as query and POST with a JSON body work alike; numbers without quotes in JSON (`{"capture-input6-latency":80}`).
- Settings (from the `/Settings` tree):

  | Name | Class | Values | Menu |
  |---|---|---|---|
  | `zonename` | text | room / group name | top level |
  | `amplifierStandby` | boolean | `ON` / `OFF` | top level |
  | `resizeall` | boolean | "Optimize Artwork" | `library` |
  | `server` | boolean | USB server mode | `library` |
  | `centre` | boolean | centre channel | `audio` |
  | `ledbrightness` | list | `default`, `dim`, `off` | `player`, group members via `/proxyToSlave` |
  | `zoneap-enable` | boolean | Wi-Fi Direct | `player` |
  | `proximity_enable` | boolean | proximity sensor | `proximity` |
  | `proximity_timeout` | range | 2 … 10 s | `proximity` |
  | `bluos_remote_enable` | boolean | BluOS IR remote | `bluos_remote` |
  | `bluos_remote_channel` | list | IR channel `0` … `7` | `bluos_remote` |
  | `capture-inputN-name` | text | name of input `N` | `capture-inputN` |
  | `capture-inputN-icon` | iconlist | an `/images/capture/ic_….png` path | `capture-inputN` |
  | `capture-inputN-preset` | list | listening mode of the input | `capture-inputN` |
  | `capture-inputN-autosense`, `…-autosenseUngroup` | boolean | switch to the input on signal, ungroup then | `capture-inputN` |
  | `capture-inputN-lowLatency` | boolean | A/V mode | `capture-inputN` |
  | `capture-inputN-latency` | range | lip-sync delay 50 … 150 ms, steps of 10 | `capture-inputN` |
  | `capture-inputN-groupCompress` | boolean | compressed audio to grouped players | `capture-inputN` |
  | `capture-inputN-isMqaSource` | boolean | MQA pass-through (optical inputs) | `capture-inputN` |
  | `capture-inputN-hide` | boolean | hide the source | `capture-inputN` |

- USB server mode `server`: `ON` = the music of the USB drive is indexed into the library (`LocalMusic`), available on the other players and has favourites; `OFF` = the drive is a source of its own (its id) on this player only, without favourites. Takes effect after the drive is plugged in again; `/Settings` shows the new value at once.

### `GET /Settings`

```
GET /Settings?id=<menu id>&schemaVersion=<n>&view=web&expand=1
```

| Parameter | Meaning |
|---|---|
| `id` | menu page (the `id` of a `menuGroup`); without it the top level |
| `schemaVersion` | schema the client understands (the player's own in `/SyncStatus`); lower values hide newer menus |
| `view` | `web`: the page as web view, e.g. `id=sendSupportRequest` (answers an empty page) |
| `expand` | `1` = the whole tree with all menu pages in one answer |

**Response format**

```xml
<settings pageId="audio" schemaVersion="36">
  <menuGroup id="audio" displayName="Audio" icon="/images/settings/ic_audio.png" url="http://192.168.1.100:11000/audiomodes">
    <setting id="eq-treble" name="eq-treble" displayName="Treble" url="http://192.168.1.100:11000/alsa_setting"
             icon="/images/settings/icon_treble.png" class="range" value="0" hideIfDisabled="true">
      <value min="-6" max="6" step="0.5" units="dB"/>
      <dependsOn name="eq-switch" value="ON"/>
    </setting>
    <setting id="replayGainMode" name="replayGainMode" displayName="Replay-gain" url="http://192.168.1.100:11000/audiomodes"
             icon="/images/settings/ic_replaygain.png" class="list" value="album" description="Album gain">
      <value displayName="Disabled" name="none"/>
      <value displayName="Track gain" name="track"/>
      <value displayName="Album gain" name="album"/>
      <value displayName="Smart gain" name="smart"/>
    </setting>
    <!-- more settings -->
  </menuGroup>
</settings>
```

| Element / attribute | Meaning |
|---|---|
| `settings` `pageId`, `schemaVersion` | menu page, schema |
| `menuGroup` (`id`, `displayName`, `icon`, `url`) | menu page; `url` = endpoint for its settings without own `url` |
| `setting` `name`, `displayName`, `value`, `description` | setting, its current value and text |
| `setting` `url` | endpoint that changes it |
| `setting` `class` | control: `text`, `boolean`, `list`, `range`, `dual-range`, `iconlist`, `button`, `download`, `upload`, `alarms`, `sleep` |
| `setting` `hideIfDisabled`, `dependsOn` (`name`, `value`) | shown / active only when another setting has this value |
| `value` (`name`, `displayName`) | list choice |
| `value` (`min`, `max`, `step`, `units`) | range |
| `webview` `url` | the setting opens a web page instead |

**Notes**

- Endpoints in `url`: [`/setting`](#get-post-setting), [`/audiomodes`](#get-post-audiomodes), [`/alsa_setting`](#get-post-alsa_setting), [`/SlaveVolume`](#get-post-slavevolume), [`/proxyToSlave`](#get-post-proxytoslave), [`/Reindex`](#get-reindex), [`/RemoveSlave`](#get-removeslave), and on port 80 [`/sharecfg`](#get-sharecfg), [`/wificfg`](#get-wificfg), [`/triggercfg`](#get-triggercfg), [`/download_playlists_api`](#get-download_playlists_api), [`/upload_playlists_api`](#post-upload_playlists_api).
- Menu pages: top level (alarms, sleep timer, room name, amplifier standby, fixed group, library, playlists), `audio`, `audioPreset`, `zone`, `zone_player-<address and port without dots>` (per group member), `player`, `proximity`, `ir_remote`, `bluos_remote`, `library`, `managePlaylists`, `capture`, `capture-inputN`.

### `GET /settings/sendSupportRequest`

```
GET http://<player>:80/settings/sendSupportRequest?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

HTML page (web app "BluOS", the script loads the content).

**Notes**

- The page sends a request to Bluesound support.

### `GET /sharecfg`

```
GET http://<player>:80/sharecfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

HTML page (web app "BluOS", the script loads the content).

**Notes**

- Network shares of the library; `<webview>` in `/Settings`. The page loads `/settings/library/networkShares?noheader=1` and [`/Shares`](#get-shares).

### `GET /Shares`

```
GET http://<player>:80/Shares
```

No parameters.

**Response format**

```xml
<shares count="1">
  <share>
    <sharename>\\nas\Music</sharename>
    <username>music</username>
  </share>
</shares>
```

| Element / attribute | Meaning |
|---|---|
| `count` | number of shares |
| `sharename`, `username` | share of the library and its user name (no password) |

### `GET /ShowIRCodes`

```
GET /ShowIRCodes
```

No parameters.

**Response format**

```xml
<IRCodes test="test">
  <code>
    <key>KEY_PLAY</key>
    <value>0x8fe633c</value>
  </code>
  <code>
    <key>KEY_VOLUMEDOWN</key>
    <value>0xa8abdc39</value>
  </code>
</IRCodes>
```

| Element | Meaning |
|---|---|
| `code` | one learned button |
| `key` | player function: `KEY_0` … `KEY_9` (presumably presets), `KEY_PLAY`, `KEY_PAUSE`, `KEY_NEXTSONG`, `KEY_PREVIOUSSONG`, `KEY_VOLUMEUP`, `KEY_VOLUMEDOWN`, `KEY_MUTE` |
| `value` | learned IR code (hex) |

**Notes**

- Codes are learned with [`/triggercfg`](#get-triggercfg).

### `GET /Sleep`

```
GET /Sleep
```

No parameters.

**Response format**

```xml
<sleep>30</sleep>
```

| Element | Meaning |
|---|---|
| `sleep` | minutes until the player switches off |

**Notes**

- Each call steps the timer: 15 → 30 → 45 → 60 → 90 min → off. To only read it, use `sleep` of [`/Status`](#get-status).

### `GET /statistics`

```
GET http://<player>:80/statistics?enable=<0|1>
```

| Parameter | Meaning |
|---|---|
| `enable` | `1` = statistics collection on, `0` = off |

**Response format**

Plain text, e.g. `ENABLED`.

**Notes**

- Sent by the diagnostics page; the current value is the selected option of `<select id="statistics">` on [`/diagnostics`](#get-diagnostics). While on, the player may send usage statistics to Bluesound.

### `GET /triggercfg`

```
GET http://<player>:80/triggercfg?noheader=1&playnum=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1` |

**Response format**

HTML page (web app "BluOS", the script loads the content).

**Notes**

- Setting "IR Learning" in `/Settings?id=ir_remote`; the result shows in [`/ShowIRCodes`](#get-showircodes).

### `GET /update`

```
GET /update
```

No known parameters.

**Response format**

Without a pending upgrade:

```xml
<update>no message</update>
```

With a pending upgrade:

```xml
<notification>
  <message>An upgrade (v4.18.26) is available for your players. May take up to 30 minutes. Do not remove power.</message>
  <action type="upgrade">
    <button id="1"><label>I want it now</label><url>/upgrade?upgrade=all</url></button>
    <button id="2"><label>Delay 24 hours</label><url>/upgrade?upgrade=delay</url></button>
  </action>
</notification>
```

| Element | Meaning |
|---|---|
| `update` | `no message` = no upgrade pending |
| `notification` > `message` | text of the upgrade, with the new version |
| `action` `type` | `upgrade` |
| `button` `id`, `label`, `url` | a choice and the request that performs it ([`/upgrade`](#get-upgrade)) |

**Notes**

- The upgrade service of the player sets the notification when it finds an upgrade (on its own, or after [`/upgrade?noheader=1`](#get-upgrade)); [`/upgrade?upgrade=delay`](#get-upgrade) clears it.
- `/ui/Home` shows a pending upgrade as a teaser (image `ic_teaser_upgrade.png`).
- Seen, not verified: `GET /update?<n>` from the BluOS Controller and the players of a group, `GET /update?clear=1` from the upgrade service (clears the notification), `POST /update` from the upgrade service of a group member.

### `GET /UpdateDNS`

```
GET /UpdateDNS
```

No known parameters.

**Response format**

Empty answer.

**Notes**

- The player sends it itself after a start.

### `GET /upgrade`

```
GET /upgrade?noheader=1
GET /upgrade?upgrade=<all|delay>
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = web page "Check For Upgrade": checks for an upgrade |
| `upgrade` | `all` = start the upgrade of every player of the group, `delay` = delay it by 24 hours |

**Response format**

`noheader=1`: HTML page "Check For Upgrade" (e.g. "Update available." and "Please wait…").

`upgrade=all`:

```xml
<upgrade inProgress="true">all</upgrade>
```

| Element | Meaning |
|---|---|
| `upgrade` | the choice; `inProgress` `true` = the upgrade has started |

**Notes**

- Take the `upgrade` URL from the buttons of [`/update`](#get-update); `noheader=1` only checks, an upgrade it finds appears there.
- `upgrade=all`: the player restarts into the upgrade image and answers no requests until the upgrade is complete; the members of a group upgrade one after the other, the group is formed again afterwards.
- The version afterwards: [`/GitVersion`](#get-gitversion); the system log ([`/Dataexport`](#get-dataexport)) has the line `Start upgrade from <old> to <new>`.

### `POST /upload_playlists_api`

```
POST http://<player>:80/upload_playlists_api   (multipart/form-data, field file)
```

| Parameter | Meaning |
|---|---|
| `file` | form field (`filename="blob"`, `application/octet-stream`) with the JSON of [`/download_playlists_api`](#get-download_playlists_api) |

**Response format**

```xml
<message>Successfully restored Playlists</message>
```

| Element | Meaning |
|---|---|
| `message` | result |

**Notes**

- Setting "Restore Playlists" (class `upload`) in `/Settings?id=managePlaylists`; replaces the BluOS playlists.

### `GET /Version`

```
GET /Version
```

No parameters.

**Response format**

```xml
<version>v0.5.51</version>
```

| Element | Meaning |
|---|---|
| `version` | API version |

### `GET /wificfg`

```
GET http://<player>:80/wificfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

HTML page (web app "BluOS", the script loads the content).

**Notes**

- Setting "WiFi" in `/Settings?id=player`.

---

## 14. BluOS Controller UI

Ready-made screens and menus of the BluOS Controller (BluOS 4), whose entries carry the player requests they send.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /ui/action` | change a display option of a screen | | |
| `GET /ui/browseContext` | header of a browse page (e.g. a playlist with play / shuffle buttons) | | ✓ |
| `GET /ui/browseGenres` | genre screen of a source | | ✓ |
| `GET /ui/browseGrouped` | list of a library menu entry with letters / pages | | ✓ |
| `GET /ui/browseMenuGroup` | menu of a source | | ✓ |
| `GET /ui/BrowseObjects` | list of objects of a browse request (e.g. the BluOS playlists) | | ✓ |
| `GET /ui/clearUsageHistory` | clear the "recent" rows of the home screen | | ✓ |
| `GET /ui/Configuration` | entry screens of the BluOS Controller | | ✓ |
| `GET /ui/ContextMenu` | context menu of an object (play, add, edit, delete) | | ✓ |
| `GET /ui/Favourites` | favourites of a source | | ✓ |
| `GET /ui/Home` | home screen | | ✓ |
| `GET /ui/myPlaylistsRow` | row "My playlists" of the home screen per source | | ✓ |
| `GET /ui/News` | news screen | | ✓ |
| `GET /ui/nowPlayingCM` | context menu of the playing item | | ✓ |
| `GET /ui/presets` | preset screen | | ✓ |
| `GET /ui/prf` | run a player request for the BluOS Controller | | ✓ |
| `GET /ui/Queue` | queue screen | | ✓ |
| `GET /ui/queueItemCM` | context menu of a queue entry | | ✓ |
| `GET /ui/RecentlyPlayed` | recently played screen | | ✓ |
| `GET /ui/resolveSoviURL` | resolve a "Sovi" URL (meaning not known) | | ✓ |
| `GET /ui/Search` | search screen | | ✓ |
| `GET /ui/Sources` | list of sources (navigation drawer) | | ✓ |

**Common answer format**

```xml
<screen id="screen-…" screenTitle="…" version="1" refreshOnPlayerChange="true" service="…" navigationTitle="…" navigationIcon="…">
  <refreshOnStatusChange key="prid" value="7"/>       <!-- reload when this /Status value changes (prid, pid, sid) -->
  <menuAction type="…" text="…"><action/></menuAction>
  <sortMenu><item text="…" selected="true"><action/></item></sortMenu>
  <styleSelector text="…" type="grid"><action/></styleSelector>
  <row id="…" title="…" scrollable="true">            <!-- contains item, source, input, service, teaser, button … -->
    …
  </row>
  <list>
    <item title="…" subTitle="…" subSubTitle="…" image="…" quality="…" duration="…" counter="…">
      <action type="player-link" URI="/Play?id=0" resultType="…" title="…" refreshScreen="true" haptic="true"
              notification="…" notificationIcon="…"/>
      <playAction/>
      <contextMenu type="browse" URI="/ui/ContextMenu?…" resultType="contextMenu"/>
      <nowPlayingMatch key="song" value="0"/>
    </item>
  </list>
</screen>
```

| Element / attribute | Meaning |
|---|---|
| `action` `type` | `player-link` (send the player request in `URI`), `browse` (load another `/ui` screen or a context menu), `context-browse`, `webpage` (open a web page, e.g. `/redirectToCp?…`), `setting` (open `/Settings?id=…`), `confirmation` (ask first, then send `URI`), `deep-link` (navigation inside the BluOS Controller, e.g. `/settings`, `/add-preset`, `/edit-queue`, `/reorder-presets`, `/customise-screen` – not player endpoints), `reorder`, `add` |
| `row` `noReorder="true"` | the row cannot be moved in "Customise Home" |
| `teaser` `closable="true"` | the teaser card can be closed |
| `customiseScreen` `text` | entry "Customise Home" (deep link `/customise-screen`) |
| `largeThumbnail`, `smallThumbnail` (`image`, `title`, `icon`) | large and small tiles in the rows of `/ui/Home` and `/ui/Favourites` |
| `footer` (`text`, `type="reorder"`) | button below the list, e.g. "Reorder Presets" |
| `service` `isLink="true"` | entry of `/ui/Sources` that opens the source |

### `GET /ui/action`

```
GET /ui/action?Cstyle=<style>~<type>&CBQ=<true|false>&Cfilter=<url>~<value>
```

| Parameter | Meaning |
|---|---|
| `Cstyle` | display style per object type, e.g. `grid~Playlist` |
| `CBQ` | `true` / `false`: an option of the playlist screen (meaning not known) |
| `Cfilter` | filter of a list, e.g. `https://…/radio/podcasts/charts~it` (podcasts of Italy) |

**Response format**

Empty answer.

**Notes**

- Style selector of [`/ui/BrowseObjects`](#get-uibrowseobjects); the effect is not known.

### `GET /ui/browseContext`

```
GET /ui/browseContext?service=<svc>&type=<type>&title=<title>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist`, `Artist` |
| `title` | title of the page |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&playlist=My+Playlist&playlistid=` |

**Response format**

```xml
<screen version="1" id="screen-BluOS-Playlist" service="BluOS" navigationIcon="/images/BluOSIcon.png?style=Default" navigationTitle="BluOS">
  <contextMenu type="browse" URI="/ui/ContextMenu?context=Playlist&amp;playlist=My+Playlist&amp;service=BluOS&amp;sourceContext=Playlist&amp;title=My+Playlist" resultType="contextMenu"/>
  <header image="/Artwork?service=LocalMusic&amp;fn=…" title="My Playlist">
    <button text="Play all" backgroundColor="#43a4ce" textColor="#ffffff" icon="/images/ui/btn_play.png">
      <action type="player-link" URI="/Load?service=BluOS&amp;name=My+Playlist&amp;shuffle=0" haptic="true"/>
    </button>
    <button text="Shuffle">
      <action type="player-link" URI="/Add?playlist=My+Playlist&amp;playnow=1&amp;service=BluOS&amp;shuffle=1" haptic="true"/>
    </button>
  </header>
  <list>
    <item image="/Artwork?service=LocalMusic&amp;artist=Tanita+Tikaram&amp;album=Ancient+Heart" title="Good Tradition"
          subTitle="Tanita Tikaram" quality="cd" duration="2:53">
      <action type="player-link" URI="/Add?playnow=1&amp;file=…" haptic="true"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?album=Ancient+Heart&amp;artist=Tanita+Tikaram&amp;context=Song&amp;filename=…" resultType="contextMenu"/>
      <nowPlayingMatch key="fn" value="/var/mnt/nas-Music/…/01-Good Tradition.flac"/>
    </item>
    <!-- 10 per page -->
    <nextLink>/ui/BrowseObjects?browseIndex=0&amp;listContinuation=10&amp;menuGroupId=BluOS-Playlist&amp;playlist=My+Playlist&amp;service=BluOS&amp;type=Song&amp;url=…</nextLink>
  </list>
</screen>
```

| Element | Meaning |
|---|---|
| `header` (`image`, `title`) > `button` | page header with the play requests of the object |
| `list` > `item` | tracks with play request, context menu and `nowPlayingMatch` |
| `nextLink` | next page through `/ui/BrowseObjects` |

**Notes**

- An unknown playlist answers `<error service="BluOS"><message>not found</message></error>`.

### `GET /ui/browseGenres`

```
GET /ui/browseGenres?service=<svc>&genreGroupId=Genres&title=<title>&url=<encoded request>&genre=<genre>&withGenre=1
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic` |
| `genreGroupId` | e.g. `Genres` |
| `title` | screen title |
| `url` | list of genres, e.g. `/library/v1/Genres?service=LocalMusic` |
| `genre`, `withGenre` | screen of one genre (`withGenre=1`) |

**Response format**

```xml
<screen version="1" screenTitle="Genres" id="screen-LocalMusic-Genres" service="LocalMusic" navigationTitle="Library">
  <list>
    <item title="Alternative Rock">
      <action type="browse" URI="/ui/browseGenres?genre=Alternative+Rock&amp;genreGroupId=Genres&amp;service=LocalMusic&amp;title=Alternative+Rock&amp;withGenre=1" resultType="screen" title="Alternative Rock" service="LocalMusic"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?context=Genre&amp;genre=Alternative+Rock&amp;service=LocalMusic&amp;title=Alternative+Rock" resultType="contextMenu"/>
    </item>
    <!-- one <item> per genre -->
  </list>
</screen>
```

| Element | Meaning |
|---|---|
| `item` | a genre with the request of its screen and its context menu |

### `GET /ui/browseGrouped`

```
GET /ui/browseGrouped?service=<svc>&menuGroupId=<id>&browseIndex=<n>&title=<title>&type=<type>&url=<encoded request>&listContinuation=<offset>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `menuGroupId` | menu group, e.g. `LocalMusic`, `Genres` |
| `browseIndex` | index of the menu entry |
| `title` | screen title |
| `type` | `Artist`, `Album`, `Song`, `Composer` |
| `url` | URL-encoded list request, e.g. `/library/v1/Artists?service=LocalMusic`, `/library/v1/Albums?genre=…&service=LocalMusic`, `/library/v1/Albums?service=<svc>&sort=decade` |
| `listContinuation` | offset of the page |

**Response format**

```xml
<screen version="1" screenTitle="Artists" id="screen-LocalMusic-0" service="LocalMusic" navigationTitle="Library">
  <list offset="0" total="628">
    <index revision="196633">
      <item key="A" offset="0" length="43"/>
      <item key="B" offset="43" length="43"/>
      <!-- one <item> per letter or decade -->
    </index>
    <item title="AC-DC">
      <action type="context-browse" URI="/Artists?service=LocalMusic&amp;artist=AC-DC" resultType="Artist" title="AC-DC"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?artist=AC-DC&amp;context=Artist&amp;service=LocalMusic&amp;title=AC-DC" resultType="contextMenu"/>
    </item>
    <!-- 30 entries per page -->
  </list>
</screen>
```

| Element / attribute | Meaning |
|---|---|
| `list` `offset`, `total` | first entry of the page, number of entries |
| `index` > `item` (`key`, `offset`, `length`) | letter or decade with its offset and count |
| `item` (`title`, `subTitle`, `subSubTitle`, `image`) | entry; albums: title, artist, "12 Tracks", cover |
| `action`, `playAction`, `contextMenu` | open, play (`/Add?playnow=1&…`), context menu |
| `nextLink` | next page (`…&listContinuation=30…`) |
| `sortMenu` | "A → Z", "Recent", "Year", "Decade", "Artist", "Artist, release-date" (`selected="true"` on the current one) |

**Notes**

- Pages of 30 (`limit`, `count`, `pageSize` are ignored); `listContinuation` jumps to any offset, e.g. the first album of a decade.
- `sort` must be inside `url`; as an own parameter it is ignored. With `sort=decade` the index has one entry per decade (A–Z within a decade); albums without a year tag are not in the list.
- Album entries have no year, no favourite state and no add-to-queue URL.

### `GET /ui/browseMenuGroup`

```
GET /ui/browseMenuGroup?service=<svc>&menuGroupId=<id>&title=<title>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, `TuneIn`, `RadioParadise`, `Airable` |
| `menuGroupId` | sub menu, e.g. `LocalMusic-Favourites` |
| `title` | screen title |

**Response format**

```xml
<screen version="1" id="screen-LocalMusic" service="LocalMusic" navigationIcon="/images/LibraryIcon.png?style=Default" navigationTitle="Library">
  <row id="LocalMusic-0" title="Artists" solidBackground="false">
    <action type="browse" URI="/ui/browseGrouped?browseIndex=0&amp;menuGroupId=LocalMusic&amp;service=LocalMusic&amp;title=Artists&amp;type=Artist&amp;url=%2Flibrary%2Fv1%2FArtists%3Fservice%3DLocalMusic" resultType="screen" title="Artists"/>
  </row>
  <!-- Albums, Songs, Genres, Playlists, Composers, Folders, Favourites, New … -->
</screen>
```

| Element | Meaning |
|---|---|
| `row` (`id`, `title`) > `action` | menu entry of the source with the request of its screen |

**Notes**

- First screen of a source.

### `GET /ui/BrowseObjects`

```
GET /ui/BrowseObjects?service=<svc>&menuGroupId=<id>&type=<type>&browseIndex=<n>&category=<category>&title=<title>&listContinuation=<n>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `menuGroupId` | menu group of `/Services`, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist` |
| `browseIndex` | index of the menu entry |
| `category`, `title`, `listContinuation` | sub category (radio), screen title, next page (`1` or the offset) |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&myPlaylists=1`, `/Albums?recent=1`, `/RadioBrowse?…` |

**Response format**

```xml
<screen version="1" screenTitle="Playlists" id="screen-BluOS-0" service="BluOS" navigationIcon="/images/BluOSIcon.png?style=Default" navigationTitle="BluOS">
  <sortMenu text="Sort" menuTitle="Sort" replaceScreen="true">
    <item text="Date added">
      <action type="browse" URI="/ui/BrowseObjects?…&amp;url=%2FPlaylists%3FmyPlaylists%3D1%26service%3DBluOS%26sort%3Drecent" resultType="screen" title="Playlists"/>
    </item>
    <item text="A → Z" selected="true">
      <action type="browse" URI="/ui/BrowseObjects?…&amp;sort%3Dalpha" resultType="screen" title="Playlists"/>
    </item>
  </sortMenu>
  <styleSelector text="Display: Grid" type="grid">
    <action type="player-link" URI="/ui/action?Cstyle=grid~Playlist" refreshScreen="true"/>
  </styleSelector>
  <list>
    <item image="/Artwork?service=LocalMusic&amp;fn=…" title="My Playlist">
      <action type="context-browse" URI="/Playlists?service=BluOS&amp;playlist=My+Playlist&amp;playlistid=" resultType="Playlist" title="My Playlist"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?context=Playlist&amp;playlist=My+Playlist&amp;service=BluOS&amp;title=My+Playlist" resultType="contextMenu"/>
    </item>
  </list>
</screen>
```

| Element | Meaning |
|---|---|
| `sortMenu` > `item` | sort options with their requests |
| `styleSelector` | grid / list display ([`/ui/action`](#get-uiaction)) |
| `list` > `item` | objects with open request and context menu |

### `GET /ui/clearUsageHistory`

```
GET /ui/clearUsageHistory?stations=1&queued=1
```

| Parameter | Meaning |
|---|---|
| `stations` | `1` = recent stations (row on the home screen) |
| `queued` | `1` = recently played ("Clear" in `/ui/RecentlyPlayed`) |

**Response format**

Empty answer.

**Notes**

- Deletes the history.

### `GET /ui/Configuration`

```
GET /ui/Configuration
```

No parameters.

**Response format**

```xml
<configuration>
  <item id="home" URI="/ui/Home"/>
  <item id="recentlyPlayed" URI="/ui/RecentlyPlayed"/>
  <item id="news" URI="/ui/News"/>
  <item id="favourites" URI="/ui/Favourites"/>
  <item id="sources" URI="/ui/Sources"/>
  <item id="search" URI="/ui/Search"/>
  <item id="nowPlayingContextMenu" URI="/ui/nowPlayingCM" resultType="contextMenu"/>
  <item id="queueItemContextMenu" URI="/ui/queueItemCM" resultType="contextMenu"/>
  <item id="resolveSoviURL" URI="/ui/resolveSoviURL"/>
  <item id="queue" URI="/ui/Queue" resultType="queue"/>
  <item id="presets" URI="/ui/presets" listeningModesURL="/audioPreset"/>
</configuration>
```

| Attribute | Meaning |
|---|---|
| `item` `id`, `URI`, `resultType` | entry screen and its request |
| `listeningModesURL` | listening modes of the preset screen ([`/audioPreset`](#get-audiopreset)) |

**Notes**

- Asked first when the BluOS Controller connects.

### `GET /ui/ContextMenu`

```
GET /ui/ContextMenu?context=<context>&sourceContext=<context>&service=<svc>&type=<type>&id=<id>&name=<name>&title=<title>&playlist=<name>&album=<album>&artist=<artist>&genre=<genre>&filename=<file>&path=<path>&isFavourite=1&url=<url>&image=<image>&volume=<0–100>&noFavCMItems=1&URL=<url>&text=<name>&preset_id=<id>&is_preset=1&preset_url=<url>&inputType=<type>&hasInfo=1
```

| Parameter | Meaning |
|---|---|
| `context`, `sourceContext` | object type: `Playlist`, `Album`, `Artist`, `Genre` (with `genre`), `Song` (with `filename`), `Folder` (with `path`), `Item` (radio) |
| `type` | e.g. `preset` |
| `service` | source of the object |
| `id`, `name`, `title`, `playlist`, `album`, `artist`, `isFavourite`, `url`, `image`, `volume` | the object's own attributes, e.g. of a preset, a playlist or an album |
| `noFavCMItems` | `1` = without favourite entries |
| `URL`, `text` | radio item: station or stream (e.g. `TuneIn:s115194`), name |
| `preset_id`, `is_preset` | radio favourite: `preset_id` alone → "Favourite", with `is_preset=1` → "Remove favourite" |
| `preset_url` | play URL of a radio item for presets |
| `inputType` | `station`: with `preset_id` → "Related stations"; with `URL` and `text` → "Add preset" |
| `hasInfo` | `1` → "Info" (`/Info?service=…&url=…`) |

**Response format**

```xml
<contextMenu title="My Playlist" version="1">
  <item icon="/images/ui/cm_add_now.png" text="Play now">
    <action type="player-link" URI="/Add?clear=0&amp;playlist=My+Playlist&amp;playnow=1&amp;service=BluOS&amp;shuffle=0" haptic="true"/>
  </item>
  <item icon="/images/ui/cm_add_next.png" text="Add next">
    <action type="player-link" URI="/Add?playlist=My+Playlist&amp;playnow=-1&amp;service=BluOS&amp;where=next" haptic="true"
            notification="Added next to queue" notificationIcon="/images/ui/ic_notification_pq_next.png"/>
  </item>
  <item icon="/images/ui/cm_delete.png" text="Delete">
    <action type="confirmation" URI="/Delete?name=My+Playlist&amp;service=BluOS" title="Delete playlist: My Playlist?"
            refreshScreen="true" haptic="true" notification="Deleted &#34;My Playlist&#34;"/>
  </item>
  <!-- Shuffle, Add last … -->
</contextMenu>
```

| Element | Meaning |
|---|---|
| `contextMenu` `title` | object name |
| `item` (`icon`, `text`) > `action` | menu entry with its request |

**Notes**

- The menu is built from the parameters alone; the object is not checked. Without `context` or `service` the menu is empty.

### `GET /ui/Favourites`

```
GET /ui/Favourites?service=<svc>&singleService=1&title=<title>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, `TuneIn` |
| `singleService` | `1` = only this source |
| `title` | screen title |

**Response format**

```xml
<screen version="1" screenTitle="My Favourites" id="screen-LocalMusic-Favourites" service="LocalMusic" navigationTitle="Library">
  <row id="LocalMusic-Favourites-0" title="Artists" solidBackground="true">
    <action type="browse" URI="/ui/BrowseObjects?browseIndex=0&amp;menuGroupId=LocalMusic-Favourites&amp;service=LocalMusic&amp;title=Artists&amp;type=Artist&amp;url=%2Flibrary%2Fv1%2FArtists%3Fcategory%3DFAVOURITES%26service%3DLocalMusic" resultType="screen" title="Artists"/>
    <list>
      <item title="AC-DC">
        <action type="context-browse" URI="/Artists?service=LocalMusic&amp;artist=AC-DC" resultType="Artist" title="AC-DC"/>
        <contextMenu type="browse" URI="/ui/ContextMenu?artist=AC-DC&amp;context=Artist&amp;isFavourite=1&amp;service=LocalMusic&amp;title=AC-DC" resultType="contextMenu"/>
      </item>
    </list>
  </row>
  <!-- Albums, Songs … -->
</screen>
```

| Element | Meaning |
|---|---|
| `row` | one type of favourites (Artists, Albums, …) with the request of its full list |
| `list` > `item` | a favourite with open request and context menu |

### `GET /ui/Home`

```
GET /ui/Home
```

No parameters.

**Response format**

```xml
<screen version="1" screenTitle="Home" id="screen-home" refreshOnPlayerChange="true">
  <refreshOnStatusChange key="prid" value="7"/>
  <menuAction type="settings">
    <action type="deep-link" URI="/settings"/>
  </menuAction>
  <row id="mostUsed" title="Most Used" scrollable="true" solidBackground="false">
    <source icon="/images/capture/ic_tv.png" title="HDMI ARC" accessibleTitle="HDMI ARC">
      <button text="Play" backgroundColor="#43a4ce" textColor="#ffffff">
        <action type="player-link" URI="/Play?url=Capture%3Ahw%3Aimxspdif%2C0%2F1%2F25%2F2%3Fid%3Dinput4" haptic="true"/>
      </button>
    </source>
  </row>
  <row id="presets" title="Presets" solidBackground="true"> … </row>
  <!-- teaser, recent-stations, recent, BluOS-myPlaylists -->
</screen>
```

| Element | Meaning |
|---|---|
| `row` (`id`) | teasers, most used sources, presets, recent stations, recently played, BluOS playlists |
| `source`, `item`, `button` > `action` | entry with its play request (`/Play?url=…`, `/Preset?id=…`, `/Load?…`) |

### `GET /ui/myPlaylistsRow`

```
GET /ui/myPlaylistsRow?service=<svc>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |

**Response format**

Empty when the source has no playlists; otherwise presumably a `<row>` like the playlist rows of [`/ui/Home`](#get-uihome).

### `GET /ui/News`

```
GET /ui/News
```

No known parameters.

**Response format**

```xml
<screen version="1" screenTitle="News &amp; Updates" id="screen-news" refreshOnPlayerChange="true">
  <list id="news"></list>
</screen>
```

| Element | Meaning |
|---|---|
| `list` | news entries |

### `GET /ui/nowPlayingCM`

```
GET /ui/nowPlayingCM
```

No parameters.

**Response format**

```xml
<contextMenu image="/Artwork?service=LocalMusic&amp;fn=…" subTitle="Mike Oldfield • Tubular Bells" title="Part One" version="1">
  <item icon="/images/ui/cm_favourite_add.png" text="Favourite">
    <action type="player-link" URI="/ui/prf?cgsc=1&amp;u=%2FAddFavourite%3Ffn%3D…" refreshScreen="true" haptic="true" notification="Added to favourites"/>
  </item>
  <item icon="/images/ui/cm_addtoplaylist.png" text="Add to playlist…">
    <action type="browse" URI="/AddToPlaylistOptions?service=LocalMusic&amp;songid=…" resultType="AddToPlaylistOptions" title="Add to playlist…"/>
  </item>
  <!-- Go to album, Go to artist, Info, Technical info -->
</contextMenu>
```

| Element | Meaning |
|---|---|
| `contextMenu` (`title`, `subTitle`, `image`) | the playing item |
| `item` > `action` | menu entry with its request |

### `GET /ui/presets`

```
GET /ui/presets
```

No parameters.

**Response format**

```xml
<screen version="1" screenTitle="Presets" id="screen-presets" refreshOnPlayerChange="true">
  <refreshOnStatusChange key="prid" value="2"/>
  <menuAction type="add">
    <action type="deep-link" URI="/add-preset" refreshScreen="true"/>
  </menuAction>
  <list>
    <item image="https://img.radioparadise.com/channels/0/1/cover_512x512/0.jpg" title="Mellow Mix" counter="1" solidBackground="true">
      <action type="player-link" URI="/Preset?id=1" haptic="true"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?id=1&amp;image=…&amp;name=Mellow+Mix&amp;type=preset&amp;url=…&amp;volume=16" resultType="contextMenu" title="Mellow Mix"/>
    </item>
  </list>
</screen>
```

| Element | Meaning |
|---|---|
| `list` > `item` (`counter`) | preset with its number, play request and context menu |
| `footer` | "Reorder Presets" (deep link with [`/Presets/edit`](#post-presetsedit)) |

### `GET /ui/prf`

```
GET /ui/prf?u=<encoded request>&a=<encoded parameters>&t=1&cgsc=1
```

| Parameter | Meaning |
|---|---|
| `u` | URL-encoded player request, e.g. `/Add?playlist=…&playnow=1&service=BluOS&shuffle=1` |
| `a` | extra parameters for the rest of a list, e.g. `cursor=last&expr=maria&listindex=0&nextlist=1&playnow=1&service=LocalMusic&where=last` |
| `t`, `cgsc` | seen as `1`; meaning not known |

**Response format**

The answer of the passed request, e.g. `<volume …>16</volume>` for `u=%2FVolume`.

### `GET /ui/Queue`

```
GET /ui/Queue?offset=<n>
```

| Parameter | Meaning |
|---|---|
| `offset` | first entry |

**Response format**

```xml
<queue offset="0" total="20" id="615" modified="false" name="My Playlist">
  <refreshOnStatusChange key="pid" value="615"/>
  <button text="Save" backgroundColor="#2A2A2A" textColor="#ffffff" icon="/images/ui/btn_save_queue.png">
    <action type="browse" URI="/AddToPlaylistOptions?saveQueue=1" resultType="SaveQueueOptions" title="Save playlist"/>
  </button>
  <button text="Clear">
    <action type="player-link" URI="/Clear" refreshScreen="true" haptic="true" notification="Play Queue cleared"/>
  </button>
  <item image="/Artwork?service=LocalMusic&amp;artist=Dire+Straits&amp;album=Brothers+In+Arms" title="The Man&#39;s Too Strong"
        subTitle="Dire Straits" subSubTitle="Brothers In Arms" quality="cd" duration="4:40">
    <action type="player-link" URI="/Play?id=0" haptic="true"/>
    <contextMenu type="browse" URI="/ui/queueItemCM?id=0" resultType="contextMenu"/>
    <nowPlayingMatch key="song" value="0"/>
  </item>
  <!-- one <item> per entry; button "Edit" as deep-link /edit-queue -->
</queue>
```

| Element / attribute | Meaning |
|---|---|
| `queue` `offset`, `total`, `id`, `modified`, `name` | page, number of entries, queue id, playlist name |
| `button` | Save, Clear, Edit with their requests |
| `item` | queue entry with play request (`/Play?id=…`) and context menu |

### `GET /ui/queueItemCM`

```
GET /ui/queueItemCM?id=<n>
```

| Parameter | Meaning |
|---|---|
| `id` | queue position |

**Response format**

```xml
<contextMenu image="/Artwork?…" subTitle="Dire Straits • Brothers In Arms" title="The Man&#39;s Too Strong" version="1">
  <item icon="/images/ui/cm_favourite_add.png" text="Favourite">
    <action type="player-link" URI="/ui/prf?cgsc=1&amp;u=%2FAddFavourite%3Ffn%3D…" refreshScreen="true" haptic="true"/>
  </item>
  <item icon="/images/ui/cm_addtoplaylist.png" text="Add to playlist…">
    <action type="browse" URI="/AddToPlaylistOptions?service=LocalMusic&amp;songid=…" resultType="AddToPlaylistOptions"/>
  </item>
  <!-- more entries -->
</contextMenu>
```

| Element | Meaning |
|---|---|
| `item` > `action` | menu entry with its request |

### `GET /ui/RecentlyPlayed`

```
GET /ui/RecentlyPlayed
```

No parameters.

**Response format**

```xml
<screen version="1" screenTitle="Recently Played" id="screen-recentlyPlayed" refreshOnPlayerChange="true">
  <menuAction text="Clear">
    <action type="player-link" URI="/ui/clearUsageHistory?queued=1" refreshScreen="true" closeScreen="true" haptic="true"/>
  </menuAction>
  <list id="recent">
    <item image="/Artwork?…" objectType="playlist" icon="/images/BluOSIcon.png?style=Default" title="My Playlist">
      <action type="context-browse" URI="/Playlists?service=BluOS&amp;playlist=My+Playlist&amp;playlistid=" resultType="Playlist" title="My Playlist"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?context=Playlist&amp;playlist=My+Playlist&amp;service=BluOS&amp;title=My+Playlist&amp;noFavCMItems=1" resultType="contextMenu"/>
    </item>
    <!-- playlists, albums, stations … -->
  </list>
</screen>
```

| Element / attribute | Meaning |
|---|---|
| `item` `objectType` | `playlist`, album, station … |
| `menuAction` "Clear" | [`/ui/clearUsageHistory?queued=1`](#get-uiclearusagehistory) |

### `GET /ui/resolveSoviURL`

```
GET /ui/resolveSoviURL
```

Parameter for the URL not known.

**Response format**

Without a URL the text `invalid URL scheme: ` (no XML).

**Notes**

- Expects a URL with a special scheme.

### `GET /ui/Search`

```
GET /ui/Search?q=<text>&forService=<svc>&service=<svc>&CsearchService=<svc>
```

| Parameter | Meaning |
|---|---|
| `q` | search text |
| `forService` | search in one source, e.g. `LocalMusic`, `TuneIn` |
| `service` | the same, used by the source selector |
| `CsearchService` | choose the source of the search screen, e.g. `Airable` |

**Response format**

```xml
<screen version="1" screenTitle="Search" id="screen-LocalMusic-Search" service="LocalMusic">
  <selectorMenu replaceScreen="true">
    <item icon="/images/LibraryIcon.png?style=Default" text="Library" selected="true">
      <action type="browse" URI="/ui/Search?service=LocalMusic&amp;q=a" resultType="screen" title="Search"/>
    </item>
    <!-- Radio, TuneIn, USB -->
  </selectorMenu>
  <search value="a" prompt="Search..." parameterName="q" type="browse" URI="/ui/Search?forService=LocalMusic" resultType="screen" title="Search" service="LocalMusic"/>
  <list title="Artists">
    <item title="The 5th Dimension"> … </item>
    <!-- "View All" -->
  </list>
  <!-- Albums, Songs, Composers -->
</screen>
```

| Element | Meaning |
|---|---|
| `selectorMenu` | source selector |
| `search` | search field with its request |
| `list` (`title`) | results per type with "View All" |

**Notes**

- Results open with [`/ui/browseContext`](#get-uibrowsecontext) (e.g. `type=Artist&url=/Artists?…`).

### `GET /ui/Sources`

```
GET /ui/Sources
```

No parameters.

**Response format**

```xml
<screen version="1" screenTitle="Music Sources" id="screen-sources" refreshOnPlayerChange="true">
  <refreshOnStatusChange key="sid" value="19"/>
  <menuAction type="add">
    <action type="webpage" URI="/redirectToCp?href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D36" title="Music Services" refreshScreen="true"/>
  </menuAction>
  <row id="inputs" title="Inputs" scrollable="true" solidBackground="false">
    <menuAction text="Customise">
      <action type="setting" URI="/Settings?id=capture" title="Inputs" refreshScreen="true"/>
    </menuAction>
    <input title="Bluetooth" icon="/images/BluetoothIcon.png">
      <action type="player-link" URI="/Play?url=Capture%3Abluez%3Abluetooth&amp;title=Bluetooth&amp;image=%2Fimages%2FBluetoothIcon.png" haptic="true"/>
      <nowPlayingMatch key="inputId" value="bluetooth"/>
    </input>
  </row>
  <!-- rows with the music sources (library, USB, radio services) -->
</screen>
```

| Element | Meaning |
|---|---|
| `row` "Inputs" > `input` | inputs with their play requests |
| `row` > `service` | music sources with their browse screens |

---

## 15. MCP server

Model Context Protocol server of the player: AI assistants read the player state and control playback, queue, presets and search through tools.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET, POST /mcp` | MCP server (JSON-RPC 2.0, tools only) | | ✓ |

### `GET, POST /mcp`

```
POST /mcp   (Content-Type: application/json, Accept: application/json, text/event-stream; body: JSON-RPC 2.0 message)
GET  /mcp   (event stream from the server)
```

| Method | Meaning |
|---|---|
| `initialize` | start; agree on protocol version and capabilities |
| `notifications/initialized` | the client confirms the start (HTTP 202, no body) |
| `tools/list` | list of the tools with description, input schema and annotations |
| `tools/call` | run a tool (`params`: `name`, `arguments`) |
| `resources/list`, `prompts/list` | not supported: error `-32601` |

**Response format**

`initialize`:

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"bluos","version":"v0.5.43"}}}
```

`tools/call` of `search_music` with `service=LocalMusic`, `type=albums` (the tool result is JSON text in `result.content[0].text`):

```json
{
  "type": "albums",
  "results": [
    {
      "title": "Brandenburg Concertos",
      "subtitle": "Johann Sebastian Bach",
      "tracks": 19,
      "image": "/Artwork?service=LocalMusic&album=Brandenburg+Concertos&artist=Johann+Sebastian+Bach",
      "play_url": "/Add?playnow=1&service=LocalMusic&album=Brandenburg+Concertos&artist=Johann+Sebastian+Bach",
      "context_menu_key": "LocalMusic:CM/LocalMusic-Album?album=Brandenburg+Concertos&artist=Johann+Sebastian+Bach"
    }
  ],
  "next_key": "LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fend=101&expr=a&service=LocalMusic&start=51"
}
```

| Key / tool | Meaning |
|---|---|
| `serverInfo.version` | API version (= [`/Version`](#get-version)) |
| `result.isError` | `true` = tool error with a text (e.g. "LocalMusic has no playlists search") |
| `get_status` | what is playing (`title1` … `title3`), playback state, volume |
| `player_info` | name, brand, model, MAC address, grouping |
| `get_queue` (`offset`, `limit` 1–200) | page of the queue; `total`, 0-based `index` per song |
| `transport` (`action`: `play`, `pause`, `skip`, `back`) | playback control |
| `set_volume` (`level` 0–100) | set the volume |
| `get_music_services` | music sources including library (`LocalMusic`) and USB drive, e.g. `[{"name":"Library","service":"LocalMusic"},…]` |
| `search_music` (`query`, `service`, `type`: `albums`, `songs`, `artists`, `playlists`, `next_key`) | one page of search results with `title`, `subtitle`, `image`, `play_url`, `context_menu_key`; albums also `tracks` |
| `play_music` (`play_url`, `add_to_queue`, `context_menu_key`) | play a result (replaces the queue) or append it (`add_to_queue=true`, needs `context_menu_key`) |
| `queue_manage` (`action`: `remove` + `index`, `reorder` + `from_index`, `to_index`, `clear`, `save` + `name`) | change the queue or save it as a playlist |
| `local_playlists` (`action`: `list`, `play` + `playlist_id`, `save_as_preset` + `playlist_id`, `preset_id`, `name`) | BluOS playlists |
| `browse_presets` (`url`, `service`) | sources that can be saved as presets |
| `presets` (`action`: `list`, `play`, `save`, `delete`; `id`, `name`, `url`, `image`) | presets; `save` without `url` saves what is playing |

**Notes**

- Transport "Streamable HTTP" (MCP 2025-06-18); no authentication, no session (`Mcp-Session-Id`). CORS: `Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`.
- `search_music` on the library wraps [`/library/v1/Albums`](#get-libraryv1albums) / [`/library/v1/Songs`](#get-libraryv1songs) with `expr`, sorted by title; `artists` gives only `title` and `context_menu_key`; `playlists` is not supported for the library.
- **Paging skips one result per page:** a page has 50 results, but `next_key` continues at `start=51` (then 102 …).
- Every tool is annotated `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: true`, also the reading ones.
- For the local library only the search: no browsing, no filters (genre, quality, decade, favourites), no track list of an album, no covers (only the `/Artwork` path).
- `/mcp/`, `/sse` and `/.well-known/mcp.json` answer 404; on port 80 `/mcp` is not the MCP server.
