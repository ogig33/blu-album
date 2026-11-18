# BluOS music library

Guidance for maintenance of music library for best integration with BluOS.

---

## Tagging support

Tagging support is described here:
https://support.bluos.net/hc/en-us/articles/360042352294-What-is-Metadata

- `TITLE`	--> The name of the song
- `ARTIST` --> The name of the contributing artist on the song
- `ALBUM`	--> The name of the album this song is from
- `ALBUMARTIST` --> The name of the artist you would like the album to be listed under. This is useful for compilation albums to mark as "Various Artists."
- `TRACK`	--> The number of tracks on the album
- `GENRE`	--> The genre of the song or album 
- `DISCNUMBER` --> If using a multiple-disk album, this tag can be used to identify which disk the song is from
- `COVER`	--> The album artwork for this song. This image file will need to be less than 600 Kb in size.

Undocumented:

- `YEAR` --> release date of the track/album (available from album detail view in BluOS controller app)
- `COMPOSER` --> composer of the track (available in the library navigation in BluOS controller app)

### Todos

- Ensure ALBUMARTIST tag is maintained

---

## Artwork support

Artwork support is described here
https://support.bluos.net/hc/en-us/articles/360000368827-Why-are-some-of-my-Album-Cover-Art-too-large-or-missing

### Optimize Artwork enabled

- resizes cover art to 600x600 pixel if:
  - size is between 600 KB and 4 MB or
  - PNG file format
- JPG files less than 600 KB are not resized

### Optimize Artwork disabled

- shows cover art if
  - file sizes less than 600 KB and
  - resolution is less than 1200×1200
- other covers are ignored

### Approach

- use cover files placed in respective folders
- disable `Optimize artwork`
- resize covers to less than 600 KB and 1200x1200

