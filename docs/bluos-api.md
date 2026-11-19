# BluOS API reference

All BluOS HTTP endpoints known to this project, grouped by category, with their parameters, function and answer structure: the official *BluOS Custom Integration API* and unofficial endpoints (seen in the player's own answers, in community projects, or explored against a real player).

Official documentation: [BluOS Custom Integration API v1.7](https://bluos.io/wp-content/uploads/2025/06/BluOS-Custom-Integration-API_v1.7.pdf) (Lenbrook, 2025-04-09; linked on [bluos.io/downloads](https://bluos.io/downloads/)); the column "Official" in each category overview marks the endpoints documented there.

**Verified** (column "Verified" in each category overview, and in the notes) means checked on a **Bluesound Powernode N331** with **BluOS 4.18.18** (API v0.5.43). Other players and BluOS versions may differ.

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
13. [BluOS Controller UI](#13-bluos-controller-ui)

---

## 1. Basics

- **Requests:** `http://192.168.1.100:11000/Volume?level=20` – player address, port, request, parameters – with the HTTP method given at each endpoint; parameters are URL-encoded name/value pairs (UTF-8). Answers are UTF-8 XML unless the endpoint says otherwise.
- **Port:** 11000, the control API of every player. Endpoints on another port show it in their request line.
- **Errors:** endpoints answer with HTTP errors or with an `<error>` root element instead of the expected one; clients should check the root element name.
- **Unknown elements:** answers may contain more elements and attributes than shown here; clients should ignore the ones they do not know.
- **Relative URIs** in answers (`playURL`, `actionURL`, `image`, …) have an absolute path and are resolved against the player address (RFC 3986). Invoke them as they are; do not parse or build them.
- **Polling rules:**
  - Without long polling: at most one request every 30 s.
  - Long polling (`timeout` + `etag` from the previous answer's root): never two requests for the same resource less than 1 s apart, even when the first returned sooner.
- **Language:** answers follow the `Accept-Language` header of the request (e.g. `serviceName="Bibliothek"` for German). Browsers send the system language with every request; ask with `Accept-Language: en` to get the answers documented here (see `/Browse` for an album track list that stays empty otherwise).
- **Grouped players:** many requests sent to a secondary player are proxied to the primary (status, playback, queue, browse).
- **Response examples** are shortened answers of the test player and well-formed XML; `<!-- … -->` and `…` in text or attribute values mark left-out parts. Personal data is replaced by example values (addresses `192.168.1.x`, share `//nas/Music`, names like "Living Room" or "My Playlist"). In request lines `<…>` stands for a value to fill in.

---

## 2. Status

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
| `timeout` | Long polling: seconds the player may hold the request. Recommended 100. |
| `etag` | `etag` attribute of the previous answer's root. The answer returns early only if the state changed. |

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
| `title1`, `title2`, `title3` | three lines of now-playing text (MUST be used for 3-line UIs) |
| `twoline_title1`, `twoline_title2` | if present: MUST be used for 2-line UIs |
| `album`, `artist`, `name` | raw metadata (do not use for display) |
| `state` | `play`, `pause`, `stop`, `stream`, `connecting`, … |
| `secs`, `totlen` | position and length in seconds; `secs` does not change the `etag` |
| `canSeek` | `1` = `/Play?seek=` possible |
| `song` | position of the current track in the queue |
| `pid` | queue id (= `id` of `/Playlist`); changes with every queue change |
| `prid` | preset id (= `prid` of `/Presets`) |
| `syncStat` | changes whenever `/SyncStatus` changes |
| `shuffle`, `repeat` | `0` / `1`; repeat `0` = queue, `1` = track, `2` = off |
| `volume`, `db`, `mute`, `muteVolume`, `muteDb` | volume 0–100 (`-1` = fixed), in dB, mute state |
| `quality` | `cd`, `hd`, `dolbyAudio`, `mqa`, `mqaAuthored` or the bitrate (lossy) |
| `streamFormat` | e.g. `MP3 320 kb/s`, `FLAC 16/44.1` |
| `service`, `serviceName`, `serviceType`, `serviceIcon` | source of the playing item |
| `image`, `currentImage`, `stationImage` | images |
| `infourl`, `lyricsid` | values for `/Info` |
| `fn` | file / item id |
| `isFavourite` | `1` = the playing track is a favourite |
| `streamUrl` | present: not playing from the queue (no `song` / shuffle / repeat / skip) |
| `actions` > `action` (`name`, `url`, `icon`, `text`, `notification`, `state`) | radio actions, see `/Action` |
| `sleep` | minutes left on the sleep timer |
| `groupName`, `groupVolume` | only on the primary player of a group |
| `battery` (`level`, `charging`, `icon`) | players with a battery |
| `alarmsecondsremaining`, `notifyurl`, `canMovePlayback`, `indexing`, `mid`, `mode`, `sid`, `cursor` | further elements |

**Notes**

- Without parameters the answer comes at once.
- Clients must advance `secs` themselves while `state` is `play` or `stream`.
- `play` and `stream` mean the same.
- `quality` is `hd` here but `hr` in the library filter (verified). MP3 files report their bitrate as `quality`; recognise MP3 by `streamFormat`.
- Verified: during playback the player holds each long-poll request for the full 100 s and answers at once on a change (title, position jump, volume, shuffle, repeat, `pid`).
- Radio streams may lack `title3` (verified with Radio Paradise: only `title1`, `title2`); `infourl` and `lyricsid` feed [`/Info`](#get-info).
- One long poll on `/Status` *or* [`/SyncStatus`](#get-syncstatus) is usually enough: `<syncStat>` changes whenever `/SyncStatus` changes.
- Grouped players: `/Status` of a secondary player is a copy of the primary's; use [`/SyncStatus`](#get-syncstatus) for the volume of each secondary.

### `GET /SyncStatus`

```
GET /SyncStatus?timeout=<seconds>&etag=<etag>
```

| Parameter | Meaning |
|---|---|
| `timeout` | Long polling: seconds the player may hold the request. Recommended 180. |
| `etag` | `etag` attribute of the previous answer's root. |

**Response format**

```xml
<SyncStatus etag="2230" syncStat="2230" version="4.18.18" id="192.168.1.100:11000" db="-53.7" volume="14"
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

A normal (not fixed) group shows `<slave id="192.168.1.101" port="11000"/>` per secondary player on the primary, and `<master port="11000">192.168.1.100</master>` on a secondary player. Players with a battery add `<battery level="…" charging="…" icon="…"/>`.

**Notes**

- Verified (fixed home theatre group): `version` = BluOS version, `class` (e.g. `streamer-amplifier`), `zoneController="true"` on the primary of the fixed group, `zoneUngroup` = request that dissolves it (`/RemoveSlave?slaves=…&ports=…`), one `zoneSlave` per surround speaker with its `channelMode` (`side_left`, `side_right`, …) and `distance` in m; `audioPresetUrl` points to [`/audioPreset`](#get-audiopreset).
- Poll `/SyncStatus` when only name, volume and grouping matter; `/Status` for playback.
- `initialized="false"`: the player still needs setup in the BluOS Controller.

---

## 3. Volume

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

The text is the level 0–100 (`-1` = fixed volume). When muted: `mute="1"`, plus `muteDb` and `muteVolume` (the level before muting).

**Notes**

- Without parameters: read the volume. Use one of `level`, `abs_db`, `db` or `mute` per request.
- All variants are limited to the volume range configured in the BluOS Controller (typically -80…0 dB).
- The official parameter table says `mute=0` mutes, but its own examples (and community projects) use `mute=1` to mute – the examples are right.
- Verified: `level`, `db=2`, `db=-2`.
- The BluOS Controller sends every change with `tell_slaves=1` (`/Volume?level=…&tell_slaves=1`, `/Volume?mute=1&tell_slaves=1`).

---

## 4. Playback control

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
| `service` | streaming service, e.g. `Slacker` |
| `skip`, `next`, `back`, `love`, `ban` | the action with the track id given by the player (Radio Paradise uses `next` for its skip action) |
| `action` | `addFavourite` / `deleteFavourite`: favourite of a streaming item (from [`/Services`](#get-services)) |
| `preset_id` | station id for `action=addFavourite`, e.g. `s16252` (TuneIn) |

**Response format**

```xml
<skip>1</skip>
```

Other answers: `<back/>`, `<love>1</love>`, ban: `<love skip="1">0</love>`, or `<response>…</response>` with a notification for the user.

**Notes**

- Streaming radio (e.g. Slacker, Radio Paradise, Amazon stations) does not use the queue. `/Status` then lists `<actions><action name="back|skip|love|ban" url="…" icon="…" text="…" notification="…" state="…"/></actions>`.
- Invoke the `url` exactly as given; it is usually `/Action?…`, but any URI is possible. An action without `url` is not available.
- Verified with Radio Paradise: `/Status` offered `<action name="back"/>` (no url, not available) and `<action name="skip" url="/Action?service=RadioParadise&next=55833"/>`; the skip answered `<skip>1</skip>`.
- If the root is `<response>`, its text is a notification for the user; otherwise show the action's `notification`.
- More variants: `/Action?service=TuneIn&action=addFavourite&preset_id=s16252` (radio favourite), `/Action?service=Airable&action=back`, `/Action?service=RadioParadise&next=…`.

### `GET /Add`

```
GET /Add?service=<svc>&album=<album>&artist=<artist>&albumid=<id>&genre=<genre>&path=<path>&playlist=<name>&playlistid=<id>&file=<file>&playnow=<1|-1>&where=<next|nextAlbum|last>&clear=0&shuffle=<0|1>&listindex=<n>&nextlist=1&cursor=last
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

**Response format**

```xml
<playlist length="18" id="646" modified="1" count="9" shuffle="0" repeat="2"></playlist>
```

`length` = entries of the queue now, `count` = entries added, `id` = new queue id (= `pid` of `/Status`). Playing an album with `playnow=1` answers without `modified`.

**Notes**

- Which parameters appear depends on the service and the action; [`/Services`](#get-services) lists them per menu entry (play now, shuffle, add next, add last).
- Verified examples: album play `/Add?playnow=1&service=LocalMusic&album=…&artist=…`; album to the end `/Add?album=…&artist=…&playnow=-1&service=LocalMusic&where=last`; track `/Add?playnow=1&file=…`.
- Changes the queue id.
- Not documented as a request; appears as `playURL`, `autoplayURL` and `actionURL` in `/Browse` answers (also in the official examples). Take the URLs from the player instead of building them.

### `GET /Back`

```
GET /Back
```

No parameters.

**Response format**

```xml
<id>19</id>
```

The new queue position.

**Notes**

- After more than 4 s of playback: back to the start of the track; otherwise the previous track (from the first to the last), regardless of repeat.
- Same restrictions as `/Skip`.

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

With `toggle=1` the new state (`pause` or `play`).

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
| `url` | URL-encoded stream URL (e.g. an MP3 on the web), or the `URL` attribute of an input from [`/RadioBrowse?service=Capture`](#get-radiobrowse) (already encoded) |
| `inputTypeIndex` | select an input by type and number, e.g. `spdif-2` (BluOS ≥ 4.2.0) |
| `inputIndex` | select an input by position, from 1, Bluetooth excluded (BluOS 3.8.0 – 4.2.0) |
| `title`, `image` | the BluOS Controller sends them with an input URL (name and icon of the input) |
| `title1` | name shown for a stream, e.g. the chosen TuneIn stream or a radio station |

**Response format**

```xml
<state>play</state>
```

Or `<state>stream</state>` for streams and inputs.

**Notes**

- `/Play` alone starts / resumes the current source (only from `pause`, not from `stop`).
- `seek` only works when `/Status` has `totlen` / `canSeek=1`. `seek` + `id` (official since v1.6) and `id` alone are verified; `seek` + `id` also returns from a radio stream to the queue (answer `<state>play</state>`).
- Use `seek` (+ `id`), `id`, `url`, `inputTypeIndex` or `inputIndex`, not several of them.
- `url` with an input: active inputs only; the only way to select inputs of a BluOS HUB (`Hub%3A%2F%2F192.168.1.149%3A11000%2Finput0`). The source must be connected and not hidden.
- `inputTypeIndex`: also works for inactive inputs missing from `/RadioBrowse`; recommended for custom integration. Types: `spdif` (optical), `analog`, `coax`, `bluetooth`, `arc`, `earc`, `phono`, `computer`, `aesebu`, `balanced`, `microphone`; the number starts at 1 per type.
- `inputIndex`: position in `/Settings?id=capture&schemaVersion=32`. The official example writes `InputId`; the parameter table says `inputIndex`.
- Radio: `/Play?url=TuneIn:s16252/e113900962/https://…&title1=…` (a stream chosen with `/RadioBrowse?c=selectStream&id=…`), `/Play?url=Airable:radio:https://…&title1=…&image=…`, `/Play?url=RadioParadise:/1:20/Mellow%20Mix&title1=…&image=…`.

### `POST /playurl`

```
POST http://<player>:80/playurl   (form field url)
```

| Parameter | Meaning |
|---|---|
| `url` | what to play, e.g. `TuneIn:s16252` or a stream URL (form field, URL-encoded) |

**Response format**

An HTML page "Confirmation": "Settings Updated – Playing TuneIn:s16252 – Please wait…", with a refresh to `/` after 3 s.

**Notes**

- Verified with `url=TuneIn:s16252`: the player plays the station. The same as [`/Play?url=`](#get-play) on port 11000, through the old web form of the player.

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

**Notes**

- Repeats never stop by themselves.
- Verified: the answer is the `playlist` element with the new `repeat`, not a plain number.

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

**Notes**

- `1` builds a shuffled copy of the queue (no effect if already shuffled); `0` restores the original order.
- Changes the queue id (verified).
- Verified: `/Shuffle` **without** `state` switches shuffle off (it does not read the state); read it from `<shuffle>` in [`/Status`](#get-status) instead.

### `GET /Skip`

```
GET /Skip
```

No parameters.

**Response format**

```xml
<id>21</id>
```

The new queue position.

**Notes**

- From the last track it goes to the first, regardless of repeat.
- Only for queue playback (no `<streamUrl>` in `/Status`); streaming radio uses [`/Action`](#get-action).

### `GET /Stop`

```
GET /Stop
```

No parameters.

**Response format**

```xml
<state>stop</state>
```

**Notes**

- Verified. Cancels the timeout of a playing alarm.

---

## 5. Playlist

The play queue is the list the player plays from. Saved playlists belong to the service `BluOS`; in `/Browse` they appear in the top menu (`browseKey="playlists"`) with play URLs and context menus.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /AddToPlaylist` | add an album or a song to a saved playlist | | ✓ |
| `GET /AddToPlaylistOptions` | choices for adding an album or a song to a saved playlist | | ✓ |
| `GET /Clear` | clear the queue | ✓ | ✓ |
| `GET /Delete` | remove a queue entry or delete a saved playlist | ✓ | ✓ |
| `GET /Load` | load a saved playlist (or a service playlist) | | ✓ |
| `GET /Move` | move a queue entry | ✓ | ✓ |
| `GET /Playlist` | list the queue or its status | ✓ | ✓ |
| `GET /Playlists` | names of the saved playlists | | ✓ |
| `GET /Save` | save the queue as a playlist | ✓ | ✓ |

### `GET /AddToPlaylist`

```
GET /AddToPlaylist?service=<svc>&sourceService=<svc>&album=<album>&artist=<artist>&name=<playlist>
```

| Parameter | Meaning |
|---|---|
| `sourceService` | source of the item |
| `album` + `artist` | album to add (or the item parameters of the song) |
| `name` | name of the saved playlist to add to |

**Response format**

```xml
<addToPlaylist service="BluOS"></addToPlaylist>
```

**Notes**

- The request is built from the answer of [`/AddToPlaylistOptions`](#get-addtoplaylistoptions): its `urlPath` with the `requestParameter` values, plus `name`.
- Verified: adding a library album to a test playlist made the playlist longer (counted with [`/Songs`](#get-songs)); the test playlist was deleted again.
- With a new `name` the playlist is created (e.g. `/AddToPlaylist?service=LocalMusic&sourceService=LocalMusic&album=…&artist=…&name=aaaa`).

### `GET /AddToPlaylistOptions`

```
GET /AddToPlaylistOptions?service=<svc>&album=<album>&artist=<artist>&songid=<id>&saveQueue=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the item |
| `album` + `artist` | album to add |
| `songid` | song to add |
| `saveQueue` | `1` = options for saving the queue as a playlist (result type `SaveQueueOptions`, seen in `/ui/Queue`) |

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

**Notes**

- Verified (library album): the answer describes the follow-up request – [`/AddToPlaylist`](#get-addtoplaylist) with the given parameters – and lists the saved playlists to choose from; `create="1"` = a new playlist may be created.
- Read only; nothing is added.
- With `saveQueue=1` (verified) the answer is `saveQueueOptions` with `urlPath` = `/Save`, the current queue `name`, an `overwrite` entry (`service=BluOS`, `name=…`), an `explanation` (e.g. songs from the library can only be saved in a BluOS playlist) and the playlists per service (`create`, `disable`).

### `GET /Clear`

```
GET /Clear
```

No parameters.

**Response format**

```xml
<playlist modified="0" length="0" id="1056"/>
```

### `GET /Delete`

```
GET /Delete?id=<n>&service=BluOS&name=<name>
```

| Parameter | Meaning |
|---|---|
| `id` | queue position of the entry to remove |
| `service` | `BluOS` – together with `name` |
| `name` | name of the saved playlist to delete |

**Response format**

```xml
<deleted>9</deleted>
```

For a queue entry; deleting a saved playlist answers without this element.

**Notes**

- Two functions: `id` removes a **queue entry** (official); `service=BluOS&name=…` deletes a **saved playlist** (verified, context menu type `delete` in `/Browse`; ask the user first). Use one form per request.

### `GET /Load`

```
GET /Load?service=<service>&name=<name>&id=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS` for saved playlists, or a streaming service |
| `name` | name of the saved playlist |
| `id` | playlist id of a streaming service (e.g. Tidal) |

**Response format**

```xml
<loaded service="BluOS"><entries>12</entries></loaded>
```

`entries` = number of tracks loaded.

**Notes**

- Replaces the queue with the playlist and plays it. Take the URL from `/Browse` (playlist `playURL`) or from `/Presets` (e.g. `/Load?service=Tidal&id=fd3f797e-a3e9-4de9-a1e2-b5adb6a57cc7`).

### `GET /Move`

```
GET /Move?new=<to>&old=<from>
```

| Parameter | Meaning |
|---|---|
| `new` | new position |
| `old` | current position |

**Response format**

```xml
<moved>moved</moved>
```

**Notes**

- Verified: moving entry 0 to position 1 and back.
- The BluOS Controller's queue editor sends it, e.g. `/Move?new=3&old=6`.

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
  <!-- one <song> per entry; id = queue position (= song of /Status) -->
</playlist>
```

`id` of `playlist` = `pid` of `/Status`. Streaming services add `albumid`, `artistid`, `songid` to `song`. With `length=1` only the attributes, no songs.

**Notes**

- `/Playlist` without parameters returns the whole queue – not recommended (very large). Use `start` / `end` for paging.
- Verified: `id` changes on add, remove, shuffle on / off, clear and load.

### `GET /Playlists`

```
GET /Playlists?service=BluOS
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS`; has no effect (verified) |

**Response format**

```xml
<playlists service="BluOS">
  <name image="/Artwork?service=LocalMusic&amp;fn=…">My Playlist</name>
  <name image="/Artwork?service=LocalMusic&amp;fn=…">Party</name>
</playlists>
```

**Notes**

- One request, no paging; `start` / `end` have no effect (verified).
- No play URL – that comes from `/Browse`.

### `GET /Save`

```
GET /Save?name=<name>&service=BluOS&create=1
```

| Parameter | Meaning |
|---|---|
| `name` | name of the new BluOS playlist |
| `service` | `BluOS` |
| `create` | `1` = create a new playlist (the BluOS Controller sends it when saving under a new name) |

**Response format**

```xml
<saved>
  <entries>126</entries>
</saved>
```

**Notes**

- Fails when the queue is empty (community projects).
- Example: `/Save?create=1&name=aaaa&service=BluOS`; the target is chosen in [`/AddToPlaylistOptions?saveQueue=1`](#get-addtoplaylistoptions).

---

## 6. Presets

Presets are created and deleted only in the BluOS Controller; they can hold radio stations, playlists and inputs.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Preset` | load a preset, the next or the previous one | ✓ | ✓ |
| `GET /Presets` | list the presets | ✓ | ✓ |
| `GET /SetPreset` | store an item as a preset; without parameters the preset list | | ✓ |

### `GET /Preset`

```
GET /Preset?id=<id|+1|-1>
```

| Parameter | Meaning |
|---|---|
| `id` | preset id, `+1` = next preset, `-1` = previous preset |

**Response format**

```xml
<state>stream</state>
```

For a radio preset. A preset with a list of tracks answers `<loaded service="Deezer"><entries>60</entries></loaded>`.

**Notes**

- Verified with `id=+1` (radio preset): answer `<state>stream</state>`.
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

**Notes**

- Verified. `url` is the ready request that plays the preset, e.g. `/Play?url=RadioParadise:/42:4/Serenity` or `/Play?url=TuneIn:s16252` (the official example also shows `/Load?service=Tidal&id=…`).
- `volume`: volume set when the preset is loaded.
- Ids need not be consecutive (here 1–4 and 6).

### `GET /SetPreset`

```
GET /SetPreset?id=<slot>&name=<name>&url=<url>&encoded_url=<url>&image=<image url>&volume=<0–100>&delete=1
```

| Parameter | Meaning |
|---|---|
| `id` | preset slot; alone (`/SetPreset?id=5`) it deletes the preset |
| `name` | name of the preset |
| `url` | play request of the item (e.g. its `playURL`) |
| `encoded_url` | source URL as the BluOS Controller sends it, e.g. `RadioParadise:/3:20/The%20Globe` |
| `image` | image of the preset |
| `volume` | volume set when the preset is loaded |
| `delete` | `1` together with `id`: deletes the preset |

**Response format**

Like [`/Presets`](#get-presets): the new preset list, with a new `prid`.

**Notes**

- Without parameters (verified) the answer is the preset list, the same as [`/Presets`](#get-presets).
- Verified with `name`, `url`, `image` (parameters from [`/Services`](#get-services)): stores the preset in the first free slot (here id 5), answers the new preset list; `prid` changes; `url` is stored URL-encoded and without `volume`.
- The BluOS Controller edits a preset with `id`, `name`, `volume`, `image`, `encoded_url` and deletes it with `id` alone.
- Moving a preset to another slot = store it under the new `id`, then `/SetPreset?id=7&delete=1` (7 = the old slot).

---

## 7. Browse and search

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Browse` | menu tree, lists, context menus, search | ✓ | ✓ |
| `GET /Info` | information on an artist, album, track or station (last.fm, lyrics, technical data) | | ✓ |
| `GET /RadioBrowse` | list of the inputs; radio menus | ✓ | ✓ |

### `GET /Browse`

```
GET /Browse?key=<key>&q=<text>&withContextMenuItems=<0|1>
```

| Parameter | Meaning |
|---|---|
| `key` | opaque key from `browseKey`, `nextKey`, `parentKey`, `contextMenuKey` or `searchKey` of an earlier answer, URL-encoded. Without `key`: top menu. |
| `q` | search text, together with a `searchKey`; without `key`: top-level search |
| `withContextMenuItems` | `1` = every item gets an inline `<contextMenu>`; `0` drops only the `contextMenu` children, keys and URLs stay (verified) |

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

Tracks of an album (`type="tracks"`):

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

Some answers group the items in `<category text="…" nextKey="…">`; errors come as `<error><message>…</message></error>`.

**Notes**

- `browse@type`: `menu`, `contextMenu`, `artists`, `composers`, `albums`, `playlists`, `tracks`, `genres`, `sections` (alphabetic sections), `items` (mixed), `folders`.
- `item@type`: `link` (leads further), `audio` (directly playable), `artist`, `composer`, `album`, `playlist`, `track`, `text`, `section`, `folder`.
- `browseKey` = can be opened; `playURL` = default play action (usually clear the queue and play); `autoplayURL` = play this track and fill the queue with the rest of its container; `contextMenuKey` = key of the item's context menu; `actionURL` = action of a context menu item. Which of `playURL` / `autoplayURL` is the default should be a user preference.
- Context menu item types: `favourite-add`, `favourite-delete`, `add-now` (play now), `add-next`, `add-last`, `add-shuffle`, `addAll-now`, `addAll-next`, `addAll-last`, `playRadio`, `delete` (ask the user first).
- Paging: `nextKey` on `browse` or `category`; the chunk size is fixed by the player.
- With a German `Accept-Language` (`de-DE,de;q=0.9,en;q=0.8`, as browsers send it), the album key `LocalMusic:MG/LocalMusic-Album?album=…&artist=…` answers some albums (e.g. "The Wall HiRes") with an empty `<browse type="menu"/>` instead of the tracks; others (e.g. "1", "Autumn (20th Anniversary)") answer normally, and which ones are hit can depend on the exact header value. With `Accept-Language: en` or without the header, the same albums answer their tracks (verified, BluOS 4.18.18).
- Streaming services use keys like `/Albums?service=Tidal&category=masters`; their search answers link to `/Artists|Albums|Songs|Playlists?service=…&expr=…`.
- Verified keys for the local library (shown for `LocalMusic`; for the USB drive the keys start with its id instead, e.g. `1A2B_3C4D:`):

  | key | Answer | Size |
  |---|---|---:|
  | (none) | `type="menu"` · sources, playlists, inputs, radio (`item` with attributes `browseKey`, `text`, `image`, `type`, `playURL`, `inputType`) | 1.2 KB |
  | `LocalMusic:` | 7 `item` elements (Artists, Albums, Songs, Genres, Playlists, Composers, Favourites); USB: 6 | 1.0 KB |
  | `…bySection:Album/…` | `type="sections"` · 27 `item` elements with attributes `browseKey`, `text`, `text2` – **`text2` = number of albums in the section**; USB lists only filled sections | 4.4 KB |
  | `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | like Album, with counts | 4–5 KB |
  | `…S:Album/…&section=A` | `type="albums"` · 143 `item` elements with attributes `browseKey`, `contextMenuKey`, `playURL`, `text`, `text2`, `tracks`, `image` + context menus | 204 KB (68 KB without context menus) |
  | `LocalMusic:GG/Genres` | `type="genres"` · 34 `item` elements with attributes `browseKey`, `text` | 3.4 KB |
  | `LocalMusic:MG/LocalMusic-Genre?genre=…` | empty – genre menus have other keys, take them from the genre list | 0.2 KB |
  | `LocalMusic:MG/LocalMusic-Artist?artist=…` | 2 `item` elements (albums, songs of the artist); the "Albums" key `LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fartist=…&service=LocalMusic` returns all albums of the artist with URLs and context menus, no paging – but **without favourite state**: no `isFavourite`, no `&isFavourite=1` in `contextMenuKey`, the menu offers `favourite-add` also for favourites (verified 2026-11-15) | 0.4 KB |
  | `LocalMusic:Album/%2Flibrary%2Fv1%2FAlbums%3Fgenre=Jazz&service=LocalMusic` (built) | the `/library/v1/Albums` request as browse list with URLs, context menus and favourite state: `recent=1` (50 per page, `nextKey` with `count=50&start=50`), `category=FAVOURITES` (all in one answer); `genre=…` answers **empty**, also with `&offset=0` (verified 2026-11-15) | 75 KB (New, 50 albums) |
  | `LocalMusic:S:Album/%2Flibrary%2Fv1%2FAlbums%3Fquality=cd&service=LocalMusic&limit=50&section=A` (built like the section keys) | the quality albums of the section with URLs, context menus and favourite state; same albums as `/library/v1/Albums?quality=cd&section=A` (verified 2026-11-15) | 199 KB (140 albums) |
  | `LocalMusic:MG/LocalMusic-Favourites` | 4 `item` elements (favourites by type) | 0.7 KB |
  | `LocalMusic:MG/LocalMusic-Album?album=…&artist=…` | `type="tracks"` with `playURL` · 9 `item` elements with attributes `contextMenuKey`, `playURL`, `autoplayURL`, `text`, `duration`, `image` (`type="track"`) | 16.8 KB (7.2 KB without context menus) |
  | `LocalMusic:CM/LocalMusic-Album?album=…&artist=…[&isFavourite=1]` | `type="contextMenu"` · 5 `item` elements with attributes `actionURL`, `text`, `type` (`favourite-add/-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last`) | 1.0 KB |
  | `LocalMusic:Search` + `q=love` | `type="menu"` · 4 `item` elements (links to artists, albums, songs, composers); every list returns all hits | 0.7 KB |
  | `LocalMusic:Playlist/…imported=1` | imported playlists (empty here) | 0.2 KB |
- Errors come as `<error>` root element with one `<message>` and zero or more `<detail>` text nodes.
- Keys (`browseKey`, `nextKey`, `parentKey`, `contextMenuKey`, `searchKey`) are opaque: pass them unchanged, URL-encoded, as `key=`.

### `GET /Info`

```
GET /Info?service=<svc>&artist=<artist>&album=<album>&title=<title>&category=technical&filename=<file>&lyricsid=<id>&infourl=<url>&url=<url>
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

**Response format**

Depends on the variant (verified):

| Variant | Answer |
|---|---|
| `artist`, `album`, `title` (library) | redirect to last.fm; the answer is the last.fm web page (HTML) |
| `category=technical&filename=…` | empty |
| `infourl=…` | the info web page itself (HTML, e.g. Wikipedia) |
| `lyricsid=…` | an HTML page with the lyrics (here from Radio Paradise, with the cover as background) |

**Notes**

- The variants come from the player's description in [`/Services`](#get-services) (menu entries of type `info`).
- Verified: artist / album / track info of the library redirects to last.fm; `category=technical&filename=…` answered empty.
- Verified with `infourl` (Radio Paradise, `<infourl>` from `/Status`): answers the info web page itself (here a Wikipedia page, HTML).
- `lyricsid`: lyrics (`/Info?lyricsid=39888&service=RadioParadise`, "Lyrics" in the now playing screen), verified; `url` not seen yet.

### `GET /RadioBrowse`

```
GET /RadioBrowse?service=<service>&url=<url>&key=<key>&c=<category>&id=<station id>
```

| Parameter | Meaning |
|---|---|
| `service` | `Capture` = inputs; `Presets` = presets as browse list; `Alarms` = sources for an alarm; otherwise a radio service (e.g. `TuneIn`, `RadioParadise`) |
| `url` | e.g. `presets` (favourite stations of a service), `playlists` (with `service=Alarms`) |
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
  <item text="Optical Input 1" id="input2" type="audio" inputType="spdif" typeIndex="spdif-1"
        URL="Capture%3Ahw%3Aimxspdif%2C0%2F1%2F25%2F2%3Fid%3Dinput2" image="/images/capture/ic_opticalinput.png"/>
  <!-- inputs of a BluOS HUB: <category text="…" icon="…"><remoteitem/></category> -->
</radiotime>
```

**Notes**

- Verified with `service=Capture`: lists the active inputs (here Bluetooth, HDMI ARC, optical input 1), cloud sources (e.g. Spotify) and HUB inputs. `typeIndex` (e.g. `spdif-1`, `arc-1`) is the value for [`/Play?inputTypeIndex=`](#get-play); play an entry with `/Play?url=` and its `URL`.
- The radio variants (`url`, `c`) come from the player's description in [`/Services`](#get-services); not tried yet.
- `service=Presets`, `service=Alarms` (also `&url=playlists`) and `service=RadioParadise` are used by the BluOS Controller.
- Browsing radio: `url` takes the full directory URL of the service (TuneIn `https://api.radiotime.com/categories/…`, Airable `https://7818664144.airable.io/radio/…`, also podcasts); `service=Airable&url=alarms` lists alarm sources; `c=selectStream&id=s16252&service=TuneIn` lists the streams of a station.

---

## 8. Favourites

These endpoints appear as `actionURL` values in `/Browse` context menus (also in the official examples), but are not documented as requests. Take the URLs from the player instead of building them.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /AddFavourite` | mark a favourite | | ✓ |
| `GET /DeleteFavourite` | remove a favourite | | ✓ |
| `GET /RadioAddPreset` | add a URL favourite (radio) | | ✓ |

### `GET /AddFavourite`

```
GET /AddFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |

**Response format**

```xml
<favourite service="LocalMusic">added</favourite>
```

**Notes**

- Verified for the library. The current state shows in the context menu (`favourite-add` or `favourite-delete`) and in `isFavourite` of `/library/v1` answers.
- USB albums have no favourite actions (verified).

### `GET /DeleteFavourite`

```
GET /DeleteFavourite?service=<svc>&album=<album>&artist=<artist>&albumid=<id>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `album` + `artist` | album of the local library |
| `albumid` | album of a streaming service |

**Response format**

```xml
<favourite service="LocalMusic">deleted</favourite>
```

**Notes**

- Verified for the library. Counterpart of [`/AddFavourite`](#get-addfavourite).

### `GET /RadioAddPreset`

```
GET /RadioAddPreset?service=<service>&name=<name>&url=<url>
```

| Parameter | Meaning |
|---|---|
| `service` | radio service, e.g. `TuneIn` |
| `name` | name of the favourite |
| `url` | what it plays, e.g. `TuneIn:s16252` or a stream URL |

**Response format**

Empty answer.

**Notes**

- Verified: adds a favourite of the kind "URL" (BluOS Controller: Favourites › URL) with the given name – not a station favourite like `/Action?…&action=addFavourite&preset_id=…`.
- No request to delete it is known (`/RadioDeletePreset` answers 404); remove it in the BluOS Controller.

---

## 9. Library

All endpoints of this section answer on port 11000 like every other request. The short forms (`/Albums`, `/Artists`, …) only redirect to the library server on port 11004, which also answers the `/library/v1/…` requests; call `/library/v1/…` directly on port 11000. Everything in this section is verified.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Albums` | redirect to `/library/v1/Albums` | | ✓ |
| `GET /Artists` | redirect to `/library/v1/Artists` | | ✓ |
| `GET /Composers` | redirect to `/library/v1/Composers` | | ✓ |
| `GET /Folders` | redirect to `/library/v1/Folders` | | ✓ |
| `GET /Genres` | redirect to `/library/v1/Genres` | | ✓ |
| `GET /library/v1/Albums` | albums by section, newest, favourites, quality, genre, artist | | ✓ |
| `GET /library/v1/Artists` | artist names | | ✓ |
| `GET /library/v1/Composers` | composers | | ✓ |
| `GET /library/v1/Folders` | folder tree | | ✓ |
| `GET /library/v1/Genres` | all genre names | | ✓ |
| `GET /library/v1/Playlists` | imported or favourite playlists of the library | | ✓ |
| `GET /library/v1/Search` | artists, albums, songs for a search term | | ✓ |
| `GET /library/v1/Songs` | songs with technical data | | ✓ |
| `GET /Songs` | tracks of a saved playlist; otherwise redirect to `/library/v1/Songs` | | ✓ |

General:
- The root of every answer carries `id` (library: a fixed number, USB: `1`) and `service`, plus all filters passed as attributes.
- `limit` and `start` are **ignored** with `section=`: a section always comes complete.
- `sort=` (according to `/Services`: `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate`) gives an empty answer for albums.
- Paging: `<nextlink>` with the full URL of the next page.
- **No genre per album** in any answer.

### Aliases on port 11000

```
GET /Artists?…   GET /Albums?…   GET /Genres?…   GET /Composers?…   GET /Folders?…
```

Parameters: the same as the `/library/v1` endpoint of the same name.

**Response format**

HTTP **302** to the same request under `/library/v1` on port 11004, e.g. `/Albums?service=LocalMusic&artist=Adele` → `http://192.168.1.100:11004/library/v1/Albums?service=LocalMusic&artist=Adele`.

**Notes**

- All tested variants (no parameters, `service`, `start` / `end`, `artist`, `genre`, `album` + `artist`) redirect. Use `/library/v1/…` directly.
- `/Songs` redirects the same way, except with `playlist=` – see [`/Songs`](#get-songs).

### `GET /library/v1/Albums`

```
GET /library/v1/Albums?service=<svc>&section=<letter>&recent=1&category=FAVOURITES&quality=<hr|cd|mqa>&genre=<genre>&artist=<artist>&album=<album>&composer=<composer>&limit=<n>&start=<n>&sort=<sort>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | alphabetic section, e.g. `A` – all albums of the section |
| `recent` | `1` = newest albums (50 per page + `nextlink`) |
| `category` | `FAVOURITES` = favourite albums, one request |
| `quality` | `hr` (HD), `cd`, `mqa` – only together with `section` |
| `genre` | albums of a genre – only together with `section`; without it the answer is empty, also with `limit=500` or `offset=0` (verified 2026-11-15). All albums of a genre: [`/ui/browseGrouped`](#get-uibrowsegrouped) |
| `artist` | all albums of the artist, one request |
| `album` | with `artist`: one album including `cover` |
| `composer` | albums with songs of the composer |
| `limit`, `start` | ignored with `section` |
| `sort` | gives an empty answer |

**Response format**

`section` (also with `quality` or `genre`):

```xml
<albums limit="500" quality="cd" section="A" id="327701" service="LocalMusic">
  <sections>
    <section name="A">
      <album tracks="10" date="1982">
        <title>A Broken Frame</title>
        <art>Depeche Mode</art>
      </album>
      <!-- one <album> per album of the section; isFavourite="1" on favourites -->
    </section>
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
    <album tracks="11" date="2001">Sonos &#39;E Memoria</album>
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

**Notes**

- Without a filter (or only `service`) the answer is empty.
- Depending on the form the title is `title`, `alb` or the text of `album`.
- Sample: `section=A` = 143 albums, 16.5 KB.

### `GET /library/v1/Artists`

```
GET /library/v1/Artists?service=<svc>&section=<letter>&category=FAVOURITES&genre=<genre>&artist=<artist>&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | artists of the section |
| `category` | `FAVOURITES` = favourite artists |
| `genre` | artists of a genre – together with `section` |
| `artist` | only the name of this artist |
| `offset` | without a filter: first entry of the page (the BluOS Controller asks 0, 30, 60 …) |

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

With `category=FAVOURITES` the `<art isFavourite="1">` elements follow directly.

**Notes**

- Empty without a filter.
- Without a filter but with `offset` the BluOS Controller pages through all artists; the same for `/library/v1/Albums` and `/library/v1/Composers`.

### `GET /library/v1/Composers`

```
GET /library/v1/Composers?service=<svc>&section=<letter>&genre=<genre>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `section` | composers of the section |
| `genre` | with `section`: composers of the genre |

**Response format**

```xml
<composers id="327705" service="LocalMusic">
  <composer>Adolphe Adam</composer>
  <composer>Alan Silvestri</composer>
  <composer>Andrea Bocelli</composer>
  <!-- 51 per page without a filter -->
  <nextlink>/library/v1/Composers?end=101&amp;service=LocalMusic&amp;start=51</nextlink>
</composers>
```

With `section` the composers are grouped in `<sections><section name="…">`.

**Notes**

- Without a filter: pages of 51 with `nextlink`.

### `GET /library/v1/Folders`

```
GET /library/v1/Folders?service=<svc>&path=<path>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `path` | folder to list, e.g. `//nas/Music`; without it the list of shares |

**Response format**

```xml
<folders id="327705" service="LocalMusic">
  <subfolders>
    <folder>//nas/Music</folder>
    <!-- one <folder> per sub folder; without path: the shares -->
  </subfolders>
  <!-- with path: also <songs> with the songs of the folder -->
</folders>
```

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
  <!-- one <genre> per genre -->
</genres>
```

**Notes**

- All genre names in one request (1 KB), but no keys for `/Browse`.
- `category`, `album` and `artist` are ignored.

### `GET /library/v1/Playlists`

```
GET /library/v1/Playlists?service=<svc>&imported=1&category=FAVOURITES
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |
| `imported` | `1` = playlists imported from the share (e.g. M3U files) |
| `category` | `FAVOURITES` = favourite playlists |

**Response format**

```xml
<playlists imported="1" id="983063" service="LocalMusic"></playlists>
```

Entries not seen yet (no imported or favourite playlists on the test player).

**Notes**

- Verified: both variants answer, empty on the test player (no imported or favourite playlists). Parameters from the player's description in [`/Services`](#get-services).

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
    <!-- at most 25 -->
  </artists>
  <albums expr="a" id="327705" service="LocalMusic">
    <album tracks="11">
      <title>10,000 Hz Legend</title>
      <art>Air</art>
      <cover>/Artwork?service=LocalMusic&amp;album=10%2C000+Hz+Legend&amp;artist=Air</cover>
    </album>
    <!-- at most 25 -->
  </albums>
  <songs expr="a" id="327705" service="LocalMusic">
    <song>
      <title>#Addicted</title>
      <art>Riverside</art>
      <alb>Love, Fear and the Time Machine</alb>
      <fn>/var/mnt/nas-Music/By Artist/R/Riverside/2015_Love, Fear and the Time Machine/03-#Addicted.flac</fn>
      <track>3</track>
      <discno>1</discno>
      <time>294</time>
      <date>2015</date>
      <quality>cd</quality>
    </song>
    <!-- at most 25; depending on the song also composer -->
  </songs>
</search>
```

**Notes**

- At most 25 hits per type, no `nextlink`. The search via `/Browse` returns all hits.

### `GET /library/v1/Songs`

```
GET /library/v1/Songs?service=<svc>&album=<album>&artist=<artist>&composer=<composer>&section=<letter>&genre=<genre>&category=FAVOURITES&limit=<n>&all=1&offset=<n>
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
| `all` | `1` = all songs of the source, paged with `offset` (30 per page in the BluOS Controller) |
| `offset` | first entry of the page |

**Response format**

```xml
<songs album="1" artist="Peter Gabriel" id="262167" service="LocalMusic">
  <song samplerate="44100" samplebits="16" channels="2" bitrate="821635" atype="flc">
    <songID>78ed48dc0154344fb2be50e925ba0e74</songID>
    <art>Peter Gabriel</art>
    <alb>1</alb>
    <title>Moribund The Burgermeister</title>
    <track>1</track>
    <date>1977</date>
    <time>260</time>
    <quality>cd</quality>
    <fn>/var/mnt/nas-Music/By Artist/G/Peter Gabriel/1977_1/01-Moribund The Burgermeister.flac</fn>
  </song>
  <!-- one <song> per track -->
</songs>
```

A song of a sampler with composer tag (also verified):

```xml
<songs album="La Migliore Canzone Italiana di Natale" artist="Various" id="2031641" service="LocalMusic">
  <song samplerate="44100" samplebits="16" channels="2" bitrate="747475" atype="flc">
    <songID>2cd2463cc377db14c2ae64ac9a6c420b</songID>
    <art>Laura Pausini, The Patrick Williams Orchestra</art>
    <alb>La Migliore Canzone Italiana di Natale</alb>
    <title>White Christmas</title>
    <composer>Irving Berlin</composer>
    <track>1</track>
    <date>2023</date>
    <time>142</time>
    <compilation>1</compilation>
    <albumartist>Various</albumartist>
    <quality>cd</quality>
    <fn>/var/mnt/nas-Music/Compilations/Christmas/2023_La Migliore Canzone Italiana di Natale/1-White Christmas.flac</fn>
  </song>
</songs>
```

Paged lists (`section`, `genre`, `all`) have `<nextlink>` and lack the technical attributes and `songID`, `track`, `date`, `time`.

**Notes**

- Empty with only `service`.
- The lists (`section`, `genre`) lack the technical attributes and `songID`, `track`, `date`, `time`.
- `quality` of MP3 files is the bitrate; recognise them by `atype`.
- Tags per song only when the file has them (verified): `composer` (composer of the track), `discno` (disc number, e.g. on multi-disc albums), `albumartist` and `compilation` (`1` on samplers, e.g. album artist "Various"). `art` is always the track artist, the album artist without `albumartist` is the `art` of the album in `/library/v1/Albums`.

### `GET /Songs`

```
GET /Songs?service=BluOS&playlist=<name>&offset=<n>
```

| Parameter | Meaning |
|---|---|
| `service` | `BluOS` |
| `playlist` | name of the saved playlist |
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

**Notes**

- Verified; 10 tracks per page. Runs on port 11000 (no redirect), unlike the other `/Songs` requests.
- Without `playlist`, `/Songs` is only a 302 redirect to [`/library/v1/Songs`](#get-libraryv1songs) (see [aliases](#aliases-on-port-11000)).

---

## 10. Artwork

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Artwork` | cover art of albums, tracks, playlists, stations | ✓ | ✓ |
| `GET /library/v1/Artwork` | album cover from the library server | | ✓ |

### `GET /Artwork`

```
GET /Artwork?service=<svc>&album=<album>&artist=<artist>&songid=<id>&albumid=<id>&fn=<file>&playlistimage=<id>&width=<px>&height=<px>&followRedirects=1
```

| Parameter | Meaning |
|---|---|
| `service` | source of the image |
| `album`, `artist` | album of the local library |
| `songid`, `albumid` | track / album of a streaming service |
| `fn` | file of the local library (e.g. image of a saved playlist) |
| `playlistimage` | image of a streaming playlist |
| `width`, `height` | size of the image in pixels (the BluOS Controller asks e.g. 480 × 480, 75 × 75) |
| `followRedirects` | `1` = answer with the image itself instead of a redirect |

**Response format**

The image (200, e.g. `image/jpeg`); without `followRedirects=1` a **301** to `http://192.168.1.100:11004/library/v1/Artwork?…` (library).

**Notes**

- Which identifying parameters appear depends on the service; take the URL from the `image` attribute of an answer and append `followRedirects=1` (official since v1.7, verified).
- The image answer carries `Access-Control-Allow-Origin: *` (also for `Origin: null`, a page opened as a file), so a web page can read it with `fetch()` (verified). Firefox upgrades `<img src="http://…">` on a `file://` page to https (mixed content), which the player does not offer; `fetch()` is not upgraded.
- Size of library album covers depends on the library setting "Optimize Artwork" (`resizeall`) at the time the index was built: ON → the player stores at most 600 × 600 px; a larger `width` / `height` returns the same 600 px file (verified 2026-11-17). OFF and the index rebuilt with Diagnostics "Rebuild index" (`/delete_index`; a normal rescan keeps the stored covers, verified 2026-11-19) → the player stores the original image. Without `width` / `height` it still sends at most 600 px (scaled down); with `width` / `height` it scales to that size, up to the original size and never beyond it (e.g. 900 → 900 px, 2000 → the 1000 px original; non-square originals keep their aspect ratio, e.g. 1500 × 1328); `width` or `height` alone also works; `/library/v1/Artwork` and track covers (`fn=`) take the same parameters (Bruno E31; the app asks the album popup and now playing with `COVER_FULL` = 3000, so covers larger than 3000 px are scaled down). A smaller size scales down and re-encodes, often to more bytes than the stored file (480 × 480 was 102 KB against 56 KB for a 600 px original). Larger covers cost bytes: 250–500 KB per cover at 1400–1600 px against 70–170 KB at 600 px. With "Optimize Artwork" OFF, an album whose cover file is larger than 600 KB gets a grey placeholder instead (494 × 494 px, 17.8 KB, the same file for every such album, also with `width` / `height`); the pixel size is not the limit (covers up to 1600 × 1600 px are served). Verified 2026-11-19, BluOS 4.18.18.
- Other image paths in answers (`/images/…`, `/Sources/images/…`) are static files on the player; they also take `width`, `height` and `style` (e.g. `Bluesound`).
- Source icons: the top menu of `/Browse` names them in `image`, the menu of a source in `serviceIcon` – Library `/images/LibraryIcon.png`, USB `/images/USBIcon.png`. 96×96 PNG, white on transparent; `style=Default`, `Dark` and `Light` return the same file. They carry `Access-Control-Allow-Origin: *` like `/Artwork`, but no cache headers (verified 2026-11-17, BluOS 4.18.18).

### `GET /library/v1/Artwork`

```
GET /library/v1/Artwork?service=<svc>&album=<album>&artist=<artist>
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

The primary player selects the source; secondary players follow. Fixed groups (home theatre, stereo pairs) are set up in the BluOS Controller.

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
| `group` | optional group name; without it BluOS picks one |
| `slaves` | comma-separated IP addresses of several secondary players |
| `ports` | their ports, comma-separated |

**Response format**

```xml
<addSlave>
  <slave port="11000" id="192.168.1.153"/>
  <slave port="11000" id="192.168.1.120"/>
</addSlave>
```

**Notes**

- Send to the primary player. Use `slave` + `port` or `slaves` + `ports`.

### `GET, POST /proxyToSlave`

```
GET  /proxyToSlave?slave=<ip>%3A<port>&url=<encoded path>
POST /proxyToSlave   (JSON body {"<name>":"<value>"})
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
- Changes settings of a group member: the BluOS Controller sends `POST /proxyToSlave?slave=192.168.1.101%3A11000&url=%2Fsetting` with the JSON body of the setting, e.g. `{"ledbrightness":"dim"}`.

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
- Also the "Delete fixed group" button in `/Settings`.
- To leave a group, community projects call `/RemoveSlave` with the player's own address.

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

The text is the new trim in dB.

**Notes**

- Seen in `/Settings?id=audio` of a fixed home theatre group ("Right Surround Trim", setting name `db`).
- Verified: trim 0 → 1 dB, read back from `/Settings?id=audio`, restored. The member's own `/SyncStatus` shows the trim as `<slaveVol>`.
- The BluOS Controller sends it as POST with a JSON body, e.g. `{"db":-4}`.

---

## 12. System

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /Alarms` | list of the alarms with time, days, source and volume | | ✓ |
| `GET, POST /alsa_setting` | listening mode and tone controls | | ✓ |
| `GET /apmode` | web page "Force Hotspot Mode" (port 80) | | |
| `GET, POST /audiomodes` | audio and Bluetooth modes | ✓ | ✓ |
| `GET /audioPreset` | current listening mode and its choices | | ✓ |
| `GET /Dataexport` | export of the player's data (presumably for support) | | ✓ |
| `GET, POST /delete_index` | web page "Rebuild Index": confirmation, then rebuild (port 80) | | ✓ |
| `GET /diag` | diagnostics page | | ✓ |
| `GET /diagnostics` | diagnostics page (second view) | | ✓ |
| `GET /Doorbell` | play the doorbell chime | ✓ | ✓ |
| `GET /download_playlists_api` | backup of the saved playlists (port 80) | | ✓ |
| `GET /error` | read and clear the last error message of the player | | ✓ |
| `GET /GitVersion` | BluOS version | | ✓ |
| `GET /LastScanCode` | last received IR code | | ✓ |
| `GET /Name` | read or change the player name | | ✓ |
| `POST /reboot` | soft reboot (POST, port 80) | ✓ | ✓ |
| `GET /redirectToCp` | redirect to a page of the web interface | | ✓ |
| `GET /Reindex` | rescan the music library | | ✓ |
| `GET /Services` | self-description of the sources | | ✓ |
| `GET, POST /setting` | change a simple setting | | ✓ |
| `GET /Settings` | settings tree of the player | ✓ | ✓ |
| `GET /settings/sendSupportRequest` | web page "Send support request" | | ✓ |
| `GET /sharecfg` | web page for network shares (port 80) | | ✓ |
| `GET /Shares` | network shares of the library (port 80) | | ✓ |
| `GET /ShowIRCodes` | IR codes learned from a paired remote control | | ✓ |
| `GET /Sleep` | step the sleep timer | | ✓ |
| `GET /statistics` | switch the statistics collection (port 80) | | ✓ |
| `GET /triggercfg` | web page for learning IR remote codes (port 80) | | ✓ |
| `GET /update` | purpose unknown (presumably firmware update status) | | ✓ |
| `GET /UpdateDNS` | purpose unknown (presumably refreshes the player's DNS / network name registration) | | ✓ |
| `GET /upgrade` | redirect to a web page, presumably the firmware upgrade | | ✓ |
| `POST /upload_playlists_api` | restore the saved playlists (port 80) | | ✓ |
| `GET /Version` | API version | | ✓ |
| `GET /wificfg` | web page for the Wi-Fi settings (port 80) | | ✓ |

### `GET /Alarms`

```
GET /Alarms?tz=<time zone>&id=<id>&enable=<0|1>&days=<flags>&hour=<HH>&minute=<MM>&end=<HHMM>&fadein=<0|1>&volume=<0–100>&source=<name>&url=<play request>&image=<image url>&shuffle=<true|false>&canShuffle=<true|false>&useBackup=<true|false>&delete=1
```

| Parameter | Meaning |
|---|---|
| `tz` | time zone of the client, e.g. `Europe/Berlin`; the BluOS Controller sends it with every request |
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

```xml
<alarms supportsEndTime="true">
  <alarm id="1" enable="1" hour="8" minute="0" days="0000001" duration="60" end="0900"
         volume="25" voldb="-40.8" fadein="1" source="Mellow Mix"
         url="/Play?url=RadioParadise:/1:4/Mellow Mix"
         image="https://img.radioparadise.com/channels/0/1/cover_512x512/0.jpg" useBackup="false"/>
</alarms>
```

Without alarms: `<alarms supportsEndTime="true"></alarms>`.

**Notes**

- Reading (`/Alarms`, `/Alarms?tz=…`) verified; without alarms the list is empty.
- Editing an alarm (`id` with all alarm parameters), switching it on / off (`id` + `enable`) and creating one (all alarm parameters, no `id`) and deleting (`delete=1&id=…`) are used by the BluOS Controller. The sources to choose from come from [`/RadioBrowse?service=Alarms`](#get-radiobrowse).
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

- `supportsEndTime`: alarms can have an end time; while an alarm plays, `/Status` shows the rest in `alarmsecondsremaining`.
- `/Settings` shows the alarms as a setting of class `alarms` with `count` and `enabled`.

### `GET, POST /alsa_setting`

```
GET  /alsa_setting?preset=<mode>&eq-switch=<ON|OFF>&eq-treble=<dB>&eq-bass=<dB>&eq-balance=<n>&eq-centre-trim=<n>&eq-crossover=<Hz>&reset&resetPreset
POST /alsa_setting   (JSON body {"<name>":"<value>"})
```

| Parameter | Meaning |
|---|---|
| `preset` | listening mode, a `value@name` from [`/audioPreset`](#get-audiopreset) (e.g. `MUSIC`, `MOVIE`, `TV`) |
| `eq-switch` | tone controls `ON` / `OFF` |
| `eq-treble`, `eq-bass` | treble, bass: -6 … 6 dB in steps of 0.5 (only with `eq-switch=ON`) |
| `eq-balance` | balance: -7 … 7 in steps of 0.5 |
| `eq-centre-trim` | centre level: -10 … 10 in steps of 0.5 (only with centre channel on) |
| `eq-crossover` | subwoofer crossover: 40 … 200 Hz in steps of 10 (only with a subwoofer) |
| `reset` | "Reset All" button: all listening modes back to the defaults |
| `resetPreset` | "Reset Music Mode" button: only the current listening mode |

**Response format**

No answer body (HTTP 200, empty); with `preset` HTTP 205 (Reset Content, one byte body).

**Notes**

- `preset` verified with GET (`MUSIC` ↔ `MOVIE`, read back from [`/audioPreset`](#get-audiopreset), restored): HTTP 205; the change ends a `/Status` long poll with `syncStat` + 1.
- Names, ranges and dependencies are from the player's own `/Settings?id=audio` answer (verified read); the form `/alsa_setting?eq-balance=0.5` (name = value) comes from community projects. Verified with `eq-balance` (0 ↔ 0.5, read back from `/Settings?id=audio`, restored).
- Which settings exist depends on the player (DSP, centre, subwoofer).
- The BluOS Controller sends it as **POST** with a JSON body, e.g. `{"preset":"MOVIE"}`; GET with name and value as query works as well (verified). Seen: `preset` (`MUSIC`, `MOVIE`, `TV`).
- More: `{"eq-switch":"ON"}`, `{"eq-bass":-1}`, `{"eq-treble":-1.5}`, `{"eq-balance":1.5}`, `{"eq-centre-trim":-2.5}` (numbers without quotes), `{"resetPreset":1}`.

### `GET /apmode`

```
GET http://<player>:80/apmode?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

Not known (not called).

**Notes**

- Linked on the diagnostics page. Presumably switches the player to its own Wi-Fi hotspot (setup mode) – it then leaves the home network. Not opened.

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
| `mqaDisable` | MQA decoding off (`ON`) / on (`OFF`) |
| `fixedVolume` | fixed volume `ON` / `OFF` |
| `channelMode` | channel mode |
| `enableClockTrim` | `ON` / `OFF` |

**Response format**

No answer body (HTTP 200, empty).

**Notes**

- Only `bluetoothAutoplay` is official (no answer body). `subwoofer`, `ears`, `volumeLimits`, `replayGainMode` with their values are from the player's own answers to `/Settings?id=audio` and `/Settings?id=capture` (verified read); `mqaDisable`, `fixedVolume`, `channelMode`, `enableClockTrim` only from community projects. Verified with `replayGainMode` (`album` ↔ `track`, read back from `/Settings?id=audio`, restored).
- The BluOS Controller sends it as **POST** with a JSON body, e.g. `{"replayGainMode":"none"}`; GET with name and value as query works as well (verified). Seen: `replayGainMode` (`none`, `track`, `album`, `smart`), `subwoofer` (`withsub`, `default`).
- More: `{"bluetoothAutoplay":"0"}`, `{"ears":"ON"}`, `{"volumeLimits":"-70,-16"}`.
- Verified: `/audiomodes` without parameters answers empty – it does not return the current values; read them from `/Settings?id=audio`.

### `GET /audioPreset`

```
GET /audioPreset
```

No known parameters.

**Response format**

```xml
<setting id="preset" name="preset" displayName="Listening Mode" url="http://192.168.1.100:11000/alsa_setting"
         class="list" value="MUSIC" refresh="true" required="true" style="inline">
  <value displayName="Music" name="MUSIC" icon="/images/settings/icon_music-mode.png" iconActive="…"/>
  <value displayName="Movie" name="MOVIE" icon="/images/settings/icon_movies-mode.png" iconActive="…"/>
  <value displayName="TV" name="TV" icon="/images/settings/icon_tv-mode.png" iconActive="…"/>
</setting>
```

**Notes**

- Verified: answers the listening mode setting in the format of `/Settings`; `value` is the current mode.
- Icons per mode: `icon` and `iconActive` (e.g. `/images/settings/icon_music-mode-active.png`), 96×96 PNG, white at 50 % (`icon`) or 70 % (`iconActive`) opacity on transparent; `Access-Control-Allow-Origin: *` (verified 2026-11-17).
- Change it with [`/alsa_setting?preset=MOVIE`](#get-post-alsa_setting) (the `url` of the answer), with the `name` of one of the `value` elements. Verified (MUSIC → MOVIE and back): the player answers HTTP 205, `/audioPreset` shows the new mode after about 1 s.
- `/Status` does not name the listening mode. A change still ends a `/Status` long poll: new `etag`, and the only changed field is `syncStat` (+1). A client can follow the mode by reading `/audioPreset` again when `syncStat` changes.
- Only players with listening modes have it; here a fixed home theatre group, whose [`/SyncStatus`](#get-syncstatus) carries `<audioPresetUrl url="/audioPreset"/>`. `/ui/Configuration` lists it as `listeningModesURL="/audioPreset"` of `/ui/presets`.

### `GET /Dataexport`

```
GET http://<player>:80/Dataexport   (also HEAD)
```

No known parameters.

**Response format**

Plain text: the system log of the player (here about 2,600 lines / 290 KB, `syslogd`, network, services …).

**Notes**

- The BluOS Controller first checks with `HEAD /Dataexport`, then loads it with GET.
- Verified. The log holds personal data (network, addresses, names).

### `GET, POST /delete_index`

```
GET  http://<player>:80/delete_index?noheader=1
POST http://<player>:80/delete_index   (form fields noheader=1 and yes or no)
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `yes`, `no` | the button of the confirmation form (POST) |

**Response format**

The GET answers an HTML page "Confirmation": "Rebuild index and start re-index?" with a form (`action="/delete_index" method="POST"`, buttons `yes` and `no`).

**Notes**

- Linked on the diagnostics page ("Rebuild Index"). Verified: the GET only shows the question; nothing is deleted. Answering `no` keeps the index.
- `yes` presumably deletes the library index and scans the whole library again – not sent.

### `GET /diag`

```
GET http://<player>:80/diag?noheader=1&playnum=1&print=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1` |
| `print` | `1` = the full diagnostic report instead of the web app |

**Response format**

An HTML page (the web app "BluOS"). With `print=1`: an HTML page with the diagnostic report as text in `<pre>` – shares (with user name, password hidden), Wi-Fi scan, network, services and more (here about 400 KB).

**Notes**

- Opened through `/redirectToCp?href=/diag&noheader=1`. Web page.
- Verified.
- Verified with `print=1`. The report holds personal data (network names, addresses, user names).

### `GET /diagnostics`

```
GET http://<player>:80/diagnostics?noheader=1&playnum=1&slave=<ip>
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1` |
| `slave` | IP address of a group member: its diagnostics page |

**Response format**

An HTML page "Diagnostics": network name, signal strength, IP and MAC address, BluOS version, uptime, number of songs, connected shares, other players (with links to their pages), statistics switch, links "Rebuild Index", "Force Hotspot Mode", "Reboot".

**Notes**
- Verified.
- The page sends [`/statistics`](#get-statistics), links to [`/delete_index`](#get-post-delete_index), [`/apmode`](#get-apmode) and `/reboot?noheader=1`.

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

Players without a doorbell chime answer `<error>Not supported</error>`.

**Notes**
- Verified on the Powernode: `<error>Not supported</error>` – the doorbell chime depends on the player model.

### `GET /download_playlists_api`

```
GET http://<player>:80/download_playlists_api
```

No known parameters.

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

`files` are ids of the tracks (hashes), not paths.

**Notes**

- Verified (3 playlists → 3 objects). Setting "Backup playlists" (class `download`) in `/Settings?id=managePlaylists`: downloads all saved BluOS playlists.

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

**Notes**

- After a command that failed (here `/Back` on a radio station without back) the BluOS Controller reads `/error?2` and clears it with `/error?clear=1&counter=2`; the counter counts up.
- Verified with `/error?1` (nothing to report).

### `GET /GitVersion`

```
GET /GitVersion
```

No parameters.

**Response format**

```xml
<version>4.18.18</version>
```

### `GET /LastScanCode`

```
GET /LastScanCode
```

No known parameters.

**Response format**

```xml
<lastscancode>-1465131975</lastscancode>
```

**Notes**

- Verified: the code of the last IR signal the player received, as a signed 32-bit number. As unsigned hex it is the `value` of [`/ShowIRCodes`](#get-showircodes): after pressing volume down on a paired remote the answer was `-1465131975` = `0xa8abdc39` = `KEY_VOLUMEDOWN`.
- Useful when learning a remote control: press a button, then read the code.

### `GET /Name`

```
GET /Name?set=<name>
```

| Parameter | Meaning |
|---|---|
| `set` | new name of the player / room |

**Response format**

```xml
<name>Living Room</name>
```

**Notes**

- Without parameters (verified): the player name, the same as `name` of [`/SyncStatus`](#get-syncstatus).
- `set` renames the player ("Room name" in the BluOS Controller); verified.

### `POST /reboot`

```
POST http://<player>:80/reboot   (form field yes=1)
```

| Parameter | Meaning |
|---|---|
| `yes` | any value |

**Response format**

An HTML page "Confirmation": "Settings Updated – Rebooting. Please close this window. – Please wait…", with a refresh to `/` after 15 s.

**Notes**

- Example: `curl -d yes=1 http://192.168.1.100/reboot`.
- Verified: the player restarts and answers `/SyncStatus` again after about 20 s (Powernode); playback stops.
- The diagnostics page links to `/reboot?noheader=1` (the web page with the reboot button).

### `GET /redirectToCp`

```
GET /redirectToCp?href=<encoded path>
```

| Parameter | Meaning |
|---|---|
| `href` | URL-encoded page of the web interface, e.g. `%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0` |

**Response format**

An HTTP redirect to that page (HTML).

**Notes**

- Seen as `url` of the root of [`/Services`](#get-services) (link to the music services page); "Cp" presumably means control panel.
- Verified with `href=%2Fservices%3Fnoheader%3D1%26schemaVersion%3D0`: ends on the HTML page "Configure Music Services" (port 80).
- Also `href=/diag&noheader=1` (diagnostics page, help area of the BluOS Controller).

### `GET /Reindex`

```
GET /Reindex
```

No parameters.

**Response format**

```xml
<indexing>1</indexing>
```

**Notes**

- Starts a rescan of the music library ("Reindex music collection" button in `/Settings`).
- Verified: answers `<indexing>1</indexing>` and starts the rescan, which runs in the background (on the test player still running after several minutes).
- `<indexing>` in `/Status` does **not** show the rescan: 3 s after the start it was `0` while the rescan was still running. How to follow its progress is not known.

### `GET /Services`

```
GET /Services?schemaVersion=<n>
```

| Parameter | Meaning |
|---|---|
| `schemaVersion` | schema the client understands; the BluOS Controller sends `35` |

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

**Notes**

- Verified (62 KB). The player's self-description of every source (`BluOS` playlists, `Capture` inputs, `Alarms`, `LocalMusic` library, USB, `TuneIn`, `RadioParadise`, `Airable` radio): which menus exist and which request (endpoint + fixed and item parameters) each menu entry and context menu action sends.
- Best source for the parameters of requests that `/Browse` hands out as ready URLs, e.g. [`/Add`](#get-add), [`/SetPreset`](#get-setpreset), [`/AddToPlaylistOptions`](#get-addtoplaylistoptions), [`/library/v1/Playlists`](#get-libraryv1playlists).

### `GET, POST /setting`

```
GET  /setting?<name>=<value>
POST /setting   (JSON body {"<name>":"<value>"})
```

| Parameter | Meaning |
|---|---|
| name | `name` of a setting whose `url` (or its menu's `url`) is `/setting`, see the table below |
| value | new value; booleans use `ON` / `OFF` |

**Response format**

No answer body (HTTP 200, empty).

**Notes**

- Verified with `ledbrightness` (`dim` ↔ `default`, read back from `/Settings?id=player`) and `server` (USB server mode `OFF` ↔ `ON`, read back from `/Settings?id=library`), both restored. The names, classes and ranges come from the player's `/Settings` tree:

  | Name | Class | Values | Menu |
  |---|---|---|---|
  | `zonename` | text | room / group name | top level |
  | `amplifierStandby` | boolean | `ON` / `OFF` | top level |
  | `resizeall` | boolean | optimise artwork | `library` |
  | `server` | boolean | USB server mode: shares the music of the USB drive with other players (verified) | `library` |
  | `centre` | boolean | centre channel | `audio` |
  | `ledbrightness` | list | `default`, `dim`, `off` | `player`, group members via `/proxyToSlave` |
  | `zoneap-enable` | boolean | Wi-Fi Direct | `player` |
  | `proximity_enable` | boolean | proximity sensor | `proximity` |
  | `proximity_timeout` | range | 2 … 10 s | `proximity` |
  | `bluos_remote_enable` | boolean | BluOS IR remote | `bluos_remote` |
  | `bluos_remote_channel` | list | IR channel `0` … `7` | `bluos_remote` |
  | `capture-inputN-name` | text | name of input `n` | `capture-inputN` |
  | `capture-inputN-icon` | iconlist | an `/images/capture/ic_….png` path | `capture-inputN` |
  | `capture-inputN-preset` | list | listening mode of the input (e.g. `MUSIC`, `TV`) | `capture-inputN` |
  | `capture-inputN-autosense`, `…-autosenseUngroup` | boolean | switch to the input on signal, ungroup then | `capture-inputN` |
  | `capture-inputN-lowLatency` | boolean | A/V mode | `capture-inputN` |
  | `capture-inputN-latency` | range | lip-sync delay 50 … 150 ms, steps of 10 | `capture-inputN` |
  | `capture-inputN-groupCompress` | boolean | compressed audio to grouped players | `capture-inputN` |
  | `capture-inputN-isMqaSource` | boolean | MQA pass-through (optical inputs) | `capture-inputN` |
  | `capture-inputN-hide` | boolean | hide the source | `capture-inputN` |
- The BluOS Controller sends it as **POST** with a JSON body, e.g. `{"capture-input0-hide":"OFF"}`; GET with name and value as query works as well (verified). Names: `capture-inputN-hide`, `centre`, `amplifierStandby`, `proximity_enable`.
- More names: `capture-inputN-name`, `-icon`, `-preset`, `-autosense`, `-autosenseUngroup`, `-lowLatency`, `-latency` (number, e.g. `{"capture-input6-latency":80}`), `-groupCompress`; `ledbrightness`, `proximity_timeout` (number), `bluos_remote_channel`, `bluos_remote_enable`.

### `GET /Settings`

```
GET /Settings?id=<menu id>&schemaVersion=<n>&view=web&expand=1
```

| Parameter | Meaning |
|---|---|
| `id` | menu page (the `id` of a `menuGroup`); without it the top level |
| `schemaVersion` | schema the client understands; the player reports its own in `/SyncStatus` (`schemaVersion="36"` on the test player). Lower values hide newer menus |
| `view` | `web`: the page as web view, e.g. `/Settings?view=web&id=sendSupportRequest` (help area of the BluOS Controller) |
| `expand` | `1` = the whole tree with the content of all menu pages in one answer (verified, about 44 KB) |

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

A setting that opens a web page has `<webview url="http://192.168.1.100:80/sharecfg?noheader=1"/>` instead of `value` elements.

**Notes**

- The settings tree the BluOS Controller shows. `class` tells the control: `text`, `boolean`, `list`, `range`, `dual-range`, `iconlist`, `button`, `download`, `upload`, `alarms`, `sleep`.
- `url` is the endpoint that changes the setting; a setting without `url` uses the `url` of its `menuGroup`. Seen: [`/setting`](#get-post-setting), [`/audiomodes`](#get-post-audiomodes), [`/alsa_setting`](#get-post-alsa_setting), [`/SlaveVolume`](#get-post-slavevolume), [`/proxyToSlave`](#get-post-proxytoslave), [`/Reindex`](#get-reindex), [`/RemoveSlave`](#get-removeslave), and on port 80 [`/sharecfg`](#get-sharecfg), [`/wificfg`](#get-wificfg), [`/triggercfg`](#get-triggercfg), [`/download_playlists_api`](#get-download_playlists_api), [`/upload_playlists_api`](#post-upload_playlists_api).
- Verified with schema 36, all menu pages read: top level (alarms, sleep timer, room name, amplifier standby, fixed group, library, playlists), `audio`, `audioPreset`, `zone`, `zone_player-192168110111000` (per group member: address and port without dots, here 192.168.1.101:11000), `player` (Wi-Fi, indicator brightness, Wi-Fi Direct), `proximity`, `ir_remote`, `bluos_remote`, `library`, `managePlaylists`, `capture`, `capture-inputN` (per input).
- `/Settings?view=web&id=sendSupportRequest` answers an empty page `<settings pageId="sendSupportRequest" schemaVersion="28"></settings>` (verified).

### `GET /settings/sendSupportRequest`

```
GET http://<player>:80/settings/sendSupportRequest?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

An HTML page (the web app "BluOS", the script loads the content).

**Notes**

- The page itself sends the request to Bluesound support – do not submit it while testing.
- Verified (only read).

### `GET /sharecfg`

```
GET http://<player>:80/sharecfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

An HTML page (single-page web app "BluOS", the script loads the content).

**Notes**

- Verified. Web page of the player for the network shares of the library; linked in `/Settings` as `<webview url=…>`.
- The page loads `/settings/library/networkShares?noheader=1` and asks [`/Shares`](#get-shares).

### `GET /Shares`

```
GET http://<player>:80/Shares
```

No known parameters.

**Response format**

```xml
<shares count="1">
  <share>
    <sharename>\\nas\Music</sharename>
    <username>music</username>
  </share>
</shares>
```

**Notes**

- Verified: the network shares of the library with their user names (no passwords) – the answer holds personal data. Asked by the network shares page ([`/sharecfg`](#get-sharecfg)).

### `GET /ShowIRCodes`

```
GET /ShowIRCodes
```

No known parameters.

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
  <!-- one <code> per learned button -->
</IRCodes>
```

**Notes**

- Verified with a paired (learned) IR remote control: one `code` per learned button, `key` = player function, `value` = learned IR code (hex).
- Keys seen: `KEY_0` … `KEY_9` (presumably the presets), `KEY_PLAY`, `KEY_PAUSE`, `KEY_NEXTSONG`, `KEY_PREVIOUSSONG`, `KEY_VOLUMEUP`, `KEY_VOLUMEDOWN`, `KEY_MUTE`.
- Without a paired remote the list is presumably empty.

### `GET /Sleep`

```
GET /Sleep
```

No parameters.

**Response format**

```xml
<sleep>30</sleep>
```

Minutes until the player switches off.

**Notes**

- Verified: the answer is the minutes until the player switches off.
- Each call steps the timer: 15 → 30 → 45 → 60 → 90 min → off (community projects), so even a call just to read the value changes the timer. To only read it, use `<sleep>` in [`/Status`](#get-status).

### `GET /statistics`

```
GET http://<player>:80/statistics?enable=<0|1>
```

| Parameter | Meaning |
|---|---|
| `enable` | `1` = statistics collection on, `0` = off |

**Response format**

Plain text, e.g. `ENABLED` after `enable=1`.

**Notes**

- Verified (on and back off). Sent by the diagnostics page when "Statistics collection" changes; the current value is the selected `<option>` of `<select id="statistics">` on [`/diagnostics`](#get-diagnostics). While it is on, the player may send usage statistics to Bluesound.

### `GET /triggercfg`

```
GET http://<player>:80/triggercfg?noheader=1&playnum=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |
| `playnum` | seen as `1`; meaning not known |

**Response format**

An HTML page (the web app "BluOS", the script loads the content).

**Notes**

- Setting "IR Learning" (`<webview>`) in `/Settings?id=ir_remote`: web page to learn the codes of a remote control; the result shows in [`/ShowIRCodes`](#get-showircodes).
- Verified: answers the HTML shell of the web app "BluOS" (like `/sharecfg`); opening it did not change anything noticeable.

### `GET /update`

```
GET /update
```

No known parameters.

**Response format**

```xml
<update>no message</update>
```

**Notes**

- Verified without parameters; the purpose is unknown. The name and the answer suggest a firmware update status or message ("no message" = nothing to report); the upgrade itself presumably runs via [`/upgrade`](#get-upgrade).
- Do not try parameters on a real player without care: an update endpoint may start a firmware update.

### `GET /UpdateDNS`

```
GET /UpdateDNS
```

No known parameters.

**Response format**

Empty answer.

**Notes**

- Verified without parameters: the player answers empty; nothing noticeable happens. The name suggests that the player refreshes its DNS or network name registration.

### `GET /upgrade`

```
GET /upgrade?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header (the BluOS Controller opens it like this in the help area) |

**Response format**

An HTTP redirect to a web page (not XML).

**Notes**

- Seen on the player: the request redirects to a web page, presumably the firmware upgrade page of the player. Not checked further.
- Open it only on purpose: the page may start a firmware upgrade. Compare [`/update`](#get-update).

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

**Notes**

- Setting "Restore Playlists" (class `upload`) in `/Settings?id=managePlaylists`: restores the saved playlists from a backup. It replaces the saved playlists.
- Verified: uploading the backup just downloaded from [`/download_playlists_api`](#get-download_playlists_api) left the saved playlists unchanged.

### `GET /Version`

```
GET /Version
```

No parameters.

**Response format**

```xml
<version>v0.5.43</version>
```

### `GET /wificfg`

```
GET http://<player>:80/wificfg?noheader=1
```

| Parameter | Meaning |
|---|---|
| `noheader` | `1` = page without its header |

**Response format**

An HTML page (the web app "BluOS", the script loads the content).

**Notes**

- Setting "WiFi" (`<webview>`) in `/Settings?id=player`.
- Verified: answers the HTML shell of the web app "BluOS" (like `/sharecfg`).

---

## 13. BluOS Controller UI

Screens and menus of the BluOS Controller (BluOS 4): the BluOS Controller asks the player for ready-made screen content under `/ui/…`. Every button and list entry carries the request it sends, so these answers show which player requests a screen uses. For other clients the endpoints of the other sections are the stable ones.

Common answer structure (verified):

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

Action types: `player-link` (send the player request in `URI`), `browse` (load another `/ui` screen or a context menu), `context-browse`, `webpage` (open a web page, e.g. `/redirectToCp?…`), `setting` (open `/Settings?id=…`), `confirmation` (ask first, then send `URI`), `deep-link` (navigation inside the BluOS Controller, e.g. `/settings`, `/add-preset`, `/edit-queue`, `/reorder-presets`, `/customise-screen`, `/music-service/LocalMusic` – not player endpoints), `reorder`, `add`.

| Endpoint | Function | Official | Verified |
|---|---|:---:|:---:|
| `GET /ui/action` | change a display option of a screen | | |
| `GET /ui/browseContext` | header of a browse page (e.g. a playlist with play / shuffle buttons) | | ✓ |
| `GET /ui/browseGenres` | genre screen of a source | | ✓ |
| `GET /ui/browseGrouped` | list of a library menu entry with letters / pages | | ✓ |
| `GET /ui/browseMenuGroup` | menu of a source | | ✓ |
| `GET /ui/BrowseObjects` | list of objects of a browse request (e.g. the saved playlists) | | ✓ |
| `GET /ui/clearUsageHistory` | clear the "recent" rows of the home screen | | ✓ |
| `GET /ui/Configuration` | configuration of the BluOS Controller screens | | ✓ |
| `GET /ui/ContextMenu` | context menu of an object (play, add, edit, delete) | | ✓ |
| `GET /ui/Favourites` | favourites of a source | | ✓ |
| `GET /ui/Home` | home screen of the BluOS Controller | | ✓ |
| `GET /ui/myPlaylistsRow` | row "My playlists" of the home screen per source | | ✓ |
| `GET /ui/News` | news screen | | ✓ |
| `GET /ui/nowPlayingCM` | context menu of the playing item | | ✓ |
| `GET /ui/presets` | preset screen of the BluOS Controller | | ✓ |
| `GET /ui/prf` | runs a player request for the BluOS Controller | | ✓ |
| `GET /ui/Queue` | queue screen of the BluOS Controller | | ✓ |
| `GET /ui/queueItemCM` | context menu of a queue entry | | ✓ |
| `GET /ui/RecentlyPlayed` | recently played screen | | ✓ |
| `GET /ui/resolveSoviURL` | resolve a "Sovi" URL (meaning not known) | | ✓ |
| `GET /ui/Search` | search screen | | ✓ |
| `GET /ui/Sources` | list of sources (navigation drawer) | | ✓ |

### `GET /ui/action`

```
GET /ui/action?Cstyle=<style>~<type>&CBQ=<true|false>&Cfilter=<url>~<value>
```

| Parameter | Meaning |
|---|---|
| `Cstyle` | display style per object type, e.g. `grid~Playlist` (from the style selector of `/ui/BrowseObjects`) |
| `CBQ` | `true` / `false`: a BluOS Controller option (switched in the playlist screen; meaning not known) |
| `Cfilter` | filter of a list, e.g. `https://…/radio/podcasts/charts~it` (podcasts of Italy) |

**Response format**

Empty answer.

**Notes**

- Style selector of `/ui/BrowseObjects`; changes the display.
- `Cstyle` answers empty, but neither `grid~Playlist` nor `list~Playlist` changed the answer of [`/ui/BrowseObjects`](#get-uibrowseobjects): its style selector stayed `<styleSelector text="Display: Grid" type="grid">`. What the call changes is not known.

### `GET /ui/browseContext`

```
GET /ui/browseContext?service=<svc>&type=<type>&title=<title>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist` |
| `title` | title of the page |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&playlist=TTT&playlistid=` |

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

**Notes**

- Verified with a saved playlist: header with the playlist's play requests, then the tracks (10 per page, `nextLink` → `/ui/BrowseObjects?…&listContinuation=10…`). With a playlist name that does not exist the answer is `<error service="BluOS"><message>not found</message></error>`.

### `GET /ui/browseGenres`

```
GET /ui/browseGenres?service=<svc>&genreGroupId=Genres&title=<title>&url=<encoded request>&genre=<genre>&withGenre=1
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic` |
| `genreGroupId` | e.g. `Genres` |
| `url` | list of genres, e.g. `/library/v1/Genres?service=LocalMusic` |
| `genre`, `withGenre` | one genre (`withGenre=1`) |

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

**Notes**

- Genre list and the screen of one genre.
- Verified (library).

### `GET /ui/browseGrouped`

```
GET /ui/browseGrouped?service=<svc>&menuGroupId=<id>&browseIndex=<n>&title=<title>&type=<type>&url=<encoded request>
```

| Parameter | Meaning |
|---|---|
| `service` | source |
| `menuGroupId` | menu group, e.g. `LocalMusic`, `Genres` |
| `browseIndex` | index of the menu entry |
| `type` | `Artist`, `Album`, `Song`, `Composer` |
| `url` | list request with `offset`, e.g. `/library/v1/Artists?service=LocalMusic&offset=30`, `/library/v1/Songs?all=1&service=LocalMusic` |

**Response format**

```xml
<screen version="1" screenTitle="Artists" id="screen-LocalMusic-0" service="LocalMusic" navigationTitle="Library">
  <list offset="0" total="628">
    <index revision="196633">
      <item key="A" offset="0" length="43"/>
      <item key="B" offset="43" length="43"/>
      <!-- one <item> per letter -->
    </index>
    <item title="AC-DC">
      <action type="context-browse" URI="/Artists?service=LocalMusic&amp;artist=AC-DC" resultType="Artist" title="AC-DC"/>
      <contextMenu type="browse" URI="/ui/ContextMenu?artist=AC-DC&amp;context=Artist&amp;service=LocalMusic&amp;title=AC-DC" resultType="contextMenu"/>
    </item>
    <!-- 30 entries per page -->
  </list>
</screen>
```

**Notes**

- Artists, albums, songs and composers of the library; the BluOS Controller loads pages of 30 with `offset`.
- Verified (628 artists): the letter index gives the offset of every letter, the BluOS Controller loads the pages it needs with `offset`.
- Albums of a genre (verified 2026-11-15, as the BluOS Controller asks them): `/ui/browseGrouped?browseIndex=2&menuGroupId=Genres&service=LocalMusic&title=Albums&type=Album&url=<encoded /library/v1/Albums?genre=…&service=LocalMusic>`. Answer: `<list offset="0" total="165">`, letter index, 30 `item` elements per page with `title` (album), `subTitle` (artist), `subSubTitle` ("12 Tracks"), `image`, `<action URI="/Albums?service=…&album=…&artist=…">`, `<playAction URI="/Add?playnow=1&service=…&album=…&artist=…">`, `<contextMenu URI="/ui/ContextMenu?…context=Album…">` (no favourite state, no add-to-queue URL); next page via `<nextLink>` (`…&listContinuation=30…`); sort menu with `&sort=alpha|recent|year|decade` in the url. 27 KB per page.

### `GET /ui/browseMenuGroup`

```
GET /ui/browseMenuGroup?service=<svc>&menuGroupId=<id>&title=<title>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `LocalMusic`, `TuneIn`, `RadioParadise`, `Airable` |
| `menuGroupId` | sub menu, e.g. `LocalMusic-Favourites` |

**Response format**

```xml
<screen version="1" id="screen-LocalMusic" service="LocalMusic" navigationIcon="/images/LibraryIcon.png?style=Default" navigationTitle="Library">
  <row id="LocalMusic-0" title="Artists" solidBackground="false">
    <action type="browse" URI="/ui/browseGrouped?browseIndex=0&amp;menuGroupId=LocalMusic&amp;service=LocalMusic&amp;title=Artists&amp;type=Artist&amp;url=%2Flibrary%2Fv1%2FArtists%3Fservice%3DLocalMusic" resultType="screen" title="Artists"/>
  </row>
  <row id="LocalMusic-1" title="Albums" solidBackground="false">
    <action type="browse" URI="/ui/browseGrouped?browseIndex=1&amp;…&amp;type=Album&amp;url=%2Flibrary%2Fv1%2FAlbums%3Fservice%3DLocalMusic" resultType="screen" title="Albums"/>
  </row>
  <!-- Songs, Genres, Playlists, Composers, Folders, Favourites, New … -->
</screen>
```

**Notes**

- First screen of a source in the BluOS Controller.
- Verified (library).

### `GET /ui/BrowseObjects`

```
GET /ui/BrowseObjects?service=<svc>&menuGroupId=<id>&type=<type>&browseIndex=<n>&url=<encoded browse request>
```

| Parameter | Meaning |
|---|---|
| `service` | source, e.g. `BluOS` |
| `menuGroupId` | menu group of `/Services`, e.g. `BluOS` |
| `type` | object type, e.g. `Playlist` |
| `browseIndex` | index of the menu entry, e.g. `0` |
| `category`, `title`, `listContinuation` | sub category (radio), screen title, next page (`1` or the offset) |
| `url` | URL-encoded browse request, e.g. `/Playlists?service=BluOS&myPlaylists=1` |

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

**Notes**

- Verified with the saved BluOS playlists. Other `url` values seen in `/ui/Home` and `/ui/Sources`: `/Albums?recent=1` (library, USB), `/RadioBrowse` (TuneIn, Radio Paradise, Airable).

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

- Used by `/ui/Home` and `/ui/RecentlyPlayed`; deletes the history.
- Verified with `stations=1`.

### `GET /ui/Configuration`

```
GET /ui/Configuration
```

No known parameters.

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

**Notes**

- Verified. Lists the BluOS Controller's entry screens; the BluOS Controller asks it first when it connects. `/ui/News`, `/ui/Search`, `/ui/nowPlayingCM` and `/ui/resolveSoviURL` are only known from this list.

### `GET /ui/ContextMenu`

```
GET /ui/ContextMenu?context=<context>&sourceContext=<context>&service=<svc>&type=<type>&id=<id>&name=<name>&title=<title>&playlist=<name>&album=<album>&artist=<artist>&isFavourite=1&url=<url>&image=<image>&volume=<0–100>&noFavCMItems=1
```

| Parameter | Meaning |
|---|---|
| `context`, `sourceContext` | object type of the menu: `Playlist`, `Album`, `Artist`, `Genre` (with `genre`), `Song` (with `filename`), `Folder` (with `path`) |
| `type` | e.g. `preset` |
| `service` | source of the object |
| `id`, `name`, `title`, `playlist`, `album`, `artist`, `isFavourite`, `url`, `image`, `volume` | the object's own attributes, e.g. of a preset, a playlist or an album |
| `noFavCMItems` | `1` = without favourite entries |

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

**Notes**

- Verified with a playlist: entries Play now, Shuffle, Add next, Add last, Delete with their requests (`/Add?…`, `/Delete?name=…&service=BluOS`). The menu is built from the parameters alone – the playlist is not checked.
- More variants seen in `/ui/Home`: albums (`context=Album&album=…&artist=…[&isFavourite=1]`), `noFavCMItems=1` (no favourite entries).

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

**Notes**

- Verified (library): one row per type (Artists, Albums, …) with the favourites and their browse / context menu requests.

### `GET /ui/Home`

```
GET /ui/Home
```

No known parameters.

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

**Notes**

- Verified: rows for teasers, most used sources, presets, recent stations, recently played and the BluOS playlists; every entry with its play request (e.g. `/Play?url=…`, `/Preset?id=…`, `/Load?…`).

### `GET /ui/myPlaylistsRow`

```
GET /ui/myPlaylistsRow?service=<svc>
```

| Parameter | Meaning |
|---|---|
| `service` | `LocalMusic` or the USB id |

**Response format**

Empty when the source has no playlists (verified); with playlists presumably a `<row>` like the playlist rows of [`/ui/Home`](#get-uihome).

**Notes**

- Verified: empty answer when the source has no playlists (no row on the home screen).

### `GET /ui/News`

```
GET /ui/News
```

Parameters not known.

**Response format**

```xml
<screen version="1" screenTitle="News &amp; Updates" id="screen-news" refreshOnPlayerChange="true">
  <list id="news"></list>
</screen>
```

**Notes**
- Verified (empty list).

### `GET /ui/nowPlayingCM`

```
GET /ui/nowPlayingCM
```

No known parameters.

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

**Notes**

- Context menu of the playing item (from [`/ui/Configuration`](#get-uiconfiguration)); the BluOS Controller asks it when the now playing screen opens its menu.
- Verified (a library track): Favourite via `/ui/prf?cgsc=1&u=/AddFavourite?fn=…`, Add to playlist via `/AddToPlaylistOptions?service=…&songid=…`.

### `GET /ui/presets`

```
GET /ui/presets
```

No known parameters.

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

**Notes**

- Verified.

### `GET /ui/prf`

```
GET /ui/prf?u=<encoded request>&a=<encoded parameters>&t=1&cgsc=1
```

| Parameter | Meaning |
|---|---|
| `cgsc` | seen as `1` (with `/AddFavourite` in `/ui/queueItemCM`); meaning not known |
| `u` | URL-encoded player request, e.g. `/Add?playlist=TTT&playnow=1&service=BluOS&shuffle=1` |
| `a` | extra parameters for the rest of a list, e.g. `cursor=last&expr=maria&listindex=0&nextlist=1&playnow=1&service=LocalMusic&where=last` (play a search hit and queue the other hits) |
| `t` | seen as `1` |

**Response format**

The answer of the passed request, e.g. `<volume db="-54.2" offsetDb="0" mute="0" …>16</volume>` for `u=%2FVolume`.

**Notes**

- Runs the given request for the BluOS Controller.
- Verified with `u=%2FVolume`.

### `GET /ui/Queue`

```
GET /ui/Queue?offset=<n>
```

| Parameter | Meaning |
|---|---|
| `offset` | first entry, e.g. `0` |

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

**Notes**

- Verified.

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

**Notes**

- Verified: entries like Favourite (`/ui/prf?cgsc=1&u=/AddFavourite?fn=…`), Add to playlist (`/AddToPlaylistOptions?service=…&songid=…`).

### `GET /ui/RecentlyPlayed`

```
GET /ui/RecentlyPlayed
```

No known parameters.

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

**Notes**

- Verified: recently played playlists, albums, stations with `objectType` and their requests; "Clear" sends `/ui/clearUsageHistory?queued=1`.

### `GET /ui/resolveSoviURL`

```
GET /ui/resolveSoviURL
```

The parameter for the URL is not known.

**Response format**

Without a URL the text `invalid URL scheme: ` (no XML).

**Notes**
- Listed in [`/ui/Configuration`](#get-uiconfiguration). Verified without parameters; it expects a URL with a special scheme ("Sovi", presumably the internal name of BluOS).

### `GET /ui/Search`

```
GET /ui/Search?q=<text>&forService=<svc>&service=<svc>&CsearchService=<svc>
```

| Parameter | Meaning |
|---|---|
| `q` | search text |
| `forService` | search in one source, e.g. `LocalMusic`, `TuneIn` |
| `service` | the same, used by the source selector of the answer |
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

**Notes**

- The BluOS Controller sends a new request while the text is typed; results open with `/ui/browseContext` (e.g. `type=Artist&url=/Artists?…`).
- Verified (library). The source selector uses `service=LocalMusic` as well.

### `GET /ui/Sources`

```
GET /ui/Sources
```

No known parameters.

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

**Notes**

- Verified. Inputs with their play requests, music sources with their browse screens.
