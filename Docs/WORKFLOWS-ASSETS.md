# Alchemy — Asset workflow

Canonical checklist for adding or changing raw art, gear art, sound, and music.
Generated barrels and optimized outputs are committed build products, never the
authoring source.

## Shared asset requirements

Edit raw sources and their owning manifests. Import art through the curated maps in
`src/lib/game-data/assets.ts`, never directly from optimized files. Full
preparation runs through `node scripts/assets.mjs --prepare`; operation-specific
commands below support narrower iteration. Review generated changes and run the
read-only freshness check before handoff. Pipeline maintenance must also preserve the
failure and freshness contracts below.

## Local library and CI

Both games default to `~/Documents/Asset Library`; set `ASSET_LIBRARY_ROOT` for a different local location. Sources are library-relative paths beneath `2d Assets/Game Sources`, `Sounds/Game Sources`, or `Video/Game Sources`. Artwork is organized by subject under Characters, Actions, Items, Places, Interface, Animation, and Branding. Alternate versions share a subject folder with descriptive filenames; each game's manifests select the version it uses. Audio and video retain their existing organization. New approved revisions use distinct filenames and are adopted explicitly through each game's selection manifest.

Run `npm run assets` after source/selection edits, then `npm run assets:check`. App icons retain their focused `npm run generate:icons` command; source and output checks include its preparation record. Narrow optimizers remain available. Download selected files in Finder when iCloud has offloaded them. Full preparation reads all selected sources before publishing or pruning anything; missing sources preserve existing outputs. Asset-related pushes require a local source check.

`generate:icons` accepts only `--help`/`-h`; unsupported arguments fail before source
reads or output writes. Use `assets:check` for read-only icon validation.

Selected files may be moved between folders or renamed within the configured library without updating manifests. Preparation, narrow optimizers, local source checks, and icon generation automatically search for missing paths and resolve the original bytes using the existing preparation receipt. Same-name alternatives never substitute for the recorded revision; byte-identical duplicates use a deterministic path. Recovery does not move files, rewrite selections, or change prepared outputs. Searches stay inside `ASSET_LIBRARY_ROOT` and do not follow symlinks. Unreadable or iCloud-offloaded files still need downloading; deleted or changed sources, missing receipts, and changed selections/recipes fail safely. Moving the entire library still requires updating `ASSET_LIBRARY_ROOT`.

Ordinary development and builds use committed outputs. `predev` and hosted CI run `npm run assets:check:outputs`; this deliberately does not establish raw-source freshness. CI neither downloads the library nor regenerates media. Prepared manifests retain independent source/settings hashes, selection fingerprints, and output hashes.

## Art style and generation prompts

Compare changes at their destination size, crop and surrounding UI under
[visual review](./UI_VISUAL_REVIEW.md). Keep the current asset when a replacement
does not improve the game. Style references include Knight, Wizard and Fireball
in `src/assets/optimized/`, plus Discordant Dice and Ascension Seal.

Compose one prompt from the shared foundation and the applicable subject block.
References guide illustration treatment; screen composition follows the UI owners.

```text
Illustrated in a bold, high-energy action-anime style in the visual tradition of kinetic modern action-anime studios. Sharp, angular exaggeration and dynamic motion implied by diagonal shadow shapes, never literal speed lines. Thick, confident near-black outlines of varying weight, saturated punchy colors, and two or three hard-edged flat shading steps. Minimal blending, no gradients or painterly subtlety. Dramatic perspective, sharp graphic highlight flares, and high-contrast graphic color blocking.
```

### Master prompt (Playable Heroes, Bosses, and Enemy encounters)

```text
A figure with a clear identity, an exaggerated dynamic pose and slightly elongated limbs. The environment carries the same bold graphic treatment and fills the frame; never place the character on a flat backdrop.
```

### Card Ability Artwork (Skills, Spells, Attacks, and Defenses)

```text
A clean abstract composition with one iconic action motif or focal subject, readable at small card thumbnail sizes. No specific characters, identifiable faces, pupils, detailed humanoid bodies or multi-character narrative fights. Render necessary humanoid motion as an anonymous faceless black ink silhouette or stylized energy figure with no facial features. Otherwise focus on a weapon, talisman, shield or kinetic element. Fill the background with diagonal color wedges, geometric light shards and energy ribbons; no realistic rooms, walls, floors or dungeons.
```

### Landscapes, Destinations & Labyrinth environments

```text
Full-frame environment with no character focus. Exaggerated perspective and stretched architectural proportions convey energy, with selective structural highlight flares. Render fog as broad overlapping opaque cel-shaded shapes with selective ink contours, never airbrushed clouds or smooth gradients.
```

### Gear, Equipment & Weapons

```text
A clear weapon, armor, accessory or trinket silhouette on a 3:4 or square canvas. Dramatic three-quarter perspective and strong foreshortening, angular material design, weight and tension, with sharp highlights on metal, gems or leather. Tactile hand-drawn physical depth; no photorealism, 3D rendering or fine filigree.
```

### Crafting Currencies & Artifacts (Opaque background)

```text
One distinctive object occupying 80–88% of a square on a quiet opaque dark ink/charcoal background. Broad features, minimal decorative microtexture, two or three major shading steps. No text, runes or realistic photography.
```

### Inventory Resources, Mana & UI Icons (Transparent background)

```text
One standalone inventory icon on a square, genuinely transparent alpha background, with no ground or backdrop. Occupy 80–88% of the canvas with safe margins and an instantly readable silhouette at 16–48px. Broad simple angular cel-shaded planes, crisp ink contours and one sharp highlight flare. No photorealism, painterly texture or presentation sheet.
```

## Add or replace game art

1. Put the raw master in the local Asset Library and use a library-relative source reference.
2. Register source, target, width, and quality in the topical manifest under
   `scripts/assets/` (`core`, `content`, `card`, or `talent`) using presets from `scripts/assets/asset-constants.mjs` (`ART_PRESETS`). Talent portraits belong in `talent-assets.mjs`.
3. Run `npm run assets:optimize:art` followed by `npm run sync:art` for
   art-only iteration, or `node scripts/assets.mjs --prepare` for optimization
   and generated-output synchronization together.
4. Import through the curated map in `src/lib/game-data/assets.ts` (e.g. `craftingArt`, `difficultyArt`, `talentArt`) — do not import `@/assets/optimized` directly.
5. Run `npm run check:generated` (fast art-barrel and build-version validation); review the generated diff.

`npm run sync:generated` updates the art barrel and version metadata.
`npm run sync:art` updates `src/lib/game-data/assets.generated.ts`; Gear
use eager catalog registration in `catalog-art.ts` instead of generated exports.
`npm run sync:gear-art` remains an alias for the same art sync.
Card and enemy builders resolve conventional artwork from their IDs through
`getCatalogArt`; supply `art` explicitly when sharing or renaming artwork. Trinket
art follows its catalog ID. Summon cards derive their roster and art from the Companion catalog. Missing conventional art fails during catalog construction.
Do not add exports to generated files by hand. The hash schema salt lives in
`scripts/assets/asset-constants.mjs`; bump it when all asset caches must be invalidated.

## Resource and battle UI masters

Production authoring sources live in the iCloud-backed local Asset Library. Keep pending approval
material only while its decision is open; once selected work is installed, remove
superseded studies, approval transcripts and duplicate sources. Use ignored
`output/` or `scratch/` for temporary experiments. Current tool inputs are listed
in [design inputs](./design/README.md).

Homestead resource masters live in `2d Assets/Game Sources/Items/Resources/`; crafting
currency PNG masters live in `2d Assets/Game Sources/Items/Crafting/`. Resources and battle Mana
use transparent backgrounds, while crafting currencies retain their illustrated
dark backgrounds. Check the actual alpha channel before importing transparent
art: a visible checkerboard may be baked into an opaque image.

Set `requiresTransparency: true` in the owning art manifest when an image must have a transparent background; omission defaults to false. The eight resource icons, battle Mana, and both piles require it. Preparation and read-only freshness checks validate decoded source and prepared pixels, including cache hits: each must contain fully transparent pixels and visible artwork. The requirement participates in the asset fingerprint. Replacement images are staged and validated before publication; failure preserves that image's previous output and skips manifest publication and orphan removal.

Also inspect approved artwork against light and dark backgrounds. The pixel check rejects opaque checkerboards and empty images but cannot prove that every background pixel is correct. If reference-based image generation repeatedly paints a checkerboard into the image, regenerate without image references using the approved visual description, then repeat pixel and visual checks. Current approved masters remain the authoring sources.

`2d Assets/Game Sources/Interface/Card Elements/Card Back.png` supplies the back
of Collection cards. Battle draws and discards use face-up card artwork under
the [transfer motion contract](./UI_MOTION.md#battle-motion).
`Draw Pile.png` (active compass stack, leaning left) and `Discard Pile.png`
(spent/dormant compass stack, leaning right) are distinct compositions, not
mirrors; both retain transparent margins and a 3:4 canvas. Keep their source
identities separate from the single-card master.
The battle Mana display uses separate full/empty crystal masters under
`Interface/Mana Dock`, selected in [core assets](../scripts/assets/core-assets.mjs),
not the playable Mana Crystals card artwork. Keep transparent, losslessly prepared
outputs; the selected frame has no baked-in sockets and is prepared but currently
not rendered. The manifest owns output sizes and filenames.
[Battle layout](./UI_BATTLE.md#battle-layout) owns placement and spent appearance;
[display sizing](./UI.md#display-sizing) owns scale, and
[battle feedback](./UI_BATTLE.md#battle-feedback) owns change effects.

## Demo marketing artwork

Localized promo masters sit beside the English original in Asset Library as
`Unlock Full Game Demo Promo - <locale>.png`; their prompt set is
`Unlock Full Game Demo Promo - localization prompts.json`. Replace only the seven
captions, preserving panels, framing, palette and gold lettering. Review spelling,
accents, quantity, terminology and fit; reduce lettering within plaques for long
captions. The asset manifest selects optimized WebP outputs. Runtime language
selection and the caption freshness gate belong to
[localization](./LOCALIZATION.md#qualification-and-steam); the selected image and
containment contract belong to [Steam demo](./STEAM_DEMO.md#marketing-presentation).

## Add or replace Gear art

1. Name source files `{Name} - {Basic|Astral}.jpeg` in Asset Library and select them in `scripts/assets/gear-assets.mjs` (PNG and
   `.jpg` variants accepted by the optimizer; filename slugging lives in
   `scripts/assets/gear-filenames.mjs`).
2. Run `npm run assets:optimize:art`.
3. Run `npm run sync:art` to refresh general art exports. Gear URLs derive
   directly from the prepared `gear-*.webp` filenames in `catalog-art.ts`.
4. Run `npm run check:generated` and confirm every generated definition ID
   matches the intended Gear definition.

`sync:gear-art` aliases the art sync. Gear definitions and slot backgrounds
share the same eager URL registry; there is no second generated map to synchronize.

Gear slot backgrounds use `{Slot name} Slot.{jpeg|jpg|png}` under
`2d Assets/Game Sources/Interface/Gear Slots/`. Select all four `body`/`weapon`/`accessory`/`trinket` backgrounds in `gear-assets.mjs`; generated-art validation rejects missing slot targets.

## Add or replace sound

Sound effects are explicitly registered in `scripts/assets/sound-assets.mjs`
and then referenced by `src/lib/audio/sound-registry.ts` or the owning audio module.

- WAV sources are loudness-normalized and converted to OGG with MP3 fallbacks.
- OGG sources are copied without re-encoding and still receive an MP3 fallback.
- Curated files without a raw source must be listed in `curatedSoundFiles` in
  the same manifest. The optimizer owns the complete directory and removes
  files outside the declared OGG files, their MP3 fallbacks, and its hash manifest.
- The manifest's `soundEntryOwner()` and `mp3FallbackName()` helpers own
  generated/curated tags and fallback names. Hashes verify source and output bytes.
- One complete sound manifest includes generated/curated OGGs and MP3 fallbacks;
  unchanged preparation does not rewrite it. OGG failure skips fallback processing;
  publication waits for all entries under the shared [pipeline rules](#pipeline-overview).
- MP3 fallbacks stay committed alongside their OGG source on purpose: Safari
  requests the `*.mp3` URL at runtime and offline/desktop packaging serves
  committed `public/sounds/` bytes, so generating them only at build time
  would break the committed-output validation contract. Revisit only with a
  packaging change that guarantees the fallback bytes ship.

Run `npm run assets:optimize:sounds` for sound-only iteration or the complete
preparation command before handoff.

## Add or replace music

Select library-relative sources and stable output filenames in `scripts/assets/music-assets.mjs`, then run
`npm run assets:optimize:music`. Music is copied without transcoding into
`public/Music/`. The optimizer removes files without a corresponding source;
there is no curated-source exception for music. Filenames are validated for
duplicates and supported extensions by `scripts/assets/music-assets.mjs`. Output targets must be basenames, and their extensions must match the selected source because this pipeline does not transcode.
Register playable tracks in `MUSIC_CATALOG` in `src/lib/audio/music-catalog.ts`. Its
`allRegisteredMusicFiles()` list is cross-checked against `public/Music/` by
`tests/lib/audio/audio-assets.test.ts`.

## Importing art — barrel is the canonical surface

Optimized images and `src/lib/game-data/assets.generated.ts` are committed build products. Never import `@/assets/optimized/*.webp` directly outside the asset owners — Oxlint bans it. Consumers use `src/lib/game-data/assets.ts`:

- `characterArt`, `mysteryEventArt`, `talentArt`, `gearSlotBackgroundArt`, `craftingArt`, `difficultyArt` — typed maps built from `assetRefs` in `assets.ts` (`gearSlotBackgroundArt` derives from `gearArtByDefinitionId`).
- `allGameArt` is the full static manifest; `essentialGameArt` selects startup-critical art. Preserve the [boot and loading contract](./ARCHITECTURE.md#boot-and-loading) when changing these sets. Bundle limits live in [Performance](./PERFORMANCE.md#eager-bundle-size).
- `gearArtByDefinitionId` — derive catalog identities from the eager registry in `catalog-art.ts`.

The general art barrel provides explicit export names (`toAssetExportName`, wrapping `kebabToCamel`). Only `catalog-art.ts` uses a narrow `import.meta.glob` with `eager: true` and `import: "default"` for Gear URLs. It replaces duplicate generated exports and maps while preserving the static Vite asset graph. Other consumers use the exported maps; lazy art imports remain unsupported.

## Skip mode and verification

Set `ALCHEMY_SKIP_ASSETS=1` only when directly invoking an asset-preparation
entry point and committed optimized assets and generated barrels are already
current. Ordinary builds do not run asset preparation; they validate committed
generated outputs instead. The flag is not a substitute for regenerating
outputs after source changes.

Before handoff, run the read-only freshness check. It validates source/settings
hashes, output bytes, manifest inventories, orphan files, and generated code,
including version metadata. It never converts, copies, writes, or deletes assets.
It requires the selected Asset Library sources locally. CI uses `npm run assets:check:outputs`, which checks selection/settings fingerprints, output bytes, inventories and generated code without reading raw sources. Regenerate stale outputs explicitly with `npm run assets`:

```sh
npm run assets:check
```

Three scopes share the `--check` flag: bare `--check` (and `assets:check`) verifies
everything — all three pipelines plus art barrels plus version metadata.
`--optimize --check` verifies only pipeline outputs (no barrels), and
`--sync --check` verifies only generated code (art barrels plus version metadata).
For narrower read-only generated checks:

```sh
npm run sync:art -- --check
npm run sync:gear-art -- --check
npm run sync:version -- --check
```

`sync:art` and its `sync:gear-art` alias check the general art barrel.
`sync:version` checks only build metadata.
These commands do not establish prepared-media or raw-source freshness.

For manual inspection:

```sh
node scripts/assets.mjs --prepare
npm run check:generated
git diff -- src/assets/optimized public/sounds public/Music \
  src/lib/game-data/assets.generated.ts src/lib/game-data/catalog-art.ts
```

Commit the intended generated outputs and selection manifest changes. Raw masters stay outside Git.

## Pipeline overview

| Asset kind    | Authoring source                       | Generated output                       | Registry / consumer                                   |
| ------------- | -------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Game art      | Asset Library + `scripts/assets/*.mjs` | `src/assets/optimized/`                | `assets.generated.ts` → `src/lib/game-data/assets.ts` |
| Gear art      | Asset Library + `gear-assets.mjs`      | Optimized WebP                         | `catalog-art.ts` → Gear definitions by stable ID      |
| Sound effects | Asset Library + sound manifest         | `public/sounds/` OGG and MP3 fallbacks | `src/lib/audio/sound-registry.ts`                     |
| Music         | Asset Library + music selection        | `public/Music/`                        | Audio owners under `src/lib/audio/`                   |

Build version stamping (`src/lib/validation/metadata.generated.ts` via `npm run sync:version`) is owned by the release pipeline ([RELEASE_SETUP](./RELEASE_SETUP.md)); it is not an art authoring source. Full preparation refreshes it as an independent step alongside the art barrels, so a failed art sync never blocks the version stamp and vice versa — failures from either are reported together.

`scripts/prepare-assets.mjs` is the full pipeline (invoked via the canonical
`node scripts/assets.mjs --prepare` CLI for explicit local preparation). Art, sound, and music
optimization run concurrently and report every failure (settled, not fail-fast)
because their outputs are disjoint; the general art barrel updates whenever art
succeeds, even if sound or music fail,
and build version metadata syncs as a separate step in the same run —
the run still throws, so partial success is never silent. Synchronization failures
are reported together with optimization failures. Worker pools finish all started
work before reporting failure, so no conversion continues after the preparation
command returns. Verification uses those same pipelines in read-only check mode.

Each pipeline publishes its complete hash manifest only after all of its processing
succeeds. Discovery or processing failures preserve the previous manifest and skip
orphan deletion. Successful output files may still advance during a failed run;
output hashes are checked on retry. `assets:check` reports stale outputs without
changing them. Unreadable selected sources fail before processing; their diagnostic identifies the library-relative path and retains the filesystem error as its cause.

## Authoring models

Three authoring shapes coexist by design:

- **Static manifest** — `scripts/assets/{core,card,content,talent}-assets.mjs` declare `{source,target,width,quality}`. Art manifests use `artGroup()` from `scripts/assets/art-group.mjs` to share a folder relative to `2d Assets/Game Sources`, an `ART_PRESETS` entry, and optional transparency requirements across explicit `[sourceFilename, targetFilename, optionalPresetOverride]` rows. Nested source paths are allowed; targets remain explicit basenames. Adding files to the library never adds selections. Every target is explicitly registered and validated for duplicate targets and export names; shared sources may produce distinct targets. Width/quality presets, Sharp defaults, schema version, and audio settings live in `scripts/assets/asset-constants.mjs`.
- **Explicit Gear and Music selections** — `scripts/assets/gear-assets.mjs` expands each selected item into Basic and Astral art using the canonical Gear filename owner. Music and sound manifests use `assetGroup()` from `scripts/assets/asset-group.mjs`: string selections retain source basenames (sounds use `.ogg`), while tuples pin renamed targets. `artGroup()` uses that same expansion with art presets. Selections never scan directories. Adding files to Asset Library does not change a game's inventory. Every output directory is fully managed; unregistered outputs are swept only after successful preparation. All current sound masters live in Asset Library; OGG masters are copied unchanged and receive MP3 fallbacks.

- **Sound manifest** — `scripts/assets/sound-assets.mjs` lists `generatedSoundAssets` (selected WAV and OGG masters) plus the legacy `curatedSoundFiles` fallback (currently empty; all production masters are external). Conversion and fallback behavior follow [sound preparation](#add-or-replace-sound). The optimizer owns `public/sounds/` and tags each hash manifest entry with `owner: generated|curated`.

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

Art, sound conversion, MP3 fallbacks, and music copies write to temporary sibling
files and replace the prepared output only after success. An interrupted transform
keeps the previous usable output and removes its partial temporary file. Other
successful outputs may still advance during the same failed preparation run.

### Strict generated-art inputs

Barrel generation treats the committed art manifest as required input, not a
recoverable cache. Missing or malformed manifests, empty or invalid entries,
invalid filenames, and duplicate export names fail before the art barrel is
written. Targets must be lowercase kebab-case WebP basenames beginning with a
letter. Legacy string hashes and object entries containing a string `hash` are
accepted; unrelated cache metadata does not affect generation.

Art synchronization reads and validates one manifest snapshot before writing
the general art barrel. The Gear alias uses the same validation. Input-validation
failures preserve the existing barrel; filesystem write failures do not provide
transactional rollback.

The fast generated check requires every static target and all four Gear slot
backgrounds, and checks that every referenced optimized asset is a regular file.
It does not decode or hash media, run conversions, or require Asset Library.
Full preparation and `assets:check` remain responsible for raw-source freshness
and the complete selected per-item Gear inventory. Filesystem failures retain
their original errors; structural errors identify the manifest and offending
entry or missing targets.
