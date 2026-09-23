# Audio workflow

Canonical workflow for runtime music and sound effects. Asset authoring and
optimization remain in [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md).

## Ownership

| Concern                              | Owner                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio/index.ts` (facade) + `host.ts`, `sfx.ts`, `music.ts`, `state.ts`, `preload.ts`, `volume.ts`, `url.ts`, `element.ts`, `reset.ts`                                    |
| Player volume values and bounds      | Defaults in `src/lib/game-constants/settings.ts`, ranges in `src/lib/settings-values.ts`, live pct in `settings-store.ts`, runtime fraction in `src/lib/audio/state.ts`           |
| Sound-to-content registration        | `src/lib/audio/sound-registry.ts` + `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`                                                                               |
| Single music catalog and boss map    | `src/lib/audio/music.ts` (module-private `MUSIC_CATALOG` via `computeMusicVolume`)                                                                                                |
| Bestiary boss preview                | `src/lib/audio/music.ts` (`previewBossMusic`/`endBossPreview`), called by `collection-screen.tsx`                                                                                 |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` (`useAppAudioEffects`)                                                                                                                               |
| Desktop capability                   | `src/lib/audio/host.ts` reads `src/lib/desktop-api.ts` (foreign Electron hosts stay silent)                                                                                       |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                                                                                 |
| Playback test setup                  | `tests/helpers/audio-fixture.ts` (`installCleanAudio`) over `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts`; `tests/helpers/fake-audio.ts` only for mid-test stub swaps |
| Asset/pipeline test                  | `tests/lib/audio/audio-assets.test.ts` (disk + `scripts/assets/*` validators; run on registry/asset/pipeline changes)                                                             |

Music playback has one private owner in `music.ts`: cached records bind the track key,
media element, and fade gain. Its playback state distinguishes idle, paused,
playing, fading in, and fading out; only fading out carries a pending destination.
Fade states own their timers, and cancellation invalidates their callbacks.
`state.ts` contains shared preferences and SFX cooldowns, never music pointers.
Volume controls call `syncMusicSettings()` so updates retain the actual playing
track's boss boost and fade gain. Tests observe fake Audio elements rather than
injecting media pointers into shared state.

Playback modules live together in `src/lib/audio/`; callers use `@/lib/audio`, backed by `index.ts`. `getSoundUrl` is exported once from the facade (owner `url.ts`); `isAppInBackground` is exported once from the facade (owner `host.ts`). Tests mirror this folder in `tests/lib/audio/`, with `*.dom.test.ts` identifying tests that need browser APIs.

## Runtime contract

- Critical UI sounds load before the startup reveal. Battle initialization warms the full battle event set plus the visible hand and current enemy sounds; the remaining manifest warms in one input-idle callback.
- Only the active audible host plays sound. Foreign Electron hosts, automated browsers, and undisplayed windows remain silent. `hasVisibleWindowArea()` in `host.ts` is the shared visibility check; `shouldTreatAsBackground()` holds the pure background decision and `isAppInBackground()` is its DOM-reading wrapper for app lifecycle wiring.
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences. Settings store percents (0–100); the audio runtime holds fractions (0–1) converted once in `useAppAudioEffects`, with `clamp01` applied locally on fractions only. Test resets go through `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts` (volumes stay owned by the test).
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.
- Crafted Mixed Potion IDs resolve to the base Potion sound for both playback and battle preloading.
- Successful shop refreshes, card removals, and Potion mixes play their registered service sounds after the transaction commits, including free services. Rejected actions remain silent.
- Starting a battle invalidates the upcoming enemy's battle music cache, even while the previous screen remains visible. It preserves menu playback until navigation selects the battle track. Invalidating the currently playing key forgets it entirely, so the next play builds a fresh track.
- Invalidating either the playing track or the pending destination cancels the transition. Invalidating the playing track stops playback; invalidating only the destination restores the outgoing track to full gain. Unrelated cache invalidation leaves playback and its fade alone. A later explicit play can build the invalidated track afresh.
- Pausing cancels the pending destination and fade. Resuming the paused track restores its configured volume and mute state; selecting another track starts a new transition.
- Unknown music keys are ignored: the current track, its key, and any bestiary preview stay untouched. Pausing all music also ends any bestiary preview.
- The first play of a sound has no cooldown; repeats inside `SFX_COOLDOWN_MS` are suppressed.
- Delayed battle sounds reserve their cooldown when scheduled. Stopping battle SFX cancels their timers and releases those reservations immediately; UI sounds and stingers continue across battle transitions.
- Every companion has a card sound and a battle companion mapping. Cards and enemies without a registered sound stay silent and are pinned in the exact `SILENT_*` lists in `tests/lib/audio/sound-registry.test.ts`: adding a sound (or content) must update those lists. Intentionally shared files across battle/UI tables (gold, end-turn, card-fan, mystery-box) are pinned in the same file, as is the music-boss vs attack-only (`living-armor`) roster.

## Change checklist

1. Register new card, enemy, or companion sounds in the owning sound registry or audio module (`sound-registry.ts`, `COMPANION_SOUND_CARD_IDS`); cards and enemies intentionally left silent go on the exact pin lists in `tests/lib/audio/sound-registry.test.ts`.
2. Add or replace source audio through [the asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound) and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the runtime audio owners above.
4. Run the changed-path unit route. Use `npm run test:e2e:route -- audio` when the browser playback journey is part of the change.

Changed-path and CI tier policy: [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).
