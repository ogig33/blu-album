# BluAlbum – Klicks und API-Calls

Stand: BluAlbum 0.8.0 (Code-Analyse von `blualbum.html` und Messung gegen den echten Player).
Alle Player-Requests sind HTTP GET auf `http://<player>:11000`, Antworten XML.
`/Browse` wird immer mit `withContextMenuItems=1` aufgerufen (liefert pro Album die Aktionen
"zur Warteschlange", "Favorit" usw.).

Legende: **S** = pro Musikquelle (Bibliothek und USB werden beide abgefragt, also ×2 bei zwei
Quellen), **+sync** = 0,5–0,9 s später zusätzlich `/Status` + `/Volume` (siehe Abschnitt 9).

## Gemessen (14.11.2026, Powernode, Bibliothek + USB, 37 Genres, Chrome)

Nur lesende Aktionen; Befehle wie Play, Favorit oder Warteschlange ändern wurden nicht am echten
Player gemessen (Zahlen dafür aus dem Code). Bilder (`/Artwork`) sind nicht mitgezählt.

| Aktion | Requests | davon | Dauer |
|---|---:|---|---:|
| Verbinden, frischer Browser (kein Genre-Cache) | **585** | **564 Genre-Crawl** (37 Genre-Menüs, 37 Abschnittslisten, 37 „flache“ Albumlisten, 453 Abschnitte), 21 Rest | 6,9 s |
| Verbinden, Genre-Cache vorhanden | **21** | 1 Hauptmenü, 1 Playlists, 2 Quellen-Menüs, 2 Genre-Listen, **8 Statistik**, 2 Favoriten, `/Settings`, `/GitVersion`, `/Version`, `/Status`, `/Volume` | 4,2 s |
| Chip New | 5 | `/library/v1/Albums` mit Folgeseiten | 1,1 s |
| Chip Favourites | 2 | `/library/v1/Albums` | 0,9 s |
| Chip CD, erstes Mal | **54** | 27 Abschnitte × 2 Quellen | 1,1 s |
| Chip CD, zweites Mal | 0 | Sitzungs-Cache | |
| Chip All, erstes Mal | **38** | 2 Abschnittslisten + 36 Abschnitte | 1,7 s |
| Genre-Chip nach Neuladen der Seite | **38** | Genre-Daten kommen nicht aus dem localStorage-Cache, nur die Genre-Zuordnung | 1,6 s |
| Künstlername (All schon geladen) | 0 | | |
| Album-Popup | 2 | Trackliste + Songs | 1,0 s |
| Suche „love“ (Enter) | 6 | 2 Suchen + 4 Folge-Requests für die Album-Abschnitte | 1,5 s |
| Warteschlange öffnen | 1 | `/Playlist` | |
| Einstellungen + About | 0 | | |
| 60 s nichts tun | 0 | Long-Poll-Request bleibt offen (bis 100 s) | |

### Nach Schritt A (gleiche Messung)

| Aktion | vorher | nachher |
|---|---:|---:|
| Verbinden, frischer Browser | 585 | **9** |
| Verbinden, erneut | 21 | **9** |
| Chip CD, erstes Mal | 54 | **38** (2 Abschnittslisten + 27 Bibliothek + 9 USB) |
| Chip All (nach CD) | 38 | **36** (Abschnittslisten schon da) |
| Genre-Chip | 38 | **36** (ohne Versuch mit der flachen Liste) |
| Album-Popup | 2 (≈ 21 KB) | 2 (≈ 11 KB) |
| About öffnen (einmal je Verbindung/Quellenwahl) | 0 | 8 (Versionen + Statistik) |
| Play, ＋, Track, Skip, Back, Eintrag | 3 | 1 (Code; nicht am Player gemessen) |

Die Tabellen unten beschreiben noch den Stand **vor** Schritt A; geändert hat sich: kein
Genre-Crawl und keine Genre-Zeile, kein `sync()`, Statistik/Versionen erst im About-Popup,
Qualitäts-Chips nur für belegte Abschnitte, Trackliste mit `withContextMenuItems=0`.

## 1. Seite laden

| Aktion | API-Calls | Zweck |
|---|---|---|
| Datei öffnen | keine | Einstellungen aus localStorage, Einstellungs-Panel öffnet sich |

## 2. Verbinden (Button „Connect“ oder Enter im IP-Feld)

| # | Endpoint und Parameter | Anzahl | Zweck |
|---|---|---|---|
| 1 | `/Browse` (ohne key) | 1 | Hauptmenü: Musikquellen (Bibliothek, USB) und Schlüssel der gespeicherten Playlists |
| 2 | `/Browse?key=<Playlists>` | 1 (+ Folgeseiten `nextKey`) | Playlist-Chips |
| 3 | `/Status` (ohne timeout) | 1 | Play-Zustand (`sync()`) |
| 4 | `/Volume` | 1 | Lautstärke (`sync()`) |
| 5 | `/Settings` | 1 | Raumname (Titel, Verbindungszeile), Netzwerkfreigaben, Artwork-Optimierung, Server-Modus (Einstellungs-Panel) |
| 6 | `/GitVersion` | 1 | BluOS-Version (nur im About-Popup sichtbar) |
| 7 | `/Version` | 1 | API-Version (nur im About-Popup sichtbar) |
| 8 | `/Status?timeout=100&etag=…` | Dauerschleife | Long-Polling „Now playing“ (Abschnitt 9) |
| 9 | `/Browse?key=<Quelle>` | S | Menü der Quelle: Schlüssel für Genres, Alben, Suche |
| 10 | `/Browse?key=<Quelle>/Genres` | S | Genre-Liste → Genre-Chips |
| 11 | `/Browse?key=…bySection:Album` / `…Artist` / `…Song` / `…Composer` | 4 × S | Zähler für die Bibliotheks-Statistik (nur im About-Popup sichtbar) |
| 12 | **Genre-Crawl** (nur ohne Cache in localStorage), pro Genre und Quelle: `/Browse?key=<Genre>` → `/Browse?key=<Genre>…bySection:Album` → `/Browse?key=<…ohne section>` (+ `nextKey`-Seiten); falls das weniger Alben liefert als die Abschnitte zählen: jeder Abschnitt einzeln | ≥ 3 × Genres × S | Welche Genres hat ein Album? Nur für die Genre-Zeile im Album-Popup. Ergebnis wird in localStorage gespeichert |
| 13 | `/library/v1/Albums?service=<svc>&category=FAVOURITES` (+ `nextlink`-Seiten) | S | Standardansicht „Favoriten“ |
| 14 | `/Playlist?start=0&end=199` | 1 (nur wenn Warteschlange angepinnt) | Warteschlange laden, sobald `/Status` die Playlist-ID meldet |

Bilder (`/Artwork?service=…&album=…&artist=…&followRedirects=1`) lädt der Browser zusätzlich
für jedes sichtbare Cover (lazy, aus dem Browser-Cache wenn schon geladen). Sie sind in den
Zahlen nicht enthalten.

## 3. Chips (Filterleiste)

| Klick | API-Calls | Anzahl | Cache | Zweck |
|---|---|---|---|---|
| **All** | `/Browse?key=…bySection:Album` (Abschnitte), dann pro Abschnitt `/Browse?key=…&section=X` (+ `nextKey`-Seiten) | ≈ 1 + 27 × S | Sitzung | Alle Alben A–Z |
| **♥ Favourites** | `/library/v1/Albums?service=<svc>&category=FAVOURITES` | S | keiner, immer frisch | Favoriten des Players |
| **New** | `/library/v1/Albums?service=<svc>&recent=1` (+ `nextlink`, max. 200 Alben) | S | keiner | Zuletzt hinzugefügte Alben |
| **HD / CD / MQA** | `/library/v1/Albums?service=<svc>&quality=hr\|cd\|mqa&limit=500&section=#…Z` | 27 × S | Sitzung | Qualitätsfilter (funktioniert nur pro Abschnitt) |
| **Genre** | keine, wenn der Crawl in dieser Sitzung lief; sonst `/Browse` Genre → Abschnitte → Alben (wie Crawl, nur ein Genre) | 0 oder ≥ 3 × S | Sitzung | Alben eines Genres |
| **Playlist-Chip** | Play-URL der Playlist aus `/Browse` (z. B. `/Load?service=BluOS&name=…`) +sync; bei offener Warteschlange nach 0,6 s `/Playlist?start=0&end=199` | 1 + 2 (+1) | – | Playlist abspielen |

## 4. Album-Kachel im Raster

| Klick | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| Cover oder Titel | `/Browse?key=<svc>:MG/LocalMusic-Album?album=…&artist=…` und parallel `/library/v1/Songs?service=<svc>&album=…&artist=…` | 2 | Album-Popup: Trackliste mit Play-URLs und Dauer; Jahr, Qualität, Format, Bit/kHz, Bitrate, Künstler pro Track |
| ▶ Play (Hover) | `/Add?playnow=1&service=<svc>&album=…&artist=…` +sync | 1 + 2 | Album sofort abspielen |
| ＋ (Hover) | `/Add?album=…&artist=…&playnow=-1&service=<svc>&where=last` +sync | 1 + 2 | Album ans Ende der Warteschlange |
| ♥ (Hover, nur Bibliothek) | `/AddFavourite?album=…&artist=…&service=<svc>` bzw. `/DeleteFavourite?…`, danach `/Browse?key=<svc>:CM/LocalMusic-Album?…[&isFavourite=1]` | 2 | Favorit setzen/entfernen, dann Kontextmenü neu lesen (aktueller Zustand + URL für den nächsten Klick) |
| Künstlername | wie **All**, wenn „All“ in dieser Sitzung noch nicht geladen war; sonst keine | 0 oder ≈ 1 + 27 × S | Alle Alben des Künstlers (Filter auf die All-Liste) |
| Zufallsalbum ▶ / ＋ | wie ▶ / ＋ | 1 + 2 | Zufälliges Album der aktuellen Ansicht |

### Album-Popup im Detail (Beispiel „Brothers In Arms“, Bibliothek)

Beim Öffnen laufen zwei Requests parallel, dazu lädt der Browser das Cover:

1. `/Browse?withContextMenuItems=1&key=LocalMusic%3AMG%2FLocalMusic-Album%3Falbum%3DBrothers%2BIn%2BArms%26artist%3DDire%2BStraits`
   (key = `LocalMusic:MG/LocalMusic-Album?album=Brothers+In+Arms&artist=Dire+Straits`, 16,8 kB)
   - `<browse type="tracks" playURL="/Add?service=LocalMusic&album=…&artist=…&playnow=1" serviceName="Library" searchKey="LocalMusic:Search">`
   - pro Track ein `<item type="track">` mit `text` („1. So Far Away“), `duration` (Sekunden),
     `playURL` (`/Add?playnow=1&file=…`), `autoplayURL` (`/Add?service=…&listindex=0&nextlist=1&where=last&cursor=last&playnow=1&album=…&artist=…`),
     `image`, `contextMenuKey` (`…CM/LocalMusic-Song?…&filename=…&title=…`) und `<contextMenu>`
     mit `favourite-add`, `add-now`, `add-next`, `add-last` für den einzelnen Song
   - **genutzt:** `text`, `duration`, `autoplayURL` (sonst `playURL`) für den Track-Klick
2. `/library/v1/Songs?service=LocalMusic&album=Brothers+In+Arms&artist=Dire+Straits` (4,1 kB)
   - `<songs album artist id="720919" service>`
   - pro Song: Attribute `samplerate`, `samplebits`, `channels`, `bitrate`, `atype`; Elemente
     `songID`, `art`, `alb`, `title`, `track`, `date`, `time`, `quality`, `fn` (Dateipfad)
   - **genutzt:** `date` (Jahr), `quality`, `atype`, `samplebits`, `samplerate`, `channels`,
     `bitrate` (Technik-Zeile), `art` (Künstler pro Track, wenn abweichend), `title` (Zuordnung zum Track)
3. Cover: `/Artwork?service=LocalMusic&album=…&artist=…&followRedirects=1` (Bild, meist schon im Browser-Cache)

**Kein Genre** in beiden Antworten, auch nicht im Album- oder Song-Kontextmenü.

### `/library/v1` erkundet (14.11.2026, nur lesend, noch nicht in Bruno)

`/Services` beschreibt für die Bibliothek weitere Parameter. Ergebnisse am Player:

| Request | Ergebnis |
|---|---|
| `/library/v1/Albums?service=LocalMusic&album=…&artist=…` | 1 Album: `tracks`, `date`, `isFavourite`, `title`, `art`, `cover` – **kein Genre** |
| `/library/v1/Albums?service=LocalMusic&artist=Dire+Straits` | **Alle 8 Alben des Künstlers in einem Request**, nicht in Abschnitte geteilt: `<artist name><album tracks date isFavourite>Titel</album>…` |
| `/library/v1/Genres?service=LocalMusic` | Liste der 34 Genre-Namen der Bibliothek |
| `/library/v1/Genres?service=LocalMusic&album=…&artist=…` | Filter wird ignoriert, wieder alle 34 Genres |
| `/library/v1/Albums?service=LocalMusic&genre=Jazz` | leer – Genre-Filter nur mit `section` |
| `/library/v1/Albums?service=LocalMusic&genre=Jazz&section=A` | 15 Alben; für ein Genre also 27 Requests (wie der Qualitätsfilter) |
| `…&genre=Jazz&sort=artist` / `sort=recent` | leer |

Folgerungen:
- Ein Genre pro Album liefert auch `/library/v1` nicht; über `genre=` wären es 27 × 34 ≈ 920
  Requests – mehr als der heutige Crawl.
- **Neuer Vorschlag:** Klick auf einen Künstlernamen über `/library/v1/Albums?artist=…` statt über
  die All-Liste: 1 Request pro Quelle statt ≈ 38, wenn „All“ noch nicht geladen war.

## 5. Album-Popup

| Klick | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| Track | `autoplayURL` bzw. `playURL` des Tracks aus `/Browse` (`/Add?…`) +sync | 1 + 2 | Ab diesem Track abspielen |
| Künstlername | wie Künstlername in Abschnitt 4 | 0 oder ≈ 1 + 27 × S | |
| Schließen ✕ / Klick daneben | keine | | |

## 6. Suche (Feld oben)

| Aktion | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| Tippen (ab 3 Zeichen, 800 ms Pause) oder Enter | `/Browse?key=<searchKey>&q=<Text>` | S | Suche des Players |
| … falls das Ergebnis keine Alben direkt enthält | `/Browse?key=<Alben-Link>` und pro Abschnitt `/Browse?key=…&section=X` (+ `nextKey`) | + 1 + Abschnitte | Alben aus dem Suchergebnis |
| Feld leeren | keine | | Vorherige Ansicht wieder anzeigen |

Beim Tippen startet erst ab 3 Zeichen und nach 800 ms Pause eine Suche (vorher: jede Pause
von 500 ms, auch bei 1–2 Zeichen). Ältere Ergebnisse werden verworfen, ihre Requests laufen
aber zu Ende.

## 7. Player-Leiste (Footer) und Vollbild

| Klick | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| ⏯ Play/Pause | `/Pause?toggle=1` | 1 | Umschalten; die Antwort enthält den neuen Zustand |
| ⏮ Zurück | `/Back` +sync | 1 + 2 | Vorheriger Track |
| ⏭ Weiter | `/Skip` +sync | 1 + 2 | Nächster Track |
| Fortschrittsbalken / Pfeiltasten | `/Play?seek=<Sekunden>` | 1 | Springen im Track |
| Lautstärke-Regler ziehen | `/Volume?level=<0–100>` | max. 1 pro 150 ms, + 1 beim Loslassen | Lautstärke |
| Lautstärke − / + | `/Volume?db=-2` bzw. `/Volume?db=2` | 1 | Lautstärke in 2-dB-Schritten |
| Cover im Footer | keine | | Vollbild öffnen |
| Klick ins Vollbild / Esc | keine | | Vollbild schließen |

## 8. Warteschlange (Button oben rechts)

| Klick | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| Anpinnen (öffnen) | `/Playlist?start=0&end=199` (+ weitere 200er-Seiten, max. 2000 Einträge) | 1+ | Warteschlange laden |
| Lösen (schließen) | keine | | |
| Eintrag | `/Play?id=<n>` +sync | 1 + 2 | Diesen Eintrag abspielen |
| ✕ Entfernen | `/Delete?id=<n>`, dann `/Playlist?…` | 2 (+1) | Eintrag entfernen, Liste neu laden |
| Shuffle | `/Shuffle?state=0\|1`, dann `/Playlist?…` | 2 (+1) | Zufallswiedergabe, Liste neu laden |
| Repeat | `/Repeat?state=0\|1\|2` | 1 | Wiederholen (Warteschlange / Track / aus) |
| Speichern | `/Save?name=<Name>`, dann `/Browse?key=<Playlists>` | 2 | Als Playlist speichern, Playlist-Chips neu laden |
| Playlist löschen | `/Delete?service=BluOS&name=<Name>`, dann `/Browse?key=<Playlists>` | 2 | Gespeicherte Playlist löschen |
| Leeren | `/Clear`, dann `/Playlist?…` | 2 (+1) | Warteschlange leeren |

(+1): Ändert sich dadurch die Playlist-ID, meldet das Long-Polling sie und die Warteschlange
wird ein zweites Mal geladen (Abschnitt 9).

## 9. Hintergrund (ohne Klick)

| Auslöser | API-Calls | Zweck |
|---|---|---|
| Dauerschleife nach dem Verbinden | `/Status?timeout=100&etag=<etag>` | Der Player hält die Anfrage bis zu 100 s offen und antwortet sofort bei einer Änderung (Titel, Position, Lautstärke, Shuffle, Repeat, Playlist-ID). Mindestens 1 s Abstand, nach Fehlern 5 s |
| Playlist-ID in `/Status` geändert, Warteschlange angepinnt | `/Playlist?start=0&end=199` | Warteschlange aktualisieren |
| `sync()` nach Befehlen (+sync) | `/Status` + `/Volume` | Play-Knopf und Lautstärke sofort aktualisieren |

## 10. Einstellungen und About

| Klick | API-Calls | Anzahl | Zweck |
|---|---|---|---|
| Zahnrad, Schließen, Design, Cover-Größe, Chip-Schalter | keine | | Nur Anzeige / localStorage |
| „Change“ (IP ändern) | keine | | Danach „Connect“ = komplettes Verbinden (Abschnitt 2) |
| Quellen-Schalter (Library / USB) | wie Verbinden ab #9: Quellen-Menüs, Genres, Statistik, Genre-Crawl (wenn diese Quellen-Kombination noch nicht im Cache ist), Favoriten | ≈ 2 × S + 4 × S + 1 × S (+ Crawl) | Quellen neu öffnen |
| „Reload“ (Genres) | Genre-Crawl ohne Cache | ≥ 3 × Genres × S | Genre-Zuordnung neu aufbauen |
| About | keine | | Zeigt die beim Verbinden geladenen Daten |
| „Check for updates“ | `https://api.github.com/repos/ogig33/blu-album/releases/latest` (nicht der Player) | 1 | Neueste Version auf GitHub |

## 11. Vorschläge zum Reduzieren (nach Wirkung sortiert)

| # | Vorschlag | Einsparung | Aufwand / Risiko |
|---|---|---|---|
| 1 | ✅ **Genre-Crawl beim Verbinden abschaffen.** Er dient nur der Genre-Zeile im Album-Popup. Die Antworten des Popups (`/Browse` Trackliste, `/library/v1/Songs`, Album- und Song-Kontextmenü) enthalten kein Genre (am Player geprüft). Varianten: (a) Genre-Zeile weglassen; (b) Zuordnung nebenbei aufbauen aus den Genre-Chips, die der Nutzer ohnehin anklickt (0 Extra-Requests, Zeile anfangs unvollständig); (c) Crawl nur auf Knopfdruck in den Einstellungen | **564** beim ersten Verbinden, ebenso bei „Reload“ und bei neuer Quellen-Kombination | Gering; (b) passt am besten zum „nur laden, was gebraucht wird“ |
| 2 | ✅ Falls der Crawl bleibt: **Versuch mit der „flachen“ Albumliste streichen** (`genreAlbums()`). Er war bei allen 37 Genres zu kurz, danach wurden doch alle Abschnitte geladen. Das ist ein Fallback, also gegen die Regel „eine Implementierung“ – in Bruno klären, welche Variante gilt | 37 pro Crawl, 2 pro Genre-Chip | Gering, Bruno-Prüfung vorher |
| 3 | ✅ **Statistik (8) und Versionen (2) erst beim Öffnen des About-Popups laden** | **10** pro Verbinden (21 → 11) | Gering; About zeigt dann kurz „…“ |
| 4 | ✅ **`sync()` streichen** (`/Status` + `/Volume` beim Verbinden und 0,5–0,9 s nach jedem Befehl). Das Long-Polling meldet jede Änderung sofort, `/Status` enthält auch `<volume>` | 2 pro Verbinden und **2 pro Befehl** (Play, ＋, Track, Skip, Back, Eintrag, Playlist) | Gering; vorher prüfen, dass der Long-Poll nach einem Befehl sofort antwortet |
| 5 | **Doppeltes Laden der Warteschlange vermeiden**: nach ✕, Shuffle, Leeren und Playlist-Chip lädt der Klick die Liste neu *und* die geänderte Playlist-ID im Long-Poll noch einmal. Nur noch über die Playlist-ID nachladen | 1 pro solchem Klick (bei offener Warteschlange) | Mittel; in Bruno prüfen, dass sich die Playlist-ID bei allen vier Aktionen ändert |
| 6 | **Genre-Chip nach Neuladen**: die Albumlisten der Genres werden nicht gecacht, nur die Zuordnung. Mit Vorschlag 1(b) entfällt das Thema; sonst die Alben pro Genre auch im Sitzungs-Cache halten | bis 38 pro Genre-Klick | Gering |
| 7 | ✅ **Suche**: erst ab 3 Zeichen und nach 800 ms statt 500 ms Pause; Enter sucht immer (umgesetzt) | ≈ 6 pro vermiedener Zwischensuche | – |
| 8 | Erste Anfrage von **All** (`…bySection:Album`) ist identisch mit der Statistik-Anfrage „Albums“ beim Verbinden – Antwort wiederverwenden | 2 beim ersten Klick auf All | Gering |
| 9 | ⏸ (zurückgestellt) **Favoriten-Chip** aus dem Cache zeigen, solange in BluAlbum kein ♥ geklickt wurde | 2 pro Klick | Änderungen aus der BluOS-App würden erst nach Neuverbinden sichtbar |
| 10 | **Herz**: Kontextmenü nach dem Umschalten nicht neu lesen; die Gegen-URL wird schon aus der benutzten URL abgeleitet | 1 pro ♥-Klick | Gering |
| 11 | **Album-Popup** pro Album in der Sitzung cachen | 2 pro erneutem Öffnen desselben Albums | Gering |
| 12 | ⏸ (zurückgestellt) **Qualitäts-Chips** (54) und **All** (38) sind durch die API vorgegeben (Filter nur pro Abschnitt). Höchstens über Sitzungen hinweg in localStorage cachen | 54 / 38 pro Sitzung | Daten können veralten; widerspricht „Werte kommen aus der API“ eher nicht, aber Frische leidet |

**Wirkung zusammen (Vorschläge 1, 3, 4):** erstes Verbinden 585 → ≈ 9 Requests, jedes weitere
Verbinden 21 → ≈ 9, jeder Wiedergabe-Befehl 3 → 1.

Nicht gemessen: Anzahl der Long-Poll-Antworten während der Wiedergabe (der Player war beim
Messen nicht im Album-Modus) und die schreibenden Befehle am echten Player.
