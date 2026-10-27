# Song integration

## Adding songs

1. Extract a downloaded song folder anywhere under `src/musics`, preserving its original files.
2. Run `pnpm import:songs` from the project root.
3. Run `pnpm dev`, or refresh the running game. Select the song and an available difficulty.

No song-specific code or authored maps are required for supported packages. Rerun import after adding, removing, renaming, or editing a package. `pnpm import:dragonforce` remains a compatibility alias for importing all folders.

## Separation

- `src/musics`: canonical original packages; never rewritten by import.
- `scripts/song-package.mjs`: recursive discovery, INI metadata, conventional media discovery, validation, per-folder error isolation.
- `scripts/midi-chart.mjs` / `text-chart.mjs`: original MIDI or text-chart ticks converted to audio-origin seconds, chords, sustains, beats, and boost phrases.
- `src/generated/songs`: local-only reproducible derived JSON plus `manifest.json`, ignored by Git. Fresh checkouts build/play from Firebase without these files; offline import/export requires local source packages. Users never supply this derived format.
- `scripts/prepare-song-assets.mjs`: copies referenced charts/media into the exclusively generated, ignored `public/songs` cache. Import, development, and build prepare this cache; original packages remain unchanged. Do not place original assets in this cache.
- `src/songs/catalog.ts`: builds a catalog from the manifest and public asset URLs, fetching only the selected chart. `types.ts` and `audio-loader.ts` define runtime data and sequential selected-song decoding.
- `src/songs/presentation.json`: optional manual palettes, backgrounds, descriptions, and display metadata layered over imports; never regenerated. See [song presentation](song-presentation.md).
- Gameplay receives normalized events; it does not depend on song names or folder titles.

Only extraction is manual. ZIP and SNG containers are not imported directly. Nested folders and case-insensitive conventional file names are supported. MIDI takes precedence if both `notes.mid` and `notes.chart` exist, with a warning. INI metadata overrides chart metadata. Folder-derived IDs remain stable until a folder is renamed.

## Supported content and limits

Five-fret lead guitar MIDI (`PART GUITAR` / `T1 GEMS`, format 1) and `.chart` (`EasySingle` through `ExpertSingle`) are supported within the current direct-key rules. Only actual colored difficulties are listed. `.chart` BPM changes, offset, per-lane sustain lengths, chords, and per-difficulty Star Power `S 2` phrases are read. MIDI pitch 116 supplies shared phrases. HOPO/tap modifiers retain the game's direct-key behavior; other instruments are ignored. Tempo anchors and unknown text-chart guitar note types are rejected rather than silently mapped.

Per the user's decision, open notes are preserved in generated chart data, but filtered from gameplay. They neither appear nor cause misses. The game and command report this limitation; no sixth input is introduced. Boost currently evaluates the remaining colored notes.

Audio discovery recognizes conventional song/guitar/rhythm/bass/keys/drums/vocals/crowd stems in Opus, Ogg, MP3, WAV, or FLAC. Multiple encodings for the same role produce an error. Numbered drum stems take precedence over a combined drum stem. Codec decoding still depends on the browser; naming a supported extension does not certify every encoding. Referenced nonstandard stream names are pending. Stems of unequal length start at the same audio origin; attempt length uses the longest decoded stem.

Independent guitar attenuation requires a guitar stem plus another stem. Single full mixes remain audible on misses. Album artwork is optional with a fallback. Catalog samples use `preview` audio in the supported extensions, otherwise `song` audio or the first available stem. Dedicated previews start at zero; fallback samples use INI `preview_start_time` in milliseconds, or zero if missing/invalid. Samples stop after 20 seconds or when leaving/changing selection. Genre, year, and guitar rating are imported with existing metadata. Background video playback remains pending; originals are preserved, and video discovery emits a warning. Decoded audio memory/performance still needs measurement; only the selected song is cached.

Bad folders are listed in the command report and manifest without blocking valid folders. If no valid songs remain, import exits with an error and preserves the previous generated catalog. Old generated hash-named charts are removed only after a successful catalog write. Import does not certify universal Clone Hero compatibility.

## Supplied packages validated

| Song | Source | Difficulty groups | Pending open groups | Audio |
| --- | --- | --- | --- | --- |
| Through The Fire & Flames / Dragonforce | MIDI | Easy 1102; Medium 1823; Hard 2723; Expert 3722 | 0 | Accompaniment + guitar |
| Numb (Linkin Park Cover) / Cole Rolland | `.chart` | Expert 591 imported / 495 playable | 96 | Full mix |
| Faint / Linkin Park | `.chart` | Expert 525 | 0 | Full mix |
| Given Up / Linkin Park | `.chart` | Expert 507 imported / 348 playable | 159 | Full mix |
| What I've Done / Linkin Park | `.chart` | Expert 694 imported / 684 playable | 10 | Full mix |
| Jiyuu no Tsubasa / Linked Horizon | `.chart` | Expert 1957 | 0 | Full mix |
| BRING+EYES=DEATH+INVITE / Imperial Circus Dead Decadence | `.chart` | Expert 2252 imported / 1916 playable | 336 | Full mix |
| Shinbatsu wo Tadori Kyoukotsu ni Itaru / Imperial Circus Dead Decadence | `.chart` | Expert 1612 imported / 1428 playable | 184 | Full mix |

Validation covers original counts, tempo changes, offsets, extended sustains, phrase parsing, open-note preservation, missing files, nested/case-insensitive discovery, ambiguous audio, mixed/separated routing, and decoding errors. Browser checked selection/difficulties, actual Opus decoding/start, and pause for all four songs. Full-length listening, latency, and broad package/browser compatibility remain unverified.

## References

- [Chart five-fret conventions](https://thenathannator.github.io/GuitarGame_ChartFormats/Chart-File-Formats/chart-format/Tracks/5-Fret-Guitar/)
- [Supported audio names](https://thenathannator.github.io/GuitarGame_ChartFormats/Chart-File-Formats/Supported-Audio-Files/)
- [MIDI five-fret conventions](https://thenathannator.github.io/GuitarGame_ChartFormats/Chart-File-Formats/mid-format/Tracks/5-Fret-Guitar/)
