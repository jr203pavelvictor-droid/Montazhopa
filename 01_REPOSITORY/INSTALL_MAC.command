#!/bin/bash
set -eu
mz_source_root="$(cd -- "$(dirname -- "$0")" && pwd)"
mz_source="$mz_source_root/com.victor.motionviewer"
mz_base="$HOME/Library/Application Support/Adobe/CEP/extensions"
mz_target="$mz_base/com.victor.motionviewer"
mz_stage="$mz_base/com.victor.motionviewer.install-staging"
mz_backup="$mz_base/com.victor.motionviewer.previous"
if /usr/bin/pgrep -f '/Adobe Premiere Pro[^/]*/Contents/MacOS/Adobe Premiere Pro([[:space:]]|$)' >/dev/null 2>&1; then
 echo 'Close Adobe Premiere Pro completely, then run this installer again.'
 exit 1
fi
if [ ! -f "$mz_source/CSXS/manifest.xml" ]; then
 echo 'Extract the entire ZIP first.'
 exit 1
fi
(cd "$mz_source_root" && /usr/bin/shasum -a 256 -c checksums.sha256)
mkdir -p "$mz_base"
rm -rf -- "$mz_stage"
/usr/bin/ditto "$mz_source" "$mz_stage"
mz_moved=0
mz_committed=0
restore_on_error() {
 if [ "$mz_committed" -eq 0 ] && [ "$mz_moved" -eq 1 ] && [ -d "$mz_backup" ]; then
  rm -rf -- "$mz_target"
  mv -- "$mz_backup" "$mz_target"
 fi
}
trap restore_on_error EXIT
if [ -d "$mz_backup" ]; then rm -rf -- "$mz_backup"; fi
if [ -d "$mz_target" ]; then mv -- "$mz_target" "$mz_backup"; mz_moved=1; fi
mv -- "$mz_stage" "$mz_target"
for mz_runtime in 9 10 11 12; do
 /usr/bin/defaults write "com.adobe.CSXS.$mz_runtime" PlayerDebugMode -string 1
done
mz_committed=1
echo 'Montazhopa 3 installed for the current macOS account.'
echo 'Start Premiere: Window > Extensions (Legacy) > Montazhopa.'
echo 'The previous panel is saved in com.victor.motionviewer.previous.'
echo 'Internet updates are OFF. Personal assets are stored separately.'
