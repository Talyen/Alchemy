# Alchemy — Asset workflow

Canonical checklist for adding or changing raw art, gear art, sound, and music.
Generated barrels and optimized outputs are committed build products, never the
authoring source.

## Shared asset requirements

Edit raw sources and their owning manifests; generated barrels and optimized
outputs are committed build products. Import art through the curated maps in
`src/lib/game-data/assets.ts`, never directly from optimized files. Full
preparation runs through `node scripts/assets.mjs --prepare`; operation-specific
commands below support narrower iteration. Review generated changes and run the
read-only freshness check before handoff. Pipeline maintenance must also preserve the
failure and freshness contracts below.

## Add or replace game art

1. Put the raw file under the matching `Raw Assets/` directory.
2. Register source, target, width, and quality in the topical manifest under
   `scripts/assets/` (`core`, `content`, `card`, or `talent`) using presets from `scripts/lib/asset-constants.mjs` (`WIDTH`/`QUALITY`). Talent portraits belong in `talent-assets.mjs`.
3. Run `npm run assets:optimize:art` followed by `npm run sync:art-barrels` for
   art-only iteration, or `node scripts/assets.mjs --prepare` for optimization
   and generated-output synchronization together.
4. Import through the curated map in `src/lib/game-data/assets.ts` (e.g. `craftingArt`, `difficultyArt`, `talentArt`) — do not import `@/assets/optimized` directly.
5. Run `npm run check:generated` (fast barrel-only); review the generated diff.

`npm run sync:generated` updates both art barrels and version metadata.
`npm run sync:art-barrels` updates only `src/lib/game-data/assets.generated.ts`;
`npm run sync:gear-art` updates only `src/lib/game-data/gear-art.ts`.
Do not add exports to generated files by hand. The hash schema salt lives in
`scripts/lib/asset-constants.mjs`; bump it when all asset caches must be invalidated.

## Resource and battle UI masters

Retained studies, generation prompts, approval records, and comparison previews
live in the [design archive](./design/README.md). These record design history;
the matching files under `Raw Assets/` remain the production authoring sources.
Use ignored `output/` or `scratch/` for temporary experiments, and move materials
worth keeping into `docs/design/` with their prompts and review context.

Homestead resource masters live in `Raw Assets/Homestead/Resources/`; crafting
currency PNG masters live in `Raw Assets/Crafting/`. Resources and battle Mana
use transparent backgrounds, while crafting currencies retain their illustrated
dark backgrounds. Check the actual alpha channel before importing transparent
art: a visible checkerboard may be baked into an opaque image.

`Raw Assets/Misc/Card Back.png` is the single card used in transfer animations.
`Draw Pile.png` and `Discard Pile.png` are the approved stack and its horizontal
mirror; both retain transparent margins and a 3:4 canvas. Keep pile artwork
separate from the single-card master so animations never show a stack.
`Misc/Mana Crystal.png` generates `battle-mana-crystal.webp` for the Mana display;
it is distinct from the playable Mana Crystals card artwork. Available crystals
use the full image, spent crystals use 20% opacity, and overflow crystals retain
their brighter glow.

## Add or replace Gear art

1. Name source files `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` (PNG and
   `.jpg` variants accepted by the optimizer).
2. Run `npm run assets:optimize:art`.
3. Run `npm run sync:art-barrels`, then `npm run sync:gear-art`, to regenerate
   the asset exports and the Gear map that consumes them.
4. Run `npm run check:generated` and confirm every generated definition ID
   matches the intended Gear definition.

Gear-only synchronization is insufficient when adding assets: `gear-art.ts`
references exports from `assets.generated.ts`. Full preparation runs both
synchronizations automatically.

Gear slot backgrounds use `{Slot name} Slot.{jpeg|jpg|png}` under
`Raw Assets/Gear/Gear Slot Backgrounds/`; the optimizer throws on unknown slot
names and on missing `body`/`weapon`/`accessory`/`trinket` backgrounds (strict
mode — use `--check` or CI to enforce).

## Add or replace sound

Sound effects are explicitly registered in `scripts/assets/sound-assets.mjs`
and then referenced by `src/lib/audio/sound-registry.ts` or the owning audio module.

- WAV sources are loudness-normalized and converted to OGG with MP3 fallbacks.
- OGG sources are copied without re-encoding and still receive an MP3 fallback.
- Curated files without a raw source must be listed in `curatedSoundFiles` in
  the same manifest. The optimizer owns the complete directory and removes
  files outside the declared OGG files, their MP3 fallbacks, and its hash manifest.
- The generated hash manifest records generated versus curated ownership and
  verifies both source identity and committed output bytes.
- Sound preparation includes generated OGGs, curated OGGs, and MP3 fallbacks in
  its complete manifest. An unchanged run does not rewrite it. Failed OGG
  processing skips fallbacks; manifest publication and retry follow the shared
  [pipeline rules](#pipeline-overview).

Run `npm run assets:optimize:sounds` for sound-only iteration or the complete
preparation command before handoff.

## Add or replace music

Place supported audio files under `Raw Assets/Music/` and run
`npm run assets:optimize:music`. Music is copied without transcoding into
`public/Music/`. The optimizer removes files without a corresponding source;
there is no curated-source exception for music. Register playable tracks in
`src/lib/audio/music.ts`. Its `allRegisteredMusicFiles()` list is cross-checked
against `public/Music/` by `tests/lib/audio/music-assets.test.ts`.

## Importing art — barrel is the canonical surface

Generated barrels are committed build products (`src/assets/optimized/` + `src/lib/game-data/assets.generated.ts` / `gear-art.ts`). Never import `@/assets/optimized/*.webp` directly outside the barrel — ESLint bans it. Always go through `src/lib/game-data/assets.ts` curated maps:

- `characterArt`, `mysteryEventArt`, `talentArt`, `gearSlotBackgroundArt`, `craftingArt`, `difficultyArt` — typed maps built from `assetRefs` in `assets.ts` (`gearSlotBackgroundArt` derives from `gearArtByDefinitionId`).
- `allGameArt` is the full static manifest; `essentialGameArt` selects startup-critical art. Preserve the [boot and loading contract](./ARCHITECTURE.md#boot-and-loading) when changing these sets. Bundle limits live in [Performance](./PERFORMANCE.md#eager-bundle-size).
- `gearArtByDefinitionId` — re-exports `assets.generated` via `gearArtAssets` in `gear-art.ts`.

The static barrel provides explicit export names (`kebabToCamel`) and the Vite asset graph; do not use `import.meta.glob` for art.

## Skip mode and verification

Set `ALCHEMY_SKIP_ASSETS=1` only when directly invoking an asset-preparation
entry point and committed optimized assets and generated barrels are already
current. Ordinary builds do not run asset preparation; they validate committed
generated outputs instead. The flag is not a substitute for regenerating
outputs after source changes.

Before handoff, run the read-only freshness check. It validates source/settings
hashes, output bytes, manifest inventories, orphan files, and generated code,
including version metadata. It never converts, copies, writes, or deletes assets.
It requires the full `Raw Assets/` checkout; CI jobs running this check must not
exclude raw sources. Regenerate stale outputs explicitly with `npm run assets`:

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

## Pipeline overview

| Asset kind    | Authoring source                             | Generated output                                 | Registry / consumer                                   |
| ------------- | -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Game art      | `Raw Assets/` + `scripts/assets/*.mjs`       | `src/assets/optimized/`                          | `assets.generated.ts` → `src/lib/game-data/assets.ts` |
| Gear art      | `Raw Assets/Gear/`                           | Optimized WebP + `src/lib/game-data/gear-art.ts` | Gear definitions by stable definition ID              |
| Sound effects | `Raw Assets/Sound Effects/` + sound manifest | `public/sounds/` OGG and MP3 fallbacks           | `src/lib/audio/sound-registry.ts`                     |
| Music         | `Raw Assets/Music/`                          | `public/Music/`                                  | Audio owners under `src/lib/audio/`                   |

Build version stamping (`src/lib/validation/metadata.generated.ts` via `npm run sync:version`) is owned by the release pipeline ([RELEASE_SETUP](./RELEASE_SETUP.md)); it is not an art authoring source.

`scripts/prepare-assets.mjs` is the full pipeline (invoked via the canonical
`node scripts/assets.mjs --prepare` CLI, which also powers `predev`). Art, sound, and music
optimization run concurrently and report every failure (settled, not fail-fast)
because their outputs are disjoint; generated
art and Gear barrels update whenever art succeeds, even if sound or music fail —
the run still throws, so partial success is never silent. Synchronization failures
are reported together with optimization failures. Worker pools finish all started
work before reporting failure, so no conversion continues after the preparation
command returns. Verification uses those same pipelines in read-only check mode.

Each pipeline publishes its complete hash manifest only after all of its processing
succeeds. Discovery or processing failures preserve the previous manifest and skip
orphan deletion. Successful output files may still advance during a failed run;
output hashes are checked on retry. `assets:check` reports stale outputs without
changing them. Source-directory read errors retain their filesystem error and
path rather than being treated as empty asset collections.

## Authoring models

Three authoring shapes coexist by design:

- **Static manifest** — `scripts/assets/{core,card,content,talent}-assets.mjs` declare `{source,target,width,quality}`. Used for cards, talents, boons, destinations, etc. where every target is explicitly registered and validated for duplicate `source`/`target`/`exportName`. Width/quality presets, Sharp defaults, schema version, and audio settings live in `scripts/lib/asset-constants.mjs`.
- **Filesystem discovery** — `Raw Assets/Gear/` (`{Name} - {Basic|Astral}.jpeg`) and `Raw Assets/Music/` are discovered at optimization time. Gear filenames encode rarity; music needs no per-target quality. No hand-maintained manifest entry. Malformed gear filenames now throw (strict, like slot backgrounds) instead of warn+skip.
- **Mixed manifest + curated** — `scripts/assets/sound-assets.mjs` lists `generatedSoundAssets` (WAV→OGG with loudnorm) plus `curatedSoundFiles` (committed OGG without source). The optimizer owns `public/sounds/` and tags each hash manifest entry with `owner: generated|curated`.

## Content freshness and filesystem failures

Every freshness check hashes source bytes with canonical transform settings and
schema salt, then verifies the output digest. Hashing streams file bytes in bounded
chunks; size and modification time never substitute for content. Committed hash
entries contain only `hash`, `outputHash`, and optional sound `owner`. Existing
object manifests are normalized on the next successful preparation, removing
filesystem metadata without changing digests or re-encoding unchanged media.
Legacy string hashes or entries without an output digest require regeneration.

During optimization, a missing or malformed JSON manifest is a cache miss. Missing outputs are stale,
and an absent cleanup directory is an explicit no-op. Other filesystem errors
retain their original code and path: unreadable manifests, invalid path types,
and failed directory reads or deletions must fail preparation. Cleanup occurs
after manifest publication; standalone optimizers do not roll back a published
manifest if cleanup fails. `assets:check` validates without publication or cleanup;
see [verification](#skip-mode-and-verification).

### Strict generated-art inputs

Barrel generation treats the committed art manifest as required input, not a
recoverable cache. Missing or malformed manifests, empty or invalid entries,
invalid filenames, and duplicate export names fail before either art barrel is
written. Targets must be lowercase kebab-case WebP basenames beginning with a
letter. Legacy string hashes and object entries containing a string `hash` are
accepted; unrelated cache metadata does not affect generation.

Combined art synchronization reads and validates one manifest snapshot, then
builds both barrels before writing either. Individual art and Gear commands use
the same validation while writing only their selected barrel. Input-validation
failures preserve both barrels; filesystem write failures do not provide
transactional rollback.

The fast generated check requires every static target and all four Gear slot
backgrounds, and checks that every referenced optimized asset is a regular file.
It does not decode or hash media, run conversions, or require `Raw Assets/`.
Full preparation and `assets:check` remain responsible for raw-source freshness
and the complete discovered per-item Gear inventory. Filesystem failures retain
their original errors; structural errors identify the manifest and offending
entry or missing targets.
