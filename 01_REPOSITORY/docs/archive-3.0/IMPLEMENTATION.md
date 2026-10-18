> Исторический документ версии 3.0 beta 1. Актуальный состав 3.1 смотри в FEATURES.md и THIRD_PARTY_NOTICES.md в корне репозитория.

# Montazhopa 3 beta 1 — implementation status

The deliverable is a CEP extension, with per-user Windows/macOS installation scripts. No companion application or Python/AI backend is installed. Online update checks are off by default.

| Module | Implemented behavior | Verification boundary |
| --- | --- | --- |
| Graphite UI, RU/EN, search, layouts | Functional panel with per-section preferences and tooltips | Chromium UI automation |
| Grouped motion tools | Shared ES3 engine, frame-aligned samples, bounded simplification, Transform/Drop Shadow adapter | Numeric comparison and mocked Premiere contracts |
| Replacement | Selection token, owned-effect fingerprints, confirmation, parameter snapshots and rollback on write failures | Mocked Premiere; persistent ownership requires actual project testing |
| Camera | Reference map, 2–10 views, shared route math, individual transition timing, Position + Scale | Shared-model and mocked-host tests |
| User library | Copy external media into app library; save mini-project from selected time range; nested insert | Source implementation; live Premiere import/export not tested |
| Asset previews | Image thumbnails, audio listening, synthesized example SFX | Browser/local filesystem |
| Watch folders | Stable-size polling; import into named Project bin | Filesystem and mocked callback tests |
| Native effects | Request actual video-effect list; exact-name fallback; apply to selected video clips | Host API may vary by Premiere version |
| Workflows | Duplicate sequence, scale selected clips to frame, save project; user-defined sequential combinations | API availability checked at runtime; no atomic multi-action undo claim |
| Audio markers | Local Web Audio decoding, approximate BPM, silence RMS on all channels; review then create markers | Synthetic audio tests and host adapter |
| Local update | ZIP parser, safe relative paths, size/CRC/hash checks, staging, post-exit replacement, backup/restore | Filesystem tests; OS helper execution not tested on Win/Mac |
| GitHub releases | Configurable public repo, version selection, download path validation | Network disabled by default; live releases not configured/tested |
| 93 Film Impact functions | Preserved roadmap only; no deceptive clickable placeholders | Requires native SDK, references and host render testing |
| AI transcription / autocut | Not shipped | Requires a separate optional processing backend |

## Architecture

- `catalog.js`: grouped tools and bilingual descriptions.
- `engine.js`: shared motion math, easing, frame samples and simplification. Scalar tolerances: 0.025 for percentages/degrees; 0.00008 for normalized position. Linear spans reduce to endpoint keys.
- `app.js`: responsive panel, local preview, confirmation and workflow UI.
- `local.js`: per-user assets/configuration, generated WAVs, watch polling, ZIP and release handling. No copied external binaries.
- `jsx/base.jsx`: existing Montazhopa 2.1 host plus the October 17 key-reduction fix, retained for public DOM/QE adapters and shared camera model.
- `jsx/host.jsx`: version 3 host, data-only JSON parser, source-time conversion, ownership ledger and timeline operations.
- `update-manifest.json`: package identity, version and SHA-256 for every panel runtime file.

User data lives under `Montazhopa3` in the current account's application data directory, separate from extension code. Ownership records do not travel inside `.prproj`. A project saved under another path may need manual re-association; the code will not identify arbitrary Transforms as its own.

## Source references and licensing

The October 18 source review informed the design: VibeTools mini-project assets, IronFX effect lookup and selected-clip application, Watchtower/SheepDog folder watching, PR Extension release packaging, and the separate Genius Installer Manager staging approach. Version 3 implements these mechanisms in its own code on top of the existing Montazhopa source.

No external native DLL, importer, compiled `.prm`, PowerShell hotkey listener, Python backend, FFmpeg build, AI model or third-party preset pack is included. Code from the unlicensed Genius Installer Manager repository was not copied. This avoids assuming that PR Extension's MIT grant covers a separate repository.

Reference projects:

- https://github.com/uncleeai/VibeTools
- https://github.com/IronVisuals/IronFX
- https://github.com/tvorimchudesa/watchdog-premiere
- https://github.com/georg-itgclaudeAgent/pr-extension
- https://github.com/georg-itgclaudeAgent/genius-installer-manager
- https://github.com/Thirosawasan/OpenCutz
- https://github.com/MishaManevich/SmartCut
- https://github.com/Adobe-CEP/Samples/tree/master/PProPanel

## Developer checks

From this directory:

```
node tests/engine.cjs
node tests/host.cjs
node tests/local.cjs
MZ_BROWSER=/path/to/chromium node tests/ui.cjs
python3 build.py
```

UI tests require Playwright. Local-service ZIP fixture tests use Python 3's standard library. These checks do not replace installation, timeline playback and export testing in Premiere on both operating systems.
