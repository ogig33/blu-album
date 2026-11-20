#!/bin/zsh
# Lists album folders (one album per folder) whose FLAC files have no ALBUMARTIST tag.
# Searches the given folder and all its subfolders. Needs metaflac (brew install flac).
#
# Usage:  ./find-missing-albumartist.sh <music folder>
# Output: NONE  <folder>  (no file of the album has ALBUMARTIST)
#         PART  <folder>  (some files of the album have no ALBUMARTIST)
#         ERR   <file>    (metaflac could not read the file)
# The list goes to stdout, the summary to stderr – e.g. "… > missing.txt" keeps only the list.

setopt extendedglob nullglob

root=${1:?Usage: ${0:t} <music folder>}
root=${root%/}
[[ -d $root ]] || { print -u2 "Not a folder: $root"; exit 1 }
err=$(ls -- "$root" 2>&1 >/dev/null) || { print -u2 "Cannot read the folder: $err"; exit 1 }
command -v metaflac >/dev/null || { print -u2 "metaflac not found – install it with: brew install flac"; exit 1 }

albums=0 none=0 part=0 errs=0

for dir in $root $root/**/*(/); do
  files=($dir/*.(#i)flac(.))
  files=(${files:#*/._*})          # skip macOS metadata files (._*) on network shares / USB drives
  (( ${#files} )) || continue
  (( albums++ ))

  without=0
  for f in $files; do
    if ! tag=$(metaflac --show-tag=ALBUMARTIST "$f" 2>/dev/null); then
      print "ERR   $f"
      (( errs++ ))
      continue
    fi
    [[ -z ${tag#*=} ]] && (( without++ ))   # no tag or empty value
  done

  rel=${dir#$root/}; [[ $dir == $root ]] && rel=.
  if (( without == ${#files} )); then
    print "NONE  $rel"
    (( none++ ))
  elif (( without )); then
    print "PART  $rel  ($without of ${#files} files)"
    (( part++ ))
  fi
done

print -u2 "\n$albums albums checked: $none without ALBUMARTIST, $part partly without, $errs unreadable files."
