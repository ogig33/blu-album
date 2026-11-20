# BluAlbum music library configuration guidance

Guidance how to maintain your music library for best experience with BluAlbum.

## BluOS tag support

The following tags are imported from your music library by BluOS:

| Tag | Description |
| --- | --- |
| `TITLE` | The name of the song |
| `ARTIST` | The name of the contributing artist on the song |
| `ALBUM` | The name of the album this song is from |
| `ALBUMARTIST` | The name of the artist you would like the album to be listed under. This is useful for compilation albums to mark as "Various Artists." |
| `TRACK` | The number of the track on the album |
| `GENRE` | The genre of the song or album |
| `DISCNUMBER` | If using a multiple-disk album, this tag can be used to identify which disk the song is from |
| `COVER` | The album artwork for this song. This image file will need to be less than 600 Kb in size. |
| `YEAR` | Release date of the track/album (available from album detail view in BluOS controller app) |
| `COMPOSER` | Composer of the track (available in the library navigation in BluOS controller app) |
| `REPLAYGAIN` | Tags to level set loudness of tracks (available as part of listening mode setting in BluOS controller app) |
| `COMPILATION` | Flag to indicate if the track is part of a compilation album (only exposed via BluOS API) |

References:
- https://support.bluos.net/hc/en-us/articles/360042352294-What-is-Metadata
- https://support1.bluesound.com/hc/en-us/articles/201232676-What-is-Replay-Gain-What-are-the-different-Replay-Gain-modes


## BluOS Artwork support

BluOS has 2 options how to deal with cover art that has too big filesize or resolution:

**Optimize Artwork = enabled:**

- too big cover art is resized to 600x600 pixels
- conditions triggering resizing:
  - file size is between 600 KB and 4 MB or
  - PNG file format
- cover files larger than 4 MB are not shown

**Optimize Artwork = disabled:**

- too big cover art is not shown
- conditions of not showing cover art:
  - file sizes more than 600 KB

References:
- https://support.bluos.net/hc/en-us/articles/360000368827-Why-are-some-of-my-Album-Cover-Art-too-large-or-missing


## Recommendations

Here are a few recommendations for best experience with BluAlbum and other BluOS clients:

1. put all files of an album into one folder
2. do not embed the cover into music files, but as a dedicated file, max 600 KB size and 1200x1200 resolution
3. Use Beets to maintain the BluOS supported tags and cover art of your collection https://github.com/beetbox/beets
4. Disable `Optimize artwork` setting in BluOS Controller app