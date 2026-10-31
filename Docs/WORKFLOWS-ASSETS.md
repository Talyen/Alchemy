# Alchemy — Asset workflow

Edit source masters and their selection manifests, prepare outputs, register them,
then validate and commit the complete change. Generated files are build products;
never hand-edit them. [Audio](./AUDIO.md) owns runtime sound behavior and
[visual review](./UI_VISUAL_REVIEW.md) owns rendered acceptance.

## Asset lifecycle

Choose the asset's owning selection and preparation command:

| Asset           | Selection under `scripts/assets/`             | Prepared output                    | Runtime registration                                 | Narrow preparation                                     |
| --------------- | --------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Game art        | `core`, `content`, `card`, `talent` manifests | `src/assets/optimized/`            | Curated maps in `lib/game-data/assets.ts`            | `npm run assets:optimize:art`, then `npm run sync:art` |
| Gear art        | `gear-assets.mjs`                             | `src/assets/optimized/gear-*.webp` | Eager `lib/game-data/catalog-art.ts` registry        | Same art commands                                      |
| Boss idle video | `boss-idle-assets.mjs`                        | `src/assets/boss-idles/`           | `lib/game-data/boss-idle-assets.ts`                  | `node scripts/optimize-boss-idles.mjs`                 |
| Sound           | `sound-assets.mjs`                            | `public/sounds/` OGG + MP3         | `lib/audio/sound-registry.ts` or owning audio module | `npm run assets:optimize:sounds`                       |
| Music           | `music-assets.mjs`                            | `public/Music/`                    | `lib/audio/music-catalog.ts`                         | `npm run assets:optimize:music`                        |
| App icons       | `icon-assets.mjs`                             | Desktop/public icon outputs        | Existing package configuration                       | `npm run generate:icons`                               |

Paths in the runtime-registration column are under `src/`. Run `npm run assets`
(`node scripts/assets.mjs --prepare`) for complete preparation. It optimizes media,
synchronizes the general art barrel and stamps build-version metadata. The
[script map](../scripts/README.md#assets) locates implementation modules.

## Repository sources and CI

Selected [source masters](../assets/sources/README.md) are committed under
`assets/sources/`, retaining their `2d Assets/Game Sources` and `Sounds/Game Sources`
paths. Copy an approved external master here explicitly; external library changes
never update the repository copy. Source resolution is checkout-relative,
ignores `ASSET_LIBRARY_ROOT`, and rejects references or symlinks escaping this
folder. Do not import masters through symlinks. A source rename must update its
selection; missing selected sources fail before full preparation publishes or prunes.

Ordinary development and builds consume committed prepared outputs without
regenerating them. `predev` uses output-only validation; asset CI checks source
freshness. Neither needs an external library. In a sparse task checkout, source
checks and preparation automatically restore selected missing non-trailer masters
from the Git index without replacing existing files. Direct source authoring can
use `--full-assets` or `git sparse-checkout disable` to show the full source tree.
Keep the master, selection and prepared outputs in one commit.

The optional [Sound desk](../scripts/audio-review/README.md) browses replacements
only with an explicit `--library <Sounds directory>`. Existing snapshots reopen
without a library; auditions do not install production assets.

## Validation and commit

| Need                                          | Command                           | Establishes                                                                                      |
| --------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Final source freshness after authoring        | `npm run assets:check`            | Source/settings hashes, prepared bytes, inventories, orphans, generated art and version metadata |
| Development/package integrity without masters | `npm run assets:check:outputs`    | Selection/settings fingerprints, prepared bytes, inventories and generated code                  |
| Fast generated-code check                     | `npm run check:generated`         | Art barrel and build-version metadata; no media decoding, hashing or source freshness            |
| Art barrel only                               | `npm run sync:art -- --check`     | General art exports                                                                              |
| Version stamp only                            | `npm run sync:version -- --check` | Build metadata                                                                                   |

After authoring, run the source-freshness check and review the master, manifest
and generated diff before committing. Regenerate stale outputs explicitly through
the lifecycle command for that asset. Checks do not regenerate prepared outputs
or modify existing masters. Source-freshness checks can restore omitted masters
in sparse worktrees as described under [repository sources](#repository-sources-and-ci);
use the outputs-only check when masters must remain omitted.
Rendered art, motion and listening acceptance remain separate from hash validation.

For direct `assets.mjs` diagnosis, bare `--check` covers every pipeline, art
barrels and version metadata; `--optimize --check` covers pipeline outputs only;
`--sync --check` covers generated code only. `sync:gear-art` aliases `sync:art`;
there is no independent Gear barrel. `generate:icons` accepts only `--help`/`-h`
and rejects other arguments before reads/writes; use `assets:check` to validate icons.

`ALCHEMY_SKIP_ASSETS=1` applies only to direct preparation when committed outputs
are already current. Builds validate outputs instead of preparing them, so this
flag cannot bypass stale source changes.

## Preparation memory

`ALCHEMY_ASSET_PROFILE=low-memory npm run assets` runs the media pipelines
sequentially, caps art jobs at two, gives Sharp one thread per image and a 16 MB
operation cache, and interpolates one boss master at a time. Normal preparation
keeps its existing parallelism. `ALCHEMY_ASSET_CONCURRENCY` can lower low-memory
parallelism further but cannot raise its cap. Profiles change scheduling only:
image dimensions, quality, transparency, video codec/frame cadence and audio
settings remain the canonical settings below. Keep heavy production within the
shared host lane; this preset does not authorize a local build or profiling run.

## Boss battle idle clips

Selected MP4 masters live in `assets/sources/Animations/Bosses/` and are listed in
`scripts/assets/boss-idle-assets.mjs`. Run `node scripts/optimize-boss-idles.mjs`
for narrow preparation, or add `--check` for read-only source/output freshness.
The ordinary asset preparation and checks include this pipeline too. Preparation
uses the bundled FFmpeg and a system `ffprobe` (install FFmpeg to supply it).
Source/output freshness checks do not invoke `ffprobe` or encode video. Use
`--boss blood-countess` to prepare one boss in a bounded media-production job;
completed masters are checkpointed so later jobs reuse them. On the shared Mac,
wrap preparation with the host lane described in [trailers](./TRAILERS.md).

Preparation computes motion-compensated 60 fps once at the master's native
1920×1080 resolution, then area-filters 1280×720 and 640×360 variants from that
uncompressed stream. H.264 CRF 17, 4:2:0, no audio and fast-start MP4 metadata keep
normal hardware video playback available. Tail padding supplies interpolation's
lookahead, while output trimming preserves the source duration rounded to the nearest
60 fps frame. Original masters stay untouched. Review hair, hands and seams in
motion: interpolation synthesizes frames and can introduce distortion. Commit masters, prepared files
under `src/assets/boss-idles/`, and their hash manifest together.

`src/lib/game-data/boss-idle-assets.ts` selects ordered clips by boss ID and resolves
their prepared URLs through an eager video glob. Missing selected variants fail at startup.
Battle presentation alone consumes this map. Videos never join `allGameArt` or
startup image loading; only the current boss's two playback buffers load clips.
Each clip lists ascending resolution variants. Battle presentation selects by the
transformed frame size and display density, changing quality at a clip boundary.
Other views continue using the normal static catalog artwork.

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

### Crafting Currencies (Transparent background)

```text
One distinctive object occupying 80–88% of a square with a genuinely transparent alpha background. Preserve dark internal shading and the full illustrated silhouette; no ground, panel or backdrop. Broad features, minimal decorative microtexture, two or three major shading steps. No text, runes or realistic photography.
```

### Inventory Resources, Mana & UI Icons (Transparent background)

```text
One standalone inventory icon on a square, genuinely transparent alpha background, with no ground or backdrop. Occupy 80–88% of the canvas with safe margins and an instantly readable silhouette at 16–48px. Broad simple angular cel-shaded planes, crisp ink contours and one sharp highlight flare. No photorealism, painterly texture or presentation sheet.
```

## Add or replace game art

1. Copy the approved master into `assets/sources/`.
2. Select its source, target, width, quality and optional transparency requirement
   in the topical art manifest using `ART_PRESETS` from `asset-constants.mjs`.
   Talent portraits belong in `talent-assets.mjs`.
3. Run the art or full preparation from [Asset lifecycle](#asset-lifecycle).
4. Register the curated map in `src/lib/game-data/assets.ts`, then follow
   [validation and commit](#validation-and-commit).

### Art registration

Consumers import curated maps such as `characterArt`, `mysteryEventArt`,
`talentArt`, `craftingArt` and `difficultyArt` from `lib/game-data/assets.ts`, never
optimized files directly. Oxlint enforces that boundary.
`allGameArt` is the full static manifest and `essentialGameArt` selects startup
art under [boot and loading](./ARCHITECTURE.md#boot-and-loading).

`assets.generated.ts` has explicit named exports derived by `toAssetExportName`
/ `kebabToCamel`. `catalog-art.ts` uses a narrow eager `import.meta.glob`
with `import: "default"` for Gear URLs; boss idle video URLs use a separate eager glob.
`gearArtByDefinitionId` and slot backgrounds
derive from that registry; no second generated Gear map needs synchronization.
Card/enemy builders resolve conventional art by content ID through `getCatalogArt`;
use an explicit override for shared or renamed art. Trinkets follow their catalog
IDs and summon cards derive roster/art from the Companion catalog. Missing
conventional art fails during catalog construction. Lazy art remains unsupported.

## Resource and battle UI masters

Production authoring sources are versioned under `assets/sources/`. Keep pending approval
material only while its decision is open; once selected work is installed, remove
superseded studies, approval transcripts and duplicate sources. Use ignored
`output/` or `scratch/` for temporary experiments. Current tool inputs are listed
in [design inputs](./design/README.md).

Homestead resource masters live in `2d Assets/Game Sources/Items/Resources/`; crafting
currency PNG masters live in `2d Assets/Game Sources/Items/Crafting/`. Resources, battle Mana
and the six crafting currencies use transparent backgrounds. Salvage remains a
separate illustrated action, not a carried currency. Check the actual alpha channel before importing transparent
art: a visible checkerboard may be baked into an opaque image.

Set `requiresTransparency: true` in the owning art manifest when an image must have a transparent background; omission defaults to false. The eight resource icons, six crafting currencies, battle Mana, and both piles require it. Preparation and read-only freshness checks validate decoded source and prepared pixels, including cache hits: each must contain fully transparent pixels and visible artwork. The requirement participates in the asset fingerprint. Replacement images are staged and validated before publication; failure preserves that image's previous output and skips manifest publication and orphan removal.

Also inspect approved artwork against light and dark backgrounds. The pixel check rejects opaque checkerboards and empty images but cannot prove that every background pixel is correct. If reference-based image generation repeatedly paints a checkerboard into the image, regenerate without image references using the approved visual description, then repeat pixel and visual checks. Current approved masters remain the authoring sources.

`2d Assets/Game Sources/Interface/Card Elements/Card Back.png` supplies the back
of Collection cards and the back-to-front battle draw flight. Battle discards
flip from the card face to artwork sampled from the top of the discard pile; see
the [transfer motion contract](./UI_BATTLE.md#battle-motion).
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

Localized promo masters sit beside the English original under `assets/sources/` as
`Unlock Full Game Demo Promo - <locale>.png`; their prompt set is
`Unlock Full Game Demo Promo - localization prompts.json`. Replace only the seven
captions, preserving panels, framing, palette and gold lettering. Review spelling,
accents, quantity, terminology and fit; reduce lettering within plaques for long
captions. The asset manifest selects optimized WebP outputs. Runtime language
selection and the caption freshness gate belong to
[localization](./LOCALIZATION.md#qualification-and-steam); the selected image and
containment contract belong to [Steam demo](./STEAM_DEMO.md#marketing-presentation).

## Add or replace Gear art

Select `{Name} - {Basic|Astral}.jpeg` sources in `gear-assets.mjs` (`.jpg` and PNG
are accepted). `gear-filenames.mjs` owns slugging. After art preparation, confirm
prepared `gear-*.webp` identities match intended Gear definitions; URLs register
through the [shared art registration](#art-registration) path.

Select all four body/weapon/accessory/trinket backgrounds named
`{Slot name} Slot.{jpeg|jpg|png}` under `Interface/Gear Slots/`. Generated-art
validation rejects missing slot targets.

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
  publication waits for all entries under the shared [publication rules](#pipeline-publication-and-failures).
- MP3 fallbacks stay committed alongside their OGG source on purpose: Safari
  requests the `*.mp3` URL at runtime and offline/desktop packaging serves
  committed `public/sounds/` bytes, so generating them only at build time
  would break the committed-output validation contract. Revisit only with a
  packaging change that guarantees the fallback bytes ship.

## Add or replace music

Select source paths and stable output filenames in `scripts/assets/music-assets.mjs`. Music is copied without transcoding into
`public/Music/`. The optimizer removes files without a corresponding source;
there is no curated-source exception for music. Filenames are validated for
duplicates and supported extensions by `scripts/assets/music-assets.mjs`. Output targets must be basenames, and their extensions must match the selected source because this pipeline does not transcode.
Register playable tracks in `MUSIC_CATALOG` in `src/lib/audio/music-catalog.ts`. Its
`allRegisteredMusicFiles()` list is cross-checked against `public/Music/` by
`tests/lib/audio/audio-assets.test.ts`.

## Authoring models

Three authoring shapes coexist by design:

- **Static manifest** — `scripts/assets/{core,card,content,talent}-assets.mjs` declare `{source,target,width,quality}`. Art manifests use `artGroup()` from `scripts/assets/art-group.mjs` to share a folder relative to `2d Assets/Game Sources`, an `ART_PRESETS` entry, and optional transparency requirements across explicit `[sourceFilename, targetFilename, optionalPresetOverride]` rows. Nested source paths are allowed; targets remain explicit basenames. Adding files to the source folder never adds selections. Every target is explicitly registered and validated for duplicate targets and export names; shared sources may produce distinct targets. Width/quality presets, Sharp defaults, schema version, and audio settings live in `scripts/assets/asset-constants.mjs`.
- **Explicit Gear and Music selections** — `scripts/assets/gear-assets.mjs` expands each selected item into Basic and Astral art using the canonical Gear filename owner. Music and sound manifests use `assetGroup()` from `scripts/assets/asset-group.mjs`: string selections retain source basenames (sounds use `.ogg`), while tuples pin renamed targets. `artGroup()` uses that same expansion with art presets. Selections never scan directories. Adding files to `assets/sources/` does not change the selected inventory. Every output directory is fully managed; unregistered outputs are swept only after successful preparation. All current sound masters live under `assets/sources/`; OGG masters are copied unchanged and receive MP3 fallbacks.

- **Sound manifest** — `scripts/assets/sound-assets.mjs` lists `generatedSoundAssets` (selected WAV and OGG masters) plus the legacy `curatedSoundFiles` fallback (currently empty; all production masters are repo-local). Conversion and fallback behavior follow [sound preparation](#add-or-replace-sound). The optimizer owns `public/sounds/` and tags each hash manifest entry with `owner: generated|curated`.

## Pipeline publication and failures

Asset constants own transform settings, schema salt and managed directories.
Source freshness hashes bytes in bounded chunks with those settings and salt;
size and modification time never substitute for content. Bump the salt only
when intentionally invalidating all asset caches. Receipts retain source/settings,
selection and output identity.

Full preparation runs art, sound, music and boss idle pipelines concurrently (except the low-memory
profile), settles all started workers and reports every failure. Art success may
advance its barrel even when another pipeline fails. Version stamping is an
independent step governed by [release setup](./RELEASE_SETUP.md); art and version
sync failures are reported together. Partial success never makes the run pass.

Each pipeline publishes its complete hash manifest only after processing succeeds.
Discovery/processing failure preserves the previous manifest and skips orphan
removal; successful individual outputs may already have advanced. Each transform
writes a temporary sibling and replaces its output only on success, removing
partial temporaries after interruption. Cleanup follows manifest publication and
cannot roll it back if deletion fails. Missing cleanup directories are no-ops.

During optimization, missing/malformed JSON manifests are cache misses. Other
filesystem errors retain their code and path and fail preparation: unreadable
sources/manifests, invalid path types, and failed directory reads/deletions are
not cache misses. Missing outputs are stale. Check mode performs no publication
or cleanup and verifies output hashes after partial runs.

Hash entries contain `hash`, `outputHash` and optional sound `owner` only. The next
successful preparation removes filesystem metadata without changing digests or
re-encoding unchanged media. Legacy string hashes or missing output digests need
regeneration for full freshness validation.

### Strict generated-art inputs

Barrel generation instead requires a valid committed art manifest. Missing or
malformed manifests, empty/invalid entries, invalid targets or duplicate exports
fail before writing. Targets are lowercase kebab-case WebP basenames beginning
with a letter. Both legacy string hashes and object entries with a string `hash`
are accepted for barrel generation; unrelated cache metadata is ignored.

One manifest snapshot feeds art synchronization and its Gear alias. Input failure
preserves the existing barrel; filesystem write failure offers no transactional
rollback. The fast generated check requires every static target, all four Gear
slot backgrounds and regular files for referenced assets. Full source/media
freshness remains the separate validation scope above.
