# BluOS – browse and library endpoints (explored)

Checked systematically on 2026-11-14 on a Bluesound Powernode, BluOS 4.18.18, API v0.5.43,
library on a network share (`service=LocalMusic`) and a USB drive (`service=<USB id>`).
84 requests, **GET on read endpoints only**, no commands.

Sources of the parameters: `/Services` (the player's self-description: `browseRequest`,
`requestParameter`, `requestItemParameter`, `genreItemParameter`, `filter`, `sort`, `search`),
the app code and the Bruno collection.

Notation of the structures: `element ×n @attribute = "sample text"`; indentation = nesting.
Paths and share names in the samples are shortened.

## Summary

| Endpoint | Result | For BluAlbum |
|---|---|---|
| `/Browse` | menu tree with ready-made keys, play URLs and (optional) context menus | main source; answers with context menus are very large |
| `/Playlists` | saved playlists, one request, no paging | alternative to `/Browse` for the playlist chips (no play URL) |
| `/Artwork` | **301** to port 11004 `/library/v1/Artwork`; with `followRedirects=1` the image itself | used this way |
| `/Artists`, `/Genres`, `/Albums`, `/Songs`, `/Composers`, `/Folders` | **302** to port 11004 `/library/v1/<same>` with the same parameters | no endpoints of their own, only redirects → use `/library/v1/…` directly |
| `/Songs?service=BluOS&playlist=<name>` | exception: songs of a saved playlist (no redirect), 10 per page | not used |
| `/library/v1/Albums` | albums; **empty** without a filter; filters `section`, `recent`, `category`, `quality`+`section`, `genre`+`section`, `artist`, `album`+`artist`, `composer` | partly used |
| `/library/v1/Artists` | artist names, only with `section`, `category`, `genre`+`section`, `artist` | not used |
| `/library/v1/Songs` | songs with technical data; `album`+`artist`, `artist`, `composer`; `section` / `genre` paged | album popup |
| `/library/v1/Composers` | composers, paged without a filter (51 per page) | not used |
| `/library/v1/Artwork` | the image itself (200, `image/jpeg`); albums only | same as `/Artwork?…&followRedirects=1` |
| `/library/v1/Genres` | all genre names in one request, no filter has an effect | alternative to the genre list via `/Browse` (but without keys) |
| `/library/v1/Folders` | folder tree (`path=`) | outside the album concept |
| additionally `/library/v1/Search` | artists, albums, songs for a search term, **at most 25 each**, no paging | too short as a replacement for the search |

General:
- The root of every `/library/v1` answer carries `id` (library: a fixed number, USB: `1`) and
  `service`, plus all filters passed as attributes.
- `limit` and `start` are **ignored** with `section=`: a section always comes complete
  (section "A": 143 albums, also with `limit=5`). `limit=500` in the app therefore has no effect.
- `sort=` (according to `/Services`: `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate`)
  gives an empty answer for albums – sorting is apparently done by the BluOS app.
- Paging: `/library/v1` with `<nextlink>` (full URL of the next page), `/Browse` with `nextKey`.

## 1. `/Browse`

Parameters: `key` (key from an earlier answer; no key = top menu), `q` (search term, only with a
`searchKey`), `withContextMenuItems=0|1`.

The root is always `browse @type @serviceName @serviceIcon @searchKey` (top menu: only `@type`);
`@type` tells what the items are: `menu`, `sections`, `genres`, `playlists`, `tracks`,
`contextMenu`, `albums`.

| key | Answer | Size |
|---|---|---:|
| (none) | `browse @type="menu"` · `item ×9 @browseKey @text @image @type @playURL @inputType` (sources, playlists, inputs, radio) | 1.2 KB |
| `LocalMusic:` | `item ×7 @browseKey @text @type` (Artists, Albums, Songs, Genres, Playlists, Composers, Favourites) | 1.0 KB |
| `…bySection:Album/…` | `@type="sections"` · `item ×27 @browseKey @text @text2 @type` – **`text2` = number of albums in the section**; USB: only the 9 filled sections | 4.4 KB |
| `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | like Album, with counts | 4–5 KB |
| `…S:Album/…&section=A` | `@type="albums"` · `item ×143 @browseKey @contextMenuKey @playURL @text @text2 @tracks @image @type` + one `contextMenu > item @actionURL @text @type` each | **204 KB** (68 KB without context menus) |
| `LocalMusic:GG/Genres` | `@type="genres"` · `item ×34 @browseKey @text @type` | 3.4 KB |
| `LocalMusic:MG/LocalMusic-Genre?genre=…` | empty (genre menus have other keys, taken from the genre list) | 0.2 KB |
| `LocalMusic:MG/LocalMusic-Artist?artist=…` | `item ×2` (albums, songs of the artist) | 0.4 KB |
| `LocalMusic:MG/LocalMusic-Favourites` | `item ×4` (favourites by type) | 0.7 KB |
| `LocalMusic:MG/LocalMusic-Album?album=…&artist=…` | `@type="tracks" @playURL` · `item ×9 @contextMenuKey @playURL @autoplayURL @text @duration @image @type` + one `contextMenu > item ×4` each | **16.8 KB** (7.2 KB without context menus) |
| `LocalMusic:CM/LocalMusic-Album?album=…&artist=…` | `@type="contextMenu"` · `item ×5 @actionURL @text @type` (`favourite-add/-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last`) | 1.0 KB |
| `LocalMusic:Search&q=love` | `@type="menu"` · `item ×4 @browseKey @text @type` (links to artists, albums, songs, composers) | 0.7 KB |
| `LocalMusic:Playlist/…imported=1` | empty (no imported playlists) | 0.2 KB |
| `<USB id>:` | like the library, `item ×6` | 0.9 KB |

`withContextMenuItems=0` drops only the `contextMenu` children; `browseKey`, `playURL`,
`autoplayURL` and `contextMenuKey` stay (Bruno E09). No difference for the top menu.

## 2. Category endpoints

### `/Playlists`
Parameters: none needed; `service=BluOS`, `start` / `end` have no effect.
```
playlists @service="BluOS"
  name ×3 @image = "<playlist name>"
```
One request, 0.7 KB. No play URL – that comes from `/Browse` (playlist chips).

### `/Artwork`
`/Artwork?service=…&album=…&artist=…` → **301** to `http://<player>:11004/library/v1/Artwork?…`.
With `&followRedirects=1` → **200**, `image/jpeg` (19 KB in the sample).

### `/Artists`, `/Genres`, `/Albums`, `/Songs`, `/Composers`, `/Folders`
All variants (no parameters, `service`, `start` / `end`, `artist`, `genre`, `album`+`artist`)
→ **302** to `http://<player>:11004/library/v1/<endpoint>?<same parameters>`.
They are aliases of the library endpoints on another port (a different origin for the browser,
plus a detour).

Exception **`/Songs?service=BluOS&playlist=<name>`** (no redirect):
```
songs @service="BluOS" @playlist
  song ×10 @service
    art, alb, title, track, date, time, fn, quality
  nextlink = "/Songs?playlist=…&offset=10"
```

## 3. Library endpoints

### `/library/v1/Albums`

| Parameters | Result |
|---|---|
| none / only `service` | empty |
| `section=A` | all albums of the section (143), 16.5 KB |
| `section=A&limit=5`, `&start=5` | like `section=A` – ignored |
| `sort=year&section=A`, `sort=recent` | empty |
| `recent=1` | 50 newest albums + `nextlink` |
| `category=FAVOURITES` | favourite albums, one request |
| `quality=cd&section=A` | CD albums of the section (140) |
| `quality=cd` without section | empty |
| `genre=Jazz&section=A` | jazz albums of the section (15); empty without section |
| `artist=Dire+Straits` | **all 8 albums of the artist**, one request |
| `album=…&artist=…` | one album including `cover` |
| `composer=…` | albums with songs of the composer |

Three answer forms:
```
albums @section @id @service                     (section, quality, genre)
  sections
    section @name
      album ×143 @tracks @date @isFavourite
        title = "A Broken Frame"
        art   = "Depeche Mode"

albums @recent @id @service                      (recent, category)
  album ×50 @isFavourite
    alb = "…"
    art = "…"
  nextlink = "/library/v1/Albums?count=50&recent=1&service=LocalMusic&start=50"

albums @artist @id @service                      (artist)
  artist @name
    album ×8 @tracks @date @isFavourite = "Alchemy"

albums @album @artist @id @service               (album+artist, composer)
  album @tracks @date @isFavourite
    title, art, cover = "/Artwork?service=…&album=…&artist=…"
```
Note: depending on the form the title is `title`, `alb` or the text of `album`.
No genre in any form.

### `/library/v1/Artists`
Empty without a filter. `section=A` → `sections > section @name > art ×43 @isFavourite`;
`category=FAVOURITES` → `art @isFavourite`; `genre=Jazz&section=A` → artists of the genre;
`artist=…` → only the name.

### `/library/v1/Songs`

| Parameters | Result |
|---|---|
| only `service` | empty |
| `album=…&artist=…` | all songs of the album with technical data (see below) |
| `artist=…` | all 63 songs of the artist, one request, 28 KB |
| `composer=…` | songs of the composer |
| `section=A&limit=5` | 5 songs + `nextlink` (here `limit` works) |
| `genre=Jazz&section=A` | 50 songs + `nextlink` |
| `category=FAVOURITES` | empty (no song favourites) |

```
songs @album @artist @id @service
  song ×9 @samplerate @samplebits @channels @bitrate @atype
    songID, art, alb, title, track, date, time, quality, fn
    (depending on the song also: discno, composer, compilation, albumartist)
```
The lists (`section`, `genre`) lack the technical attributes and `songID`, `track`, `date`,
`time`. **No genre.**

### `/library/v1/Composers`
Without a filter: `composer ×51` + `nextlink` (pages of 51). `section=A` → `sections > section >
composer ×19`. `genre=…&section=…` → composers of the genre.

### `/library/v1/Artwork`
`album=…&artist=…` → 200, `image/jpeg` (the same image as `/Artwork`). Only `artist=` → 200
without content.

### `/library/v1/Genres`
```
genres @id @service @length="34"
  genre ×34 = "Alternative Rock"
```
One request, 1 KB, all genre names of the source (USB: 3). `category=FAVOURITES`, `album` and
`artist` are ignored.

### `/library/v1/Folders`
Without `path`: `folders > subfolders > folder` (root of the share); with `path=` the sub folders
and `songs`. Outside the album concept.

### Additionally: `/library/v1/Search?service=…&expr=…`
```
search @expr @id @service
  artists @expr @id @service > artist ×25 > name
  albums  @expr @id @service > album ×25 @tracks > title, art, cover
  songs   @expr @id @service > song ×25 > title, art, alb, fn, track, time, date, quality, …
```
One request, but **at most 25 per type and no `nextlink`** (also with `expr=a`). The search via
`/Browse` returns all hits.

## 4. Conclusions for BluAlbum

Decided 2026-11-14: play / queue / favourite URLs come from `/Browse`; only the existing
`/library/v1` lists (New, Favourites, quality) build them by the fixed pattern in `libAlbum()`.

1. **Do not use the old category endpoints** – they are only redirects to `/library/v1`.
2. All and the genre albums stay on `/Browse` (URLs from the player). Moving them to
   `/library/v1/Albums` would need ≈ 12× less data (16.5 KB instead of 204 KB per section) but
   self-built URLs – not wanted.
3. **Genre albums**: `/Browse` asks only the filled sections (counts in the section list);
   `/library/v1/Albums?genre=…` would always need all 27 – `/Browse` stays cheaper.
4. ✅ **Quality chips ask only filled sections**, from the album section list that All and the
   statistics share (USB: 9 of 27 → 18 requests less per quality chip).
5. **Artist click** (step B): via the `/Browse` artist key `MG/LocalMusic-Artist?artist=…`
   (keeps the player's URLs) instead of the All list. `/library/v1/Albums?artist=…` would be one
   request, but without URLs.
6. ✅ **Album popup**: track list with `withContextMenuItems=0` (7.2 instead of 16.8 KB); the
   app does not use the song context menus.
7. **Genre chips**: names in one request via `/library/v1/Genres` are possible, but loading the
   albums needs the keys from `/Browse … GG/Genres` – no gain.
8. **Search** stays on `/Browse`, because `/library/v1/Search` stops at 25 hits.
9. Every new variant goes into Bruno ("3 Explore") before it is built in
   (rule "one implementation, checked first").
