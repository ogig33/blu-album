# BluOS – Browse- und Bibliotheks-Endpoints (erkundet)

Systematisch geprüft am 14.11.2026 an einem Bluesound Powernode, BluOS 4.18.18, API v0.5.43,
Bibliothek auf einer Netzwerkfreigabe (`service=LocalMusic`) und ein USB-Laufwerk
(`service=<USB-ID>`). 84 Requests, **nur GET auf Lese-Endpoints**, keine Befehle.

Quellen für die Parameter: `/Services` (Selbstbeschreibung des Players: `browseRequest`,
`requestParameter`, `requestItemParameter`, `genreItemParameter`, `filter`, `sort`, `search`),
der App-Code und die Bruno-Collection.

Schreibweise der Strukturen: `element ×n @attribut = "Beispieltext"`; Einrückung = Verschachtelung.
Pfade und Freigabenamen in Beispielen sind gekürzt.

## Kurzfassung

| Endpoint | Ergebnis | Für BluAlbum |
|---|---|---|
| `/Browse` | Menübaum mit fertigen Schlüsseln, Play-URLs und (optional) Kontextmenüs | heute Hauptquelle; Antworten mit Kontextmenüs sind sehr groß |
| `/Playlists` | gespeicherte Playlists, ein Request, kein Paging | Alternative zu `/Browse` für Playlist-Chips |
| `/Artwork` | **301** auf Port 11004 `/library/v1/Artwork`; mit `followRedirects=1` direkt das Bild | so genutzt |
| `/Artists`, `/Genres`, `/Albums`, `/Songs`, `/Composers`, `/Folders` | **302** auf Port 11004 `/library/v1/<gleich>` mit denselben Parametern | keine eigenen Endpoints, nur Umleitungen → direkt `/library/v1/…` nutzen |
| `/Songs?service=BluOS&playlist=<Name>` | Ausnahme: Songs einer gespeicherten Playlist (kein Redirect), 10 pro Seite | nicht genutzt |
| `/library/v1/Albums` | Alben; ohne Filter **leer**, Filter `section`, `recent`, `category`, `quality`+`section`, `genre`+`section`, `artist`, `album`+`artist`, `composer` | teilweise genutzt; `artist=` neu interessant |
| `/library/v1/Artists` | Künstlernamen, nur mit `section`, `category`, `genre`+`section`, `artist` | nicht genutzt |
| `/library/v1/Songs` | Songs mit Technikdaten; `album`+`artist`, `artist`, `composer`; `section`/`genre` paginiert | Album-Popup |
| `/library/v1/Composers` | Komponisten, ohne Filter paginiert (51 pro Seite) | nicht genutzt |
| `/library/v1/Artwork` | das Bild selbst (200, `image/jpeg`); nur für Alben | gleichwertig zu `/Artwork?…&followRedirects=1` |
| `/library/v1/Genres` | alle Genre-Namen in einem Request, kein Filter wirkt | Alternative zur Genre-Liste über `/Browse` |
| `/library/v1/Folders` | Ordnerbaum (`path=`) | außerhalb des Album-Konzepts |
| zusätzlich `/library/v1/Search` | Künstler, Alben, Songs zum Suchbegriff, **je höchstens 25**, kein Paging | als Ersatz der Suche zu knapp |

Allgemein:
- Die Wurzel jeder `/library/v1`-Antwort trägt `id` (Bibliothek: eine feste Zahl, USB: `1`) und
  `service` sowie alle übergebenen Filter als Attribute.
- `limit` und `start` werden bei `section=` **ignoriert**: ein Abschnitt kommt immer vollständig
  (Abschnitt „A“: 143 Alben, auch mit `limit=5`). `limit=500` in der App hat also keine Wirkung.
- `sort=` (laut `/Services` `alpha`, `recent`, `year`, `decade`, `artist`, `artistDate`) liefert
  bei Alben ein leeres Ergebnis – die Sortierung ist offenbar Sache der BluOS-App.
- Paging: `/library/v1` mit `<nextlink>` (vollständige URL der nächsten Seite), `/Browse` mit
  `nextKey`.

## 1. `/Browse`

Parameter: `key` (Schlüssel aus einer vorherigen Antwort; ohne key = Hauptmenü),
`q` (Suchbegriff, nur mit einem `searchKey`), `withContextMenuItems=0|1`.

Wurzel immer `browse @type @serviceName @serviceIcon @searchKey` (Hauptmenü nur `@type`);
`@type` sagt, was die Einträge sind: `menu`, `sections`, `genres`, `playlists`, `tracks`,
`contextMenu`, `albums`.

| key | Antwort | Größe |
|---|---|---:|
| (keiner) | `browse @type="menu"` · `item ×9 @browseKey @text @image @type @playURL @inputType` (Quellen, Playlists, Eingänge, Radio) | 1,2 KB |
| `LocalMusic:` | `item ×7 @browseKey @text @type` (Artists, Albums, Songs, Genres, Playlists, Composers, Favourites) | 1,0 KB |
| `…bySection:Album/…` | `@type="sections"` · `item ×27 @browseKey @text @text2 @type` – **`text2` = Anzahl Alben im Abschnitt**; USB: nur die 9 nicht leeren Abschnitte | 4,4 KB |
| `…bySection:Artist/…`, `…Song/…`, `…Composer/…` | wie Album, mit Anzahlen | 4–5 KB |
| `…S:Album/…&section=A` | `@type="albums"` · `item ×143 @browseKey @contextMenuKey @playURL @text @text2 @tracks @image @type` + je `contextMenu > item @actionURL @text @type` | **204 KB** (ohne Kontextmenüs 68 KB) |
| `LocalMusic:GG/Genres` | `@type="genres"` · `item ×34 @browseKey @text @type` | 3,4 KB |
| `LocalMusic:MG/LocalMusic-Genre?genre=…` | leer (Genre-Menüs haben andere Schlüssel, aus der Genre-Liste) | 0,2 KB |
| `LocalMusic:MG/LocalMusic-Artist?artist=…` | `item ×2` (Alben, Songs des Künstlers) | 0,4 KB |
| `LocalMusic:MG/LocalMusic-Favourites` | `item ×4` (Favoriten nach Typ) | 0,7 KB |
| `LocalMusic:MG/LocalMusic-Album?album=…&artist=…` | `@type="tracks" @playURL` · `item ×9 @contextMenuKey @playURL @autoplayURL @text @duration @image @type` + je `contextMenu > item ×4` | **16,8 KB** (ohne Kontextmenüs 7,2 KB) |
| `LocalMusic:CM/LocalMusic-Album?album=…&artist=…` | `@type="contextMenu"` · `item ×5 @actionURL @text @type` (`favourite-add/-delete`, `add-now`, `add-shuffle`, `addAll-next`, `addAll-last`) | 1,0 KB |
| `LocalMusic:Search&q=love` | `@type="menu"` · `item ×4 @browseKey @text @type` (Links zu Künstlern, Alben, Songs, Komponisten) | 0,7 KB |
| `LocalMusic:Playlist/…imported=1` | leer (keine importierten Playlists) | 0,2 KB |
| `<USB-ID>:` | wie Bibliothek, `item ×6` | 0,9 KB |

`withContextMenuItems=0` lässt nur die `contextMenu`-Kinder weg; `browseKey`, `playURL`,
`autoplayURL` und `contextMenuKey` bleiben. Beim Hauptmenü kein Unterschied.

## 2. Category endpoints

### `/Playlists`
Parameter: keine nötig; `service=BluOS`, `start`/`end` ohne Wirkung.
```
playlists @service="BluOS"
  name ×3 @image = "<Playlist-Name>"
```
Ein Request, 0,7 KB. Keine Play-URL – die liefert `/Browse` (Playlist-Chips).

### `/Artwork`
`/Artwork?service=…&album=…&artist=…` → **301** auf `http://<player>:11004/library/v1/Artwork?…`.
Mit `&followRedirects=1` → **200**, `image/jpeg` (19 KB im Beispiel).

### `/Artists`, `/Genres`, `/Albums`, `/Songs`, `/Composers`, `/Folders`
Alle Varianten (ohne Parameter, `service`, `start`/`end`, `artist`, `genre`, `album`+`artist`)
→ **302** auf `http://<player>:11004/library/v1/<Endpoint>?<gleiche Parameter>`.
Es sind also Aliase der Bibliotheks-Endpoints auf einem anderen Port (für den Browser ein
anderer Origin, dazu ein Umweg).

Ausnahme **`/Songs?service=BluOS&playlist=<Name>`** (kein Redirect):
```
songs @service="BluOS" @playlist
  song ×10 @service
    art, alb, title, track, date, time, fn, quality
  nextlink = "/Songs?playlist=…&offset=10"
```

## 3. Library endpoints

### `/library/v1/Albums`

| Parameter | Ergebnis |
|---|---|
| keine / nur `service` | leer |
| `section=A` | alle Alben des Abschnitts (143), 16,5 KB |
| `section=A&limit=5`, `&start=5` | wie `section=A` – ignoriert |
| `sort=year&section=A`, `sort=recent` | leer |
| `recent=1` | 50 neueste Alben + `nextlink` |
| `category=FAVOURITES` | Favoriten-Alben, ein Request |
| `quality=cd&section=A` | CD-Alben des Abschnitts (140) |
| `quality=cd` ohne section | leer |
| `genre=Jazz&section=A` | Jazz-Alben des Abschnitts (15); ohne section leer |
| `artist=Dire+Straits` | **alle 8 Alben des Künstlers**, ein Request |
| `album=…&artist=…` | ein Album inkl. `cover` |
| `composer=…` | Alben mit Songs des Komponisten |

Drei Formen der Antwort:
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
Achtung: Titel heißt je nach Form `title`, `alb` oder ist der Text von `album`.
Kein Genre in keiner Form.

### `/library/v1/Artists`
Ohne Filter leer. `section=A` → `sections > section @name > art ×43 @isFavourite`;
`category=FAVOURITES` → `art @isFavourite`; `genre=Jazz&section=A` → Künstler des Genres;
`artist=…` → nur der Name.

### `/library/v1/Songs`

| Parameter | Ergebnis |
|---|---|
| nur `service` | leer |
| `album=…&artist=…` | alle Songs des Albums mit Technikdaten (siehe unten) |
| `artist=…` | alle 63 Songs des Künstlers, ein Request, 28 KB |
| `composer=…` | Songs des Komponisten |
| `section=A&limit=5` | 5 Songs + `nextlink` (hier wirkt `limit`) |
| `genre=Jazz&section=A` | 50 Songs + `nextlink` |
| `category=FAVOURITES` | leer (keine Song-Favoriten) |

```
songs @album @artist @id @service
  song ×9 @samplerate @samplebits @channels @bitrate @atype
    songID, art, alb, title, track, date, time, quality, fn
    (je nach Song zusätzlich: discno, composer, compilation, albumartist)
```
In den Listen (`section`, `genre`) fehlen die Technik-Attribute und `songID`, `track`, `date`,
`time`. **Kein Genre.**

### `/library/v1/Composers`
Ohne Filter: `composer ×51` + `nextlink` (Seiten zu 51). `section=A` → `sections > section >
composer ×19`. `genre=…&section=…` → Komponisten des Genres.

### `/library/v1/Artwork`
`album=…&artist=…` → 200, `image/jpeg` (dasselbe Bild wie `/Artwork`). Nur `artist=` → 200
ohne Inhalt.

### `/library/v1/Genres`
```
genres @id @service @length="34"
  genre ×34 = "Alternative Rock"
```
Ein Request, 1 KB, alle Genre-Namen der Quelle (USB: 3). `category=FAVOURITES`, `album`,
`artist` werden ignoriert.

### `/library/v1/Folders`
Ohne `path`: `folders > subfolders > folder` (Wurzel der Freigabe); mit `path=` die Unterordner
und `songs`. Außerhalb des Album-Konzepts.

### Zusätzlich: `/library/v1/Search?service=…&expr=…`
```
search @expr @id @service
  artists @expr @id @service > artist ×25 > name
  albums  @expr @id @service > album ×25 @tracks > title, art, cover
  songs   @expr @id @service > song ×25 > title, art, alb, fn, track, time, date, quality, …
```
Ein Request, aber **höchstens 25 je Typ und kein `nextlink`** (auch bei `expr=a`). Die Suche
über `/Browse` liefert dagegen alle Treffer.

## 4. Folgerungen für BluAlbum (noch nicht umgesetzt)

1. **Die alten Category endpoints nicht nutzen** – es sind nur Umleitungen auf `/library/v1`.
2. **Alben-Listen über `/library/v1/Albums` statt `/Browse`**: gleiche Anzahl Requests, aber
   ein Abschnitt hat 16,5 KB statt 204 KB (≈ 12× weniger Daten für „All“ und die Genre-Alben).
   Play-, Queue- und Favoriten-URLs baut die App für New, Favoriten und Qualität schon heute
   nach festem Muster (`libAlbum()`).
3. **Genre-Alben**: `/Browse` fragt nur die nicht leeren Abschnitte ab (Anzahlen in der
   Abschnittsliste), `/library/v1/Albums?genre=…` bräuchte immer alle 27 – für Genres bleibt
   `/Browse` bei der Anzahl günstiger. Die Kontextmenüs braucht die App dort heute für „＋“ und ♥
   auf den Kacheln; würden diese URLs wie bei `libAlbum()` nach Muster gebaut, reichte
   `withContextMenuItems=0` (≈ ⅓ der Datenmenge).
4. **Qualitäts-Chips nur für nicht leere Abschnitte abfragen**: Die Abschnittsliste mit den
   Anzahlen (`…bySection:Album`) wird beim Verbinden ohnehin geladen. Beim USB-Laufwerk sind nur
   9 von 27 Abschnitten belegt → je Qualitäts-Chip 18 Requests weniger.
5. **Künstler-Klick über `/library/v1/Albums?artist=…`**: 1 Request pro Quelle statt ≈ 38.
6. **Album-Popup**: Trackliste mit `withContextMenuItems=0` (7,2 statt 16,8 KB); die
   Song-Kontextmenüs nutzt die App nicht.
7. **Genre-Chips**: Namen in einem Request über `/library/v1/Genres` möglich; für das Laden der
   Alben braucht es aber die Schlüssel aus `/Browse … GG/Genres`, daher kein Gewinn.
8. **Suche** bleibt bei `/Browse`, weil `/library/v1/Search` bei 25 Treffern abschneidet.
9. Jede neue Variante vor dem Einbau als Request in Bruno („3 Explore“) aufnehmen
   (Regel „eine Implementierung, vorher geprüft“).
