# Third-party source integrated into Montazhopa 3.1.0-beta.1

Montazhopa is a CEP panel with its own UI, host bridge, data storage, watcher and installer. It incorporates the following licensed source modules. Repository source snapshots and modifications are retained in `third_party/upstream-snapshots.zip`, `third_party/patches`, `third_party/integrated-files.json` and `third_party/sources-lock.json` in the source distribution.

## VibeTools — MIT

- Project: https://github.com/uncleeai/VibeTools
- Revision: `afa1cfa23742ebb88fd47273b090766817412195`
- Copyright (c) 2026 UncleLuki.
- Source: `js/audioPreview.js` → `com.victor.motionviewer/vendor/vibe-audio.js`.
- Changes: classic-script wrapper, optional filesystem/browser I/O, bounded waveform cache, real error handling instead of random fallback, stale-load guard, source disconnection, explicit export instead of automatic shell execution, UI lifecycle adaptation. Original waveform, player, seek, pitch/reverse and drawing code retained.
- Full license: `com.victor.motionviewer/licenses/VibeTools.txt`.
- VibeTools' bundled FFmpeg executable, DLL, importer and control-surface plugin are **not** included.

## Jungle — BSD 3-Clause

- Source: `js/jungle.js` as distributed by VibeTools, copied unchanged.
- Copyright 2012, Google Inc. All rights reserved.
- Full original notice remains in `vendor/jungle.js` and is reproduced in `licenses/Jungle-BSD-3-Clause.txt`.
- Jungle pitch shifter is connected by the VibeTools audio preview.

## OpenCutz / OpenCut — MIT

- Audited fork supplied by the user: https://github.com/Thirosawasan/OpenCutz
- Revision: `1a5b05caf07b3baac52d19448ce8162c84c450b5`.
- Upstream project: https://github.com/SysAdminDoc/OpenCut . The license and original copyright text are preserved verbatim in `licenses/OpenCutz.txt`.
- Direct source: `core/silence.py`, `core/repeat_detect.py`, `core/captions.py`, `core/audio.py`, `core/transcript_cache.py`, `core/zoom.py`, `utils/config.py`, `utils/media.py`, `export/premiere.py`.
- Changes: FFmpeg errors fail explicitly; duplicate XML declaration removed; local CPU-only faster-whisper initialization with downloads/cache-purge disabled. Small Montazhopa `helpers.py`, `user_data.py` and JSON process adapter replace the full application/server dependencies. Not every function of the included source modules is exposed in the UI.
- FFmpeg, Python AI packages and model weights are not bundled and retain their own licenses when installed separately.

## Syncitol — MIT for uxp source

- Project: https://github.com/thinkvp/Syncitol
- Revision: `8378f89e4e905343da6e5d540ca001d3a275d512`.
- Copyright (c) 2026 thinkvp.
- `uxp/js/dsp.js` → `vendor/syncitol-dsp.js`. Only the browser namespace is changed; CommonJS algorithm exports remain intact.
- Author tests retained with the import path adapted.
- Full license: `licenses/Syncitol.txt`.
- No native `.uxpaddon`, FFmpeg binary or IBM Plex fonts included.

## PR Extension — MIT

- Project: https://github.com/georg-itgclaudeAgent/pr-extension
- Revision: `b2c703b9114aea21a430a4b9fac6ae153386b39a`.
- Copyright (c) 2026 Georg Miñoza / itGenius.
- `extension/client/src/api/githubReleases.ts` adapted into `github-releases.js`.
- Changes: configurable repository, JavaScript instead of TypeScript, Montazhopa tag/asset selection, explicit network opt-in, stable/beta channel, existing Montazhopa prerelease-aware comparison. Original semver helpers and release candidate mapping/filter/sort structure retained.
- Full original: `third_party/githubReleases.upstream.ts`; full license in `licenses/PR-Extension.txt`.
- Genius Installer Manager is a separate repository; its Rust/Tauri code is not included.

## Audited but not incorporated as source

IronFX and SheepDog informed changes to Montazhopa's own preset indexing, clip matching and watcher. Their source is not distributed in this release. SmartCut and Genius Installer Manager code is not included. Proprietary Film Impact binaries or source are not included.

Full license files accompany the runtime in `com.victor.motionviewer/licenses`. This notice does not replace those licenses.
