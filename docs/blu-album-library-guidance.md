# BluAlbum music library configuration guidance

Guidance how to maintain your music library for best experience with BluAlbum.

---

## BluOS tag support

- `TITLE`	--> The name of the song
- `ARTIST` --> The name of the contributing artist on the song
- `ALBUM`	--> The name of the album this song is from
- `ALBUMARTIST` --> The name of the artist you would like the album to be listed under. This is useful for compilation albums to mark as "Various Artists."
- `TRACK`	--> The number of tracks on the album
- `GENRE`	--> The genre of the song or album 
- `DISCNUMBER` --> If using a multiple-disk album, this tag can be used to identify which disk the song is from
- `COVER`	--> The album artwork for this song. This image file will need to be less than 600 Kb in size.
- `YEAR` --> release date of the track/album (available from album detail view in BluOS controller app)
- `COMPOSER` --> composer of the track (available in the library navigation in BluOS controller app)
- `REPLAYGAIN` --> tags to level set loudness of tracks (available as part of listening mode setting in BluOS controller app)
- `COMPILATION` --> flag to indicate if the track is part of a compilation album (only exposed via BluOS API)

References:
https://support.bluos.net/hc/en-us/articles/360042352294-What-is-Metadata
https://support1.bluesound.com/hc/en-us/articles/201232676-What-is-Replay-Gain-What-are-the-different-Replay-Gain-modes


---

## BluOS Artwork support

There are 2 choices available:

**Optimize Artwork enabled:**

- resizes cover art to 600x600 pixel if:
  - size is between 600 KB and 4 MB or
  - PNG file format
- JPG files less than 600 KB are not resized

**Optimize Artwork disabled:**

- shows cover art if
  - file sizes less than 600 KB and
  - resolution is less than 1200×1200
- other covers are ignored

References:
https://support.bluos.net/hc/en-us/articles/360000368827-Why-are-some-of-my-Album-Cover-Art-too-large-or-missing


---

## Recommendations

Here are a few recommendations for best experience with BluAlbum and other BluOS clients:

1. put all files of an album into one folder
2. do not embed the cover into music files, but as a dedicated file, max 600 KB size and 1200x1200 resolution
3. Use Beets to maintain the BluOS supported tags and cover art of your collection https://github.com/beetbox/beets
4. Disable `Optimize artwork` setting in BluOS Controller app