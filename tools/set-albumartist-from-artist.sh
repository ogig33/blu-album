#!/bin/zsh
# Sets ALBUMARTIST to the ARTIST of the album for FLAC files without ALBUMARTIST (one album per folder).
# A folder is only changed when all its FLAC files have the same single ARTIST value.
# Existing ALBUMARTIST values are never overwritten. Searches the folder and all subfolders.
# Needs metaflac (brew install flac).
#
# Usage:  ./set-albumartist-from-artist.sh <music folder>           dry run: only shows what would change
#         ./set-albumartist-from-artist.sh --apply <music folder>   writes the tags
# Output: SET   <folder>  -> <artist>  (n files)     (WOULD SET in a dry run)
#         SKIP  <folder>  <reason>
#         ERR   <file>    metaflac could not read / write the file
# Back up the library before using --apply. After writing, let the player reindex the library.

setopt extendedglob nullglob

apply=0
[[ $1 == --apply ]] && { apply=1; shift }
root=${1:?Usage: ${0:t} [--apply] <music folder>}
root=${root%/}
[[ -d $root ]] || { print -u2 "Not a folder: $root"; exit 1 }
err=$(ls -- "$root" 2>&1 >/dev/null) || { print -u2 "Cannot read the folder: $err"; exit 1 }
command -v metaflac >/dev/null || { print -u2 "metaflac not found – install it with: brew install flac"; exit 1 }

# Prints the non-empty values of a tag, one per line.
values() { setopt localoptions pipefail; metaflac --show-tag=$1 "$2" | while IFS= read -r l; do [[ -n ${l#*=} ]] && print -r -- "${l#*=}"; done }

albums=0 set=0 skipped=0 errs=0
verb="WOULD SET"; (( apply )) && verb="SET"

for dir in $root $root/**/*(/); do
  files=($dir/*.(#i)flac(.))
  files=(${files:#*/._*})          # skip macOS metadata files (._*) on network shares / USB drives
  (( ${#files} )) || continue
  (( albums++ ))
  rel=${dir#$root/}; [[ $dir == $root ]] && rel=.

  # Read ARTIST and ALBUMARTIST of every file.
  artist="" reason="" todo=()
  for f in $files; do
    if ! a=("${(@f)$(values ARTIST "$f" 2>/dev/null)}") || ! aa=("${(@f)$(values ALBUMARTIST "$f" 2>/dev/null)}"); then
      reason="unreadable file ${f:t}"; print "ERR   $f"; (( errs++ )); break
    fi
    a=(${a:#}); aa=(${aa:#})        # drop empty elements
    if (( ${#a} == 0 )); then reason="no ARTIST in ${f:t}"; break; fi
    if (( ${#a} > 1 )); then reason="several ARTIST values in ${f:t}"; break; fi
    if [[ -z $artist ]]; then artist=$a[1]
    elif [[ $a[1] != $artist ]]; then reason="different ARTIST values ($artist / $a[1])"; break; fi
    if (( ${#aa} == 0 )); then todo+=($f)
    elif [[ ${#aa} -gt 1 || $aa[1] != $artist ]]; then reason="ALBUMARTIST differs from ARTIST in ${f:t}"; break; fi
  done

  if [[ -n $reason ]]; then
    print "SKIP  $rel  $reason"
    (( skipped++ )); continue
  fi
  (( ${#todo} )) || continue        # every file already has the right ALBUMARTIST

  print "$verb  $rel  -> $artist  (${#todo} files)"
  (( set++ ))
  (( apply )) || continue
  for f in $todo; do
    metaflac --remove-tag=ALBUMARTIST --set-tag="ALBUMARTIST=$artist" "$f" || { print "ERR   $f"; (( errs++ )) }
  done
done

print -u2 "\n$albums albums checked: $set ${verb:l}, $skipped skipped, $errs errors.$( (( apply )) || print ' Dry run – nothing written, use --apply to write.')"
