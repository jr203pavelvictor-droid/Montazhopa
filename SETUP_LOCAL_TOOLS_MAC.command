#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
python3 tools/setup_local.py
printf '\nPress Enter to close. '
read -r mz_done
