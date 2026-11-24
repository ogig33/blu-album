# BluAlbum library guidance

How to tag your music library and set up cover art for the best experience with BluAlbum – and with every other BluOS client.

BluAlbum shows what the player has indexed: it reads no files itself and gets no album data from the internet. A well-tagged library with good covers is therefore the key to a good album wall.

## Checklist

1. The music on a network share, a local share or a USB drive – see [Music storage](#music-storage).
2. Keep tags consistent with a tagging app – see [Tags](#tags).
3. The cover as a separate JPEG file in the album folder - see [Cover art](#cover-art)

## Music storage

BluOS supports several options of integrating local music libraries. BluAlbum supports all of them.

|                    | Network share | Local share | USB drive, "Server Mode" on | USB drive, "Server Mode" off |
| ------------------ | ------------- | ----------- | --------------------------- | ---------------------------- |
| Where the music is | SMB network share | A folder on the computer running the BluOS Controller desktop app | A drive plugged into a player | A drive plugged into the player |
| BluOS Controller music library settings | Network shares | Local shares | Enable Server Mode = on | Enable Server Mode = off |
| Share with BluOS players in local network| Yes | Yes (while your computer runs) | Yes | No |
| Music library updates|Update on share, then reindex |Update on share, then reindex|Unplug from Player, plug into Computer and update, plug into Player, reindex | Unplug from Player, plug into Computer and update, plug into Player, reindex|
| Service listing    | Under "Library" | Under "Library" | Under "Library" | Under "USB" |
| Favourites support | Yes | Yes | Yes | No (not supported by BluOS) |

Recommendations:
- keep your albums on a network share, or on a USB drive with "Enable Server Mode" on.

References:
- https://support.bluos.net/hc/en-us/articles/360000469948-How-do-I-connect-music-on-my-NAS-PC-or-iTunes-Shared-Music-to-BluOS
- https://support.bluos.net/hc/en-us/articles/360037137354-USB-Server-Mode-How-to-connect-external-USB-Library-to-the-BluOS-Players
- https://support.bluos.net/hc/en-us/articles/360000465747-How-USB-Storage-Differs-From-A-Local-Library-when-Server-Mode-is-disabled

## Tags

BluOS reads the following tags. The last column says what BluAlbum does with them.

| Tag | Meaning | Effect in BluAlbum |
| --- | --- | --- |
| `ALBUM` | Name of the album | Album title. Together with the album artist it identifies the album: keep both the same on every track, or the album may appear more than once. Give different editions of an album different names (e.g. "Remastered", "Hi-Res"). |
| `ALBUMARTIST` | Artist the album is listed under | Artist below the cover. Found by the search area Artist (BluAlbum matches it itself; the player's search ignores it). Use one name for all compilations (e.g. "Various Artists") to keep them together; you find a compilation in BluAlbum by its title, its album artist or the artist of one of its tracks. |
| `ARTIST` | Artist of the track | Shown next to a track in the album popup when it differs from the album artist (e.g. on compilations); found by the search area Artist, so a compilation is found by the artist of one of its tracks. |
| `TITLE` | Name of the track | Track list of the album popup. Not searched: the search finds albums, and the player matches their title and artists only. |
| `TRACK` | Number of the track on the album (or disc) | Order of the track list. |
| `DISCNUMBER` | Disc of the track on albums with several discs | Disc headers in the album popup. Without it all discs run on in one list. |
| `YEAR` (date) | Release date | Year next to the album, decade chips. Albums without a year are missing from the decade chips. BluOS keeps one year per album: use the same date on every track. |
| `GENRE` | Genre of the track | Genre chips: every genre of the library becomes a chip, and a genre chip shows the albums with songs of that genre. Use one genre per album, the same on every track, and keep the list of genres short. |
| `COVER` | Cover embedded in the file | Not recommended, see [Cover art](#cover-art). |
| `COMPOSER` | Composer of the track | Search: a composer's name finds the albums with songs of that composer. |
| `REPLAYGAIN` | Loudness levelling | Not used by BluAlbum; the player applies it (listening mode setting in the BluOS Controller app). |
| `COMPILATION` | Marks a track of a compilation | Not used by BluAlbum: the player offers no compilation filter. Use the album artist instead (see `ALBUMARTIST`). |

Recommendations:
- A tagging app keeps tags and covers consistent across the whole library. There are several apps to help you with that, e.g. [MusicBrainz Picard](https://picard.musicbrainz.org/)
- Use one folder per album, to fill the tags as described above
- After tagging, let the player Reindex music collection

References:
- https://support.bluos.net/hc/en-us/articles/360042352294-What-is-Metadata
- https://support1.bluesound.com/hc/en-us/articles/201232676-What-is-Replay-Gain-What-are-the-different-Replay-Gain-modes

## Cover art

BluAlbum lives from album covers. There are 2 options how BluOS handles cover art:

|                               | Optimize Artwork on     | Optimize Artwork off |
| ----------------------------- | ----------------------- | -------------------- |
| Cover file < 600 KB           | No resizing             | The original image   |
| Cover file 600 KB - 4MB       | Resized to 600 × 600 px | Not shown            |
| Cover file > 4 MB             | Not shown               | Not shown            |
| Performance impact            | Reindexing takes longer | No impact  |


Recommendations:
- Save covers as a separate folder.jpg file in the album folder, below 600 KB (the resolution is not limited to 1200x1200 contrary to documentation)
- Turn off "Optimize Artwork" in the BluOS Controller app
- After changing the "Optimize Artwork" settings, it is best to rebuild the index on the player's diagnostics page.

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
| An MQA album is missing from the quality chips | BluOS bug: its album filter leaves out some MQA albums (seen with BluOS 4.18.18) | None; find the album with All or the search |
| Too many genre chips | Many different or very specific genres | Use one genre per album from a short list |
| All discs of an album in one list | No `DISCNUMBER` tag | Add the disc number |
| No heart on the albums of a USB drive | "USB Server Mode" off: the player offers no favourites for the drive | Turn "USB Server Mode" on, or move the albums to a network share |
| "No genres found" when connecting | The player has not finished indexing | Wait, then reconnect |
