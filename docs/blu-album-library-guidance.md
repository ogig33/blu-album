# BluAlbum library guidance

How to tag your music library and set up cover art for the best experience with BluAlbum – and with every other BluOS client.

BluAlbum shows what the player has indexed: it reads no files itself and gets no album data from the internet. A well-tagged library with good covers is therefore the key to a good album wall.

## Checklist

1. One folder per album, with all its tracks.
2. The same `ALBUM`, `ALBUMARTIST`, `YEAR` and `GENRE` on every track of an album.
3. The cover as a separate JPEG file in the album folder, below 600 KB, as large in pixels as fits (typically 1000–1600 px).
4. "Optimize Artwork" off in the BluOS Controller app, then rebuild the index once.
5. Keep tags and covers consistent with a tagging app – see [Tags](#tags).

## Tags

BluOS reads the following tags. The last column says what BluAlbum does with them.

| Tag | Meaning | Effect in BluAlbum |
| --- | --- | --- |
| `ALBUM` | Name of the album | Album title. Together with the album artist it identifies the album: keep both the same on every track, or the album may appear more than once. Give different editions of an album different names (e.g. "Remastered", "Hi-Res"). |
| `ALBUMARTIST` | Artist the album is listed under | Artist below the cover; searched by the search field. Use one name for all compilations (e.g. "Various Artists"): BluOS has no compilation filter, so you find your compilations by searching for that name. |
| `ARTIST` | Artist of the track | Shown next to a track in the album popup when it differs from the album artist (e.g. on compilations); searched by the search field, so a compilation is found by the artist of one of its tracks. |
| `TITLE` | Name of the track | Track list of the album popup. Not searched: the search finds albums, and the player matches their title and artists only. |
| `TRACK` | Number of the track on the album (or disc) | Order of the track list. |
| `DISCNUMBER` | Disc of the track on albums with several discs | Disc headers in the album popup. Without it all discs run on in one list. |
| `YEAR` (date) | Release date | Year next to the album, decade chips. Albums without a year are missing from the decade chips. BluOS keeps one year per album: use the same date on every track. |
| `GENRE` | Genre of the track | Genre chips: every genre of the library becomes a chip, and a genre chip shows the albums with songs of that genre. Use one genre per album, the same on every track, and keep the list of genres short. |
| `COVER` | Cover embedded in the file | Not recommended, see [Cover art](#cover-art). |
| `COMPOSER` | Composer of the track | Not used by BluAlbum; not searched either. |
| `REPLAYGAIN` | Loudness levelling | Not used by BluAlbum; the player applies it (listening mode setting in the BluOS Controller app). |
| `COMPILATION` | Marks a track of a compilation | Not used by BluAlbum: the player offers no compilation filter. Use the album artist instead (see `ALBUMARTIST`). |

The quality chips (HD, CD, MQA) and the quality tag in the player bar come from the audio files themselves (format, sample rate, bit depth); there is nothing to tag.

A tagging app keeps tags and covers consistent across the whole library. One option is [MusicBrainz Picard](https://picard.musicbrainz.org/), a free app for Windows, macOS and Linux that matches your albums with the [MusicBrainz](https://musicbrainz.org/) database and writes tags and covers; for how to install and use it, see the [Picard documentation](https://picard-docs.musicbrainz.org/). BluAlbum is not affiliated with Picard or any other tagging app and gives no support for them. Whatever tool you use, set it up to keep one folder per album, to fill the tags as described above and to save covers as separate files (see [Cover art](#cover-art)).

After tagging, let the player rescan the library ("Reindex music collection" in the music library settings of the BluOS Controller app). A full "Rebuild Index" is only needed after changing "Optimize Artwork".

References:
- https://support.bluos.net/hc/en-us/articles/360042352294-What-is-Metadata
- https://support1.bluesound.com/hc/en-us/articles/201232676-What-is-Replay-Gain-What-are-the-different-Replay-Gain-modes

## Cover art

BluAlbum lives from album covers. How sharp they are depends on the player setting "Optimize Artwork" (music library settings of the BluOS Controller app) at the time the library index was built.

| | Optimize Artwork on (default) | Optimize Artwork off |
| --- | --- | --- |
| Stored cover | At most 600 × 600 px | The original image |
| Cover file larger than 600 KB | Resized to 600 × 600 px (up to 4 MB) | Grey placeholder instead of the cover |
| PNG cover | Resized to 600 × 600 px | – (use JPEG) |
| Cover file larger than 4 MB | Not shown | Grey placeholder |
| Result in BluAlbum | Covers look blurry at large cover sizes | Sharp covers at every cover size |

The pixel size is not the limit: covers up to 1600 × 1600 px are served, as long as the file is below 600 KB.

### Recommended setup

1. Save every cover as a separate JPEG file in the album folder (not embedded in the audio files), below 600 KB, as large in pixels as fits – typically 1000–1600 px at a JPEG quality of about 85–90.
2. In the BluOS Controller app, turn "Optimize Artwork" off.
3. Rebuild the index on the player's diagnostics page (BluOS Controller app: Help › Diagnostics, or `http://<player IP>/diagnostics` in a browser) › "Rebuild Index". A normal rescan ("Reindex music collection") keeps the covers stored before, so without this step the covers stay at 600 px.
4. Wait until indexing has finished, then reload BluAlbum.

Larger covers take longer to load: about 250–500 KB per cover at 1400–1600 px against 70–170 KB at 600 px. If the album wall loads too slowly on your network, use a smaller cover size in BluAlbum's settings or smaller cover files.

References:
- https://support.bluos.net/hc/en-us/articles/360000368827-Why-are-some-of-my-Album-Cover-Art-too-large-or-missing
## Troubleshooting

| Symptom in BluAlbum | Likely cause | Fix |
| --- | --- | --- |
| Grey placeholder instead of the cover | Cover file larger than 600 KB with "Optimize Artwork" off | Make the cover file smaller, then reindex |
| No cover at all | No cover file in the album folder, or (with "Optimize Artwork" on) larger than 4 MB | Add a cover file below 600 KB |
| Covers look blurry | "Optimize Artwork" on, or the index was not rebuilt after turning it off | Turn it off and rebuild the index (see [Recommended setup](#recommended-setup)) |
| An album appears twice or with tracks missing | `ALBUM` or `ALBUMARTIST` differ between its tracks | Give all tracks the same album and album artist |
| An album is missing from the decade chips | No `YEAR` tag | Add the release date |
| Too many genre chips | Many different or very specific genres | Use one genre per album from a short list |
| All discs of an album in one list | No `DISCNUMBER` tag | Add the disc number |
| "No genres found" when connecting | The player has not finished indexing | Wait, then reconnect |
