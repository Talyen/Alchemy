# Alchemy — Asset workflow

Canonical checklist for adding or changing raw art, gear art, sound, and music.
Generated barrels and optimized outputs are committed build products, never the
authoring source.

## Pipeline overview

| Asset kind    | Authoring source                             | Generated output                                 | Registry / consumer                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Game art      | `Raw Assets/` + `scripts/assets/*.mjs`       | `src/assets/optimized/`                          | `assets.generated.ts` → `src/lib/game-data/assets.ts` |
| Gear art      | `Raw Assets/Gear/`                           | Optimized WebP + `src/lib/game-data/gear-art.ts` | Gear definitions by stable definition ID              |
| Sound effects | `Raw Assets/Sound Effects/` + sound manifest | `public/sounds/` OGG and MP3 fallbacks           | `src/lib/sound-registry.ts`                           |
| Music         | `Raw Assets/Music/`                          | `public/Music/`                                  | Audio owners under `src/lib/audio*.ts`                |

Build version stamping (`src/lib/validation/metadata.generated.ts` via `npm run sync:version`) is owned by the release pipeline ([RELEASE_SETUP](./RELEASE_SETUP.md)); it is not an art authoring source.

`scripts/prepare-assets.mjs` is the full pipeline (invoked via the canonical
`node scripts/assets.mjs --prepare` CLI, which also powers `predev`). Art, sound, and music
optimization run concurrently and report every failure (settled, not fail-fast)
because their outputs are disjoint; generated
art and Gear barrels update whenever art succeeds, even if sound or music fail —
the run still throws, so partial success is never silent.

## Authoring models

Three authoring shapes coexist by design:

- **Static manifest** — `scripts/assets/{core,card,content,talent}-assets.mjs` declare `{source,target,width,quality}`. Used for cards, talents, boons, destinations, etc. where every target is explicitly registered and validated for duplicate `source`/`target`/`exportName`. Width/quality presets, Sharp defaults, schema version, and audio settings live in `scripts/lib/asset-constants.mjs`.
- **Filesystem discovery** — `Raw Assets/Gear/` (`{Name} - {Basic|Astral}.jpeg`) and `Raw Assets/Music/` are discovered at optimization time. Gear filenames encode rarity; music needs no per-target quality. No hand-maintained manifest entry. Malformed gear filenames now throw (strict, like slot backgrounds) instead of warn+skip.
- **Mixed manifest + curated** — `scripts/assets/sound-assets.mjs` lists `generatedSoundAssets` (WAV→OGG with loudnorm) plus `curatedSoundFiles` (committed OGG without source). The optimizer owns `public/sounds/` and tags each hash manifest entry with `owner: generated|curated`.

## Importing art — barrel is the canonical surface

Generated barrels are committed build products (`src/assets/optimized/` + `src/lib/game-data/assets.generated.ts` / `gear-art.ts`). Never import `@/assets/optimized/*.webp` directly outside the barrel — ESLint bans it. Always go through `src/lib/game-data/assets.ts` curated maps:

- `characterArt`, `mysteryEventArt`, `talentArt`, `gearSlotBackgroundArt`, `craftingArt`, `difficultyArt` — typed maps built from `assetRefs` in `assets.ts` (`gearSlotBackgroundArt` derives from `gearArtByDefinitionId`).
- `allGameArt: string[] = Object.values(assetRefs)` — full manifest. `essentialGameArt` is the startup-critical subset (everything except per-item gear art, matched by identity against `gearArtByDefinitionId`) decoded in bounded batches (`IMAGE_PRELOAD_BATCH_SIZE` via `preloadImagesInBatches` in `use-app-effects.ts`) before the `StartupLoadingScreen` reveal; per-item gear art starts decoding as soon as essential art settles so it overlaps the 3s minimum display window, continuing in the background after reveal if unfinished. Armory slot backgrounds (`slot-*`) stay in the startup set so empty slots never pop in late. The `game-data` Vite chunk is code-split from one table (`scripts/lib/vite-chunks.mjs`) and eagerly evaluated; bundle budget (`scripts/lib/bundle-budget.mjs` — `index` + `totalJs` + `gameData`) caps growth.
- `gearArtByDefinitionId` — re-exports `assets.generated` via `gearArtAssets` in `gear-art.ts`.

The static barrel provides explicit export names (`kebabToCamel`) and the Vite asset graph; do not use `import.meta.glob` for art.

## Add or replace game art

1. Put the raw file under the matching `Raw Assets/` directory.
2. Register source, target, width, and quality in the topical manifest under
   `scripts/assets/` (`core`, `content`, `card`, or `talent`) using presets from `scripts/lib/asset-constants.mjs` (`WIDTH`/`QUALITY`). Talent portraits belong in `talent-assets.mjs`.
3. Run `npm run assets:optimize` for art-only iteration (`assets:optimize:sounds` /
   `assets:optimize:music` for the audio pipelines) or
   `node scripts/assets.mjs --prepare` for the complete pipeline.
4. Import through the curated map in `src/lib/game-data/assets.ts` (e.g. `craftingArt`, `difficultyArt`, `talentArt`) — do not import `@/assets/optimized` directly.
5. Run `npm run check:generated` (fast barrel-only); review the generated diff.

`npm run sync:generated` (or `--art-only` / `--gear-only` for one barrel) regenerates `src/lib/game-data/assets.generated.ts` from
the manifest targets. Do not add exports to that generated file by hand. Hashes use `ASSET_SCHEMA_VERSION=4` (128-bit truncation) — bump the version to invalidate all caches.

## Add or replace Gear art

1. Name source files `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` (PNG and
   `.jpg` variants accepted by the optimizer).
2. Run `npm run assets:optimize`.
3. Run `node scripts/sync-generated.mjs --gear-only` (`npm run sync:gear-art` forwards to the same CLI) to regenerate
   `src/lib/game-data/gear-art.ts`.
4. Run `npm run check:generated` and confirm every generated definition ID
   matches the intended Gear definition.

Gear slot backgrounds use `{Slot name} Slot.{jpeg|jpg|png}` under
`Raw Assets/Gear/Gear Slot Backgrounds/`; the optimizer throws on unknown slot
names and on missing `body`/`weapon`/`accessory`/`trinket` backgrounds (strict
mode — use `--check` or CI to enforce).

## Add or replace sound

Sound effects are explicitly registered in `scripts/assets/sound-assets.mjs`
and then referenced by `src/lib/sound-registry.ts` or the owning audio module.

- WAV sources are loudness-normalized and converted to OGG with MP3 fallbacks.
- OGG sources are copied without re-encoding and still receive an MP3 fallback.
- Curated files without a raw source must be listed in `curatedSoundFiles` in
  the same manifest. The optimizer owns the complete directory and removes
  files outside the declared OGG files, their MP3 fallbacks, and its hash manifest.
- The generated hash manifest records generated versus curated ownership and
  verifies both source identity and committed output bytes.

Run `npm run assets:optimize:sounds` for sound-only iteration or the complete
preparation command before handoff.

## Add or replace music

Place supported audio files under `Raw Assets/Music/` and run
`npm run assets:optimize:music`. Music is copied without transcoding into
`public/Music/`. Unlike sound effects, this output directory is fully managed;
files without a corresponding source are removed by the optimizer. Every track
listed in-game (`allRegisteredMusicFiles()` in `src/lib/audio-music.ts`) is
cross-checked against `public/Music/` by `tests/lib/music-assets.test.ts` —
register new tracks there first.

## Skip mode and verification

Set `ALCHEMY_SKIP_ASSETS=1` only when directly invoking an asset-preparation
entry point and committed optimized assets and generated barrels are already
current. Ordinary builds do not run asset preparation; they validate committed
generated outputs instead. The flag is not a substitute for regenerating
outputs after source changes.

Before handoff, run the idempotence check. It fails without leaving a mutated
tree if preparation would change committed outputs, including version metadata.
It requires the full `Raw Assets/` checkout; CI jobs running this check must not
exclude raw sources. Restoration rewrites only changed files:

```sh
npm run assets:check
```

For manual inspection:

```sh
node scripts/assets.mjs --prepare
npm run check:generated
git diff -- src/assets/optimized public/sounds public/Music \
  src/lib/game-data/assets.generated.ts src/lib/game-data/gear-art.ts
```

Commit the intended generated outputs with their authoring-source changes.
