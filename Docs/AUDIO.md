# Audio workflow

Canonical workflow for runtime music and sound effects. Asset authoring and
optimization remain in [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md).

## Ownership

| Concern                              | Owner                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio/index.ts` (facade) + `host.ts`, `sfx.ts`, `music.ts`, `state.ts`, `preload.ts`, `volume.ts`, `url.ts` |
| Player volume values and bounds      | `src/lib/settings-values.ts`                                                                                         |
| Sound-to-content registration        | `src/lib/audio/sound-registry.ts` + `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`                  |
| Single music catalog and boss map    | `src/lib/audio/music.ts` (`MUSIC_CATALOG`, `computeMusicVolume`)                                                     |
| Bestiary boss preview                | `src/lib/audio/music.ts` (`previewBossMusic`/`endBossPreview`), called by `collection-screen.tsx`                    |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` (`useAppAudioEffects`)                                                                  |
| Desktop capability                   | `src/lib/desktop-api.ts`, preload, and Electron host state                                                           |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                    |

Playback modules live together in `src/lib/audio/`; callers use `@/lib/audio`, backed by `index.ts`. Tests mirror this folder in `tests/lib/audio/`, with `*.dom.test.ts` identifying tests that need browser APIs.

## Runtime contract

- Critical UI sounds load before the startup reveal. Battle initialization warms the full battle event set plus the visible hand and current enemy sounds; the remaining manifest warms in one input-idle callback.
- Only the active audible host plays sound. Foreign Electron hosts, automated browsers, and undisplayed windows remain silent (`hasVisibleWindowArea()` in `host.ts` is the shared visibility check).
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences.
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.
- Crafted Mixed Potion IDs resolve to the base Potion sound for both playback and battle preloading.
- Successful shop refreshes, card removals, and Potion mixes play their registered service sounds after the transaction commits, including free services. Rejected actions remain silent.
- Starting a battle invalidates the upcoming enemy's battle music cache, even while the previous screen remains visible. It preserves menu playback until navigation selects the battle track. Invalidating the currently playing key forgets it entirely, so the next play builds a fresh track.
- Every companion has a card sound and a battle companion mapping. Cards and enemies without a registered sound stay silent and are pinned in the exact `SILENT_*` lists in `tests/lib/audio/sound-registry.test.ts`: adding a sound (or content) must update those lists.

## Change checklist

1. Register new card, enemy, or companion sounds in the owning sound registry or audio module (`sound-registry.ts`, `COMPANION_SOUND_CARD_IDS`); cards and enemies intentionally left silent go on the exact pin lists in `tests/lib/audio/sound-registry.test.ts`.
2. Add or replace source audio through [the asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound) and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the runtime audio owners above.
4. Run the changed-path unit route. Use `npm run test:e2e:route -- audio` when the browser playback journey is part of the change.

Changed-path and CI tier policy: [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).
