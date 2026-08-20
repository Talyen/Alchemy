# Alchemy — Asset Workflow

Focused checklist for adding or changing raw art, gear art, sound, and music assets. The generated barrels and optimized outputs are not hand-edited source.

**Add a new raw asset:** register it in `scripts/assets/` (core/content/card/talent manifests) → `npm run assets:optimize` (or `node scripts/prepare-assets.mjs`) → import from `@/assets/optimized/` in `src/lib/game-data/assets.ts`. `sync:assets` regenerates `assets.generated.ts` from the art manifest targets. Talent portraits go in `scripts/assets/talent-assets.mjs` and `talentArt` in `src/lib/game-data/assets.ts`.

**Gear art:** place files in `Raw Assets/Gear/{Name} - {Basic|Astral}.jpeg` → `npm run assets:optimize` → `npm run sync:gear-art` (regenerates `src/lib/game-data/gear-art.ts`). `predev` / `prebuild` run the full pipeline via `scripts/prepare-assets.mjs`: the art, sound, and music optimizers run concurrently (disjoint output dirs), then `sync:assets` + `sync:gear-art` regenerate the barrels from the art manifest. Sound optimization writes OGG plus MP3 fallbacks (Safari cannot play Vorbis). Set `ALCHEMY_SKIP_ASSETS=1` to skip that prep (CI/Vercel/release use this; commit regenerated outputs when you change sources).
