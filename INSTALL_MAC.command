#!/bin/bash
set -eu
umask 077
mz_source_root="$(cd -- "$(dirname -- "$0")" && pwd)"
mz_source="$mz_source_root/com.victor.motionviewer"
mz_base="$HOME/Library/Application Support/Adobe/CEP/extensions"
mz_system_base="/Library/Application Support/Adobe/CEP/extensions"
mz_data="$HOME/Library/Application Support/Montazhopa3"
mz_target="$mz_base/com.victor.motionviewer"
mz_backup="$mz_data/installation-backups/com.victor.motionviewer"
is_alto_panel() {
 [ -f "$1/CSXS/manifest.xml" ] && /usr/bin/grep -Eq "ExtensionBundleId[[:space:]]*=[[:space:]]*[\"']com[.]victor[.]motionviewer[\"']" "$1/CSXS/manifest.xml"
}
if /usr/bin/pgrep -f '/Adobe Premiere Pro[^/]*/Contents/MacOS/Adobe Premiere Pro([[:space:]]|$)' >/dev/null 2>&1; then
 echo 'Close Adobe Premiere Pro completely, then run this installer again.'
 exit 1
fi
if ! is_alto_panel "$mz_source"; then
 echo 'Extract the entire official ZIP first. The panel manifest is missing or has another identity.'
 exit 1
fi
if [ -e "$mz_target" ] && ! is_alto_panel "$mz_target"; then
 echo "Refusing to replace an unrelated folder: $mz_target"
 exit 1
fi
(cd "$mz_source_root" && /usr/bin/shasum -a 256 -c checksums.sha256)
# A system-wide copy can shadow the user installation. Report it before changing
# anything; this installer never elevates privileges or edits /Library.
for mz_candidate in "$mz_system_base"/*; do
 if is_alto_panel "$mz_candidate"; then
  echo 'Another Montazhopa/ALTO is installed for all users:'
  echo "$mz_candidate"
  echo 'Ask the administrator to move that copy outside Adobe/CEP/extensions, then run this user installer again.'
  exit 1
 fi
done
mkdir -p "$mz_base" "$mz_data/installation-backups"
mz_recovery="$(/usr/bin/mktemp -d "$mz_data/installation-backups/install-XXXXXX")"
mz_stage="$mz_recovery/new-panel"
mkdir "$mz_recovery/previous"
/usr/bin/ditto "$mz_source" "$mz_stage"
mz_committed=0
mz_installed=0
restore_on_error() {
 if [ "$mz_committed" -eq 0 ]; then
  if [ "$mz_installed" -eq 1 ]; then rm -rf -- "$mz_target"; fi
  for mz_saved in "$mz_recovery/previous"/*; do
   if [ -d "$mz_saved" ]; then mv -- "$mz_saved" "$mz_base/$(basename -- "$mz_saved")"; fi
  done
  if [ -d "$mz_recovery/older-backup" ]; then
   rm -rf -- "$mz_backup"
   mv -- "$mz_recovery/older-backup" "$mz_backup"
  fi
 fi
}
trap restore_on_error EXIT
# Preserve every same-ID user copy, including legacy .previous folders, outside
# the CEP discovery directory. Unrelated extensions and personal assets stay put.
mz_rollback_seed=''
for mz_candidate in "$mz_base"/*; do
 if is_alto_panel "$mz_candidate"; then
  if [ -L "$mz_candidate" ]; then
   echo "Symbolic-link installation needs manual migration: $mz_candidate"
   exit 1
  fi
  mz_name="$(basename -- "$mz_candidate")"
  mv -- "$mz_candidate" "$mz_recovery/previous/$mz_name"
  if [ -z "$mz_rollback_seed" ] || [ "$mz_name" = 'com.victor.motionviewer' ]; then mz_rollback_seed="$mz_recovery/previous/$mz_name"; fi
 fi
done
mv -- "$mz_stage" "$mz_target"
mz_installed=1
for mz_runtime in 9 10 11 12; do
 /usr/bin/defaults write "com.adobe.CSXS.$mz_runtime" PlayerDebugMode -string 1
done
if [ -n "$mz_rollback_seed" ]; then
 /usr/bin/ditto "$mz_rollback_seed" "$mz_recovery/verified-backup"
 if [ -d "$mz_backup" ]; then mv -- "$mz_backup" "$mz_recovery/older-backup"; fi
 mv -- "$mz_recovery/verified-backup" "$mz_backup"
fi
mz_committed=1
echo 'ALTO installed for the current macOS account. Administrator rights are not required.'
echo 'Start Premiere: Window > Extensions (Legacy) > ALTO.'
echo "Panel: $mz_target"
echo "Previous copies: $mz_recovery/previous"
echo 'Personal assets and settings are preserved in Montazhopa3.'
