# Song compatibility architecture

## Decision

Use existing Clone Hero-compatible community song packages, including those distributed through Chorus Encore, as the canonical input. Preserve their original files, names, metadata, difficulty charts, and audio. Do not require users to author charts, reorganize song folders, or convert packages to a proprietary on-disk format.

Generic extracted-folder import and a generated catalog are implemented through `pnpm import:songs`, supporting the current MIDI and `.chart` adapters. The eight supplied packages are validated; this does not establish universal compatibility. Local package selection/upload UI and ZIP/SNG extraction are deferred. Direct integration with Chorus Encore's search/download service is separate scope and is not required to read downloaded songs.

Chorus Encore is a distribution/search platform within a broader chart ecosystem. Its desktop counterpart Bridge documents chart-folder and SNG downloads. Chart content may be MIDI or `.chart`; packaging and chart interpretation are separate responsibilities. A single successfully imported package does not establish support for every community chart.

## Boundaries

| Layer | Responsibility |
| --- | --- |
| Package reader | Expose files and metadata from an existing folder, ZIP, or SNG through a common read interface. Folder reading is the first implementation target; ZIP/SNG adapters follow. |
| Song discovery | Locate conventional chart/audio/artwork/preview/video files without requiring a fixed folder title. Ignore desktop metadata and unrelated files. |
| Metadata reader | Interpret `song.ini` or SNG header metadata and supported chart metadata, including delay, preview offsets, and chart modifiers. Preserve unknown fields without executing them. |
| Chart reader | Parse `notes.mid` or `notes.chart`, actual guitar difficulties, tempo changes, lengths, chords, and supported gameplay markers. |
| Runtime adapter | Convert parsed ticks/tempo into the engine's seconds/lane events in memory. This is a runtime object, not a new song file format users must supply. |
| Audio/media loader | Load the selected song only, schedule available stems together, manage previews independently, and release unused resources. |
| Gameplay/rendering | Consume song data independently of its original container/encoding. Direct-key controls remain the user's chosen mode. |

Current build-time entry points are `discoverSongs(root)` and `readPackage(folder, relative)`. They return metadata, chart data, media references, capability warnings, and isolated folder errors. The runtime `loadSong(id)` fetches the selected derived chart using the generated manifest. A runtime package-source reader remains a possible later migration, not a current API.

## Compatibility rules

- Show difficulties found in playable chart tracks; do not infer their existence from difficulty ratings or invent easier arrangements.
- Use supplied album art and preview audio where present, with fallbacks for packages without either. When no separate preview exists, preview a range of the main audio using the supplied timing metadata or a documented fallback.
- Discover all relevant stems; do not assume every song has exactly `song.opus` and `guitar.opus`. Only isolated guitar audio supports independent guitar attenuation. A full mix alone supports playback with that limitation explicitly represented.
- Detect optional background media and metadata offsets; missing video does not invalidate a song.
- Define chart-file precedence, handling of INI modifiers, codec compatibility, and unsupported events from documented ecosystem conventions and tested fixtures. Do not silently discard unsupported playable notes while reporting complete compatibility.
- Separate container errors, chart errors, unsupported features, and audio decoding failures. Validate archive paths/sizes, chart data, and resource limits when package importing is built.
- Test multiple packages and both chart encodings before claiming broad compatibility. Start with five-fret lead guitar, not every instrument supported by Chorus Encore.

## Reuse and migration

Evaluate the ecosystem's `scan-chart` parser for shared MIDI/`.chart` interpretation and `parse-sng` for SNG reading before expanding the hand-written MIDI adapter. Check licenses, actual API, browser/dependency compatibility, and required gameplay markers against our use case; discovery is not a decision to install or replace dependencies yet. ZIP needs a separate archive reader.

The generic command parses original MIDI or `.chart` and writes reproducible JSON into `src/generated/songs`, separate from runtime code. It interprets existing charts; it does not compress audio, create musical arrangements, or extract ZIP/SNG files. Original packages remain canonical and untouched locally. Source packages and derived files are ignored by Git; runtime builds use the remote Firebase catalog. The command regenerates derived files for offline export.

The DragonForce-specific importer/catalog path has been replaced after equivalent count/timing/playback checks. `pnpm import:dragonforce` remains a legacy alias for the general command. Catalog previews are implemented independently of gameplay audio. Next compatibility work includes open-note gameplay (currently retained but filtered by user choice), additional MIDI modifiers, nonstandard media references, video, and ZIP/SNG readers. See [song integration](song-integration.md) for precise supported conventions and current limits.

## Sources

- [Chorus Encore](https://www.enchor.us/)
- [Bridge download formats](https://github.com/Geomitron/Bridge/blob/master/README.md)
- [Shared chart parser](https://github.com/Geomitron/scan-chart)
- [SNG reader](https://github.com/Geomitron/parse-sng)
- [Chart ecosystem specifications](https://github.com/TheNathannator/GuitarGame_ChartFormats)
