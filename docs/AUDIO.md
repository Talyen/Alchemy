# Audio workflow

Canonical workflow for runtime music and sound effects. Asset authoring and
optimization remain in [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md).

## Ownership

| Concern                              | Owner                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio.ts` (facade) + `audio-host.ts`, `audio-sfx.ts`, `audio-music.ts`, `audio-state.ts`, `audio-preload.ts`, `audio-volume.ts` |
| Player volume values and bounds      | `src/lib/settings-values.ts`                                                                                                             |
| Sound-to-content registration        | `src/lib/sound-registry.ts`                                                                                                              |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` and owning audio-effect hooks                                                                               |
| Desktop capability                   | `src/lib/desktop-api.ts`, preload, and Electron host state                                                                               |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                                        |

## Runtime contract

- Critical UI sounds load before the startup reveal. Battle initialization prioritizes the visible hand and current enemy sounds; the remaining manifest warms during input-idle work.
- Only the active audible host plays sound. Foreign Electron hosts and undisplayed windows remain silent.
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences.
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.

## Change checklist

1. Register new card or UI sounds in the owning sound registry or audio module.
2. Add or replace source audio through the asset workflow and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the runtime audio owners above.
4. Run the changed-path unit route. Use `npm run test:e2e:audio` when the browser playback journey is part of the change.

Changed-path and CI tier policy: [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).
