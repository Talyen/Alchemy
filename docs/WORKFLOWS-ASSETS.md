# Alchemy — Asset workflow

Canonical checklist for adding or changing raw art, gear art, sound, and music.
Generated barrels and optimized outputs are committed build products, never the
authoring source.

## Pipeline overview

| Asset kind    | Authoring source                       | Generated output                                 | Registry / consumer                                   |
| ------------- | -------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Game art      | `Raw Assets/` + `scripts/assets/*.mjs` | `src/assets/optimized/`                          | `assets.generated.ts` → `src/lib/game-data/assets.ts` |
| Gear art      | `Raw Assets/Gear/`                     | Optimized WebP + `src/lib/game-data/gear-art.ts` | Gear definitions by stable definition ID              |
| Sound effects | `Raw Assets/Sound Effects/`            | `public/sounds/` OGG and MP3 fallbacks           | `src/lib/sound-registry.ts`                           |
| Music         | `Raw Assets/Music/`                    | `public/Music/`                                  | Audio owners under `src/lib/audio*.ts`                |

`scripts/prepare-assets.mjs` is the full pipeline. Art, sound, and music
optimization run concurrently because their outputs are disjoint; generated
art and Gear barrels update only after successful optimization.

## Add or replace game art

1. Put the raw file under the matching `Raw Assets/` directory.
2. Register source, target, width, and quality in the topical manifest under
   `scripts/assets/` (`core`, `content`, `card`, or `talent`). Talent portraits
   belong in `talent-assets.mjs`.
3. Run `npm run assets:optimize` for art-only iteration or
   `node scripts/prepare-assets.mjs` for the complete pipeline.
4. Import the generated export through `src/lib/game-data/assets.ts`. Talent
   portraits also join `talentArt` there.
5. Run `npm run check:generated` and review the generated diff.

`npm run sync:assets` regenerates `src/lib/game-data/assets.generated.ts` from
the manifest targets. Do not add exports to that generated file by hand.

## Add or replace Gear art

1. Name source files `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` (PNG and
   `.jpg` variants accepted by the optimizer).
2. Run `npm run assets:optimize`.
3. Run `npm run sync:gear-art` to regenerate
   `src/lib/game-data/gear-art.ts`.
4. Run `npm run check:generated` and confirm every generated definition ID
   matches the intended Gear definition.

Gear slot backgrounds use `{Slot name} Slot.{jpeg|jpg|png}` under
`Raw Assets/Gear/Gear Slot Backgrounds/`; the optimizer warns on unknown or
missing slot names.

## Add or replace sound

Sound effects are explicitly registered in `scripts/optimize-sounds.mjs` and
then referenced by `src/lib/sound-registry.ts` or the owning audio module.

- WAV sources are loudness-normalized and converted to OGG with MP3 fallbacks.
- OGG sources are copied without re-encoding and still receive an MP3 fallback.
- `public/sounds/` is partially managed: curated files without a raw source may
  coexist with generated entries. Do not sweep unregistered files as orphans.
- The generated manifest records generated versus curated ownership.

Run `node scripts/optimize-sounds.mjs` for sound-only iteration or the complete
preparation command before handoff.

## Add or replace music

Place supported audio files under `Raw Assets/Music/` and run
`node scripts/optimize-music.mjs`. Music is copied without transcoding into
`public/Music/`. Unlike sound effects, this output directory is fully managed;
files without a corresponding source are removed by the optimizer.

## Skip mode and verification

Set `ALCHEMY_SKIP_ASSETS=1` only when committed optimized assets and generated
barrels are already current. CI, Vercel, and release builds use this mode after
separate generated-output checks; it is not a substitute for regenerating
outputs after source changes.

Before handoff:

```sh
node scripts/prepare-assets.mjs
npm run check:generated
git diff -- src/assets/optimized public/sounds public/Music \
  src/lib/game-data/assets.generated.ts src/lib/game-data/gear-art.ts
```

Commit the intended generated outputs with their authoring-source changes.
