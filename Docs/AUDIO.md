# Audio workflow

Canonical workflow for runtime music and sound effects. Asset authoring and
optimization remain in [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md).

For proposed external-library mappings and current/proposed audition, use the
standalone [Sound desk](./design/audio-review/README.md). Its review choices and
preview copies do not change runtime registrations or shipped assets.

Follow [Every player action receives feedback](./UI.md#every-player-action-receives-feedback):
audio may reinforce visible acknowledgment and outcomes, but essential meaning
must survive mute or playback failure. This principle does not require a sound
for every action or change the intentional silent-content registrations below.

## Ownership

| Concern                              | Owner                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio/index.ts` (facade) + `host.ts`, `sfx.ts`, `music.ts`, `state.ts`, `preload.ts`, `volume.ts`, `url.ts`, `element.ts`, `reset.ts`                                    |
| Player volume values and bounds      | Defaults in `src/lib/game-constants/settings.ts`, ranges in `src/lib/settings-values.ts`, live pct in `settings-store.ts`, runtime fraction in `src/lib/audio/state.ts`           |
| Sound-to-content registration        | `src/lib/audio/sound-registry.ts` + `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`                                                                               |
| Screen ambience loops                | `src/lib/audio/ambience.ts`, screen mappings in `sound-registry.ts`, lifecycle in `useAppAudioEffects`                                                                            |
| Single music catalog and boss map    | `src/lib/audio/music.ts` (module-private `MUSIC_CATALOG` via `computeMusicVolume`)                                                                                                |
| Bestiary boss preview                | `src/lib/audio/music.ts` (`previewBossMusic`/`endBossPreview`), called by `collection-screen.tsx`                                                                                 |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` (`useAppAudioEffects`)                                                                                                                               |
| Desktop capability                   | `src/lib/audio/host.ts` reads `src/lib/desktop-api.ts` (foreign Electron hosts stay silent)                                                                                       |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                                                                                 |
| Playback test setup                  | `tests/helpers/audio-fixture.ts` (`installCleanAudio`) over `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts`; `tests/helpers/fake-audio.ts` only for mid-test stub swaps |
| Asset/pipeline test                  | `tests/lib/audio/audio-assets.test.ts` (disk + `scripts/assets/*` validators; run on registry/asset/pipeline changes)                                                             |

## Runtime contract

### Shared playback rules

Playback modules live together in `src/lib/audio/`; callers use `@/lib/audio`, backed by `index.ts`. `getSoundUrl` is exported once from the facade (owner `url.ts`); `isAppInBackground` is exported once from the facade (owner `host.ts`). Tests mirror this folder in `tests/lib/audio/`, with `*.dom.test.ts` identifying tests that need browser APIs.

- Only the active audible host plays sound. Foreign Electron hosts, automated browsers, and undisplayed windows remain silent. `hasVisibleWindowArea()` in `host.ts` is the shared visibility check; `shouldTreatAsBackground()` holds the pure background decision and `isAppInBackground()` is its DOM-reading wrapper for app lifecycle wiring.
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences. Settings store percents (0–100); the audio runtime holds fractions (0–1) converted once in `useAppAudioEffects`, with `clamp01` applied locally on fractions only. Test resets go through `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts` (volumes stay owned by the test).
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.

### Loading and registration

- `useAppAudioEffects` starts best-effort warming when the app shell mounts after the startup gate. UI sounds and the draw-transfer cue warm immediately; the remaining manifest warms in one input-idle callback. Startup does not wait for audio fetching or decoding. Battle initialization also warms the full battle event set, opening-hand cards, enemy ability cards, and the current enemy's attack sounds.
- Crafted Mixed Potion IDs resolve to the base Potion sound for both playback and battle preloading.
- Every companion has a battle-to-card mapping. Mana Moth, Will-o'-Wisp and Library Owl deliberately have no summon/turn cue. Cards and enemies without a registered sound stay silent and are pinned in the exact `SILENT_*` lists in `tests/lib/audio/sound-registry.test.ts`: adding a sound (or content) must update those lists. Approved separation of Gold gain/spending and explicit service silence are pinned there, as is the music-boss vs attack-only (`living-armor`) roster.
- UI event keys remain available when their cue is `null`. Playback and preloading skip these explicit silence choices. The approved export and resolved registrations are archived in [the installation record](./design/audio-review/INSTALLATION.md).

### Music lifecycle

Music playback has one private owner in `music.ts`: cached records bind the track key,
media element, and fade gain. Its playback state distinguishes idle, paused,
playing, fading in, and fading out; only fading out carries a pending destination.
Fade states own their timers, and cancellation invalidates their callbacks.
`state.ts` contains shared preferences, never playback pointers or cooldowns.
Volume controls call `syncMusicSettings()` so updates retain the actual playing
track's boss boost and fade gain. Tests observe fake Audio elements rather than
injecting media pointers into shared state.

- Starting a battle invalidates the upcoming enemy's battle music cache, even while the previous screen remains visible. It preserves menu playback until navigation selects the battle track. Invalidating the currently playing key forgets it entirely, so the next play builds a fresh track.
- Invalidating either the playing track or the pending destination cancels the transition. Invalidating the playing track stops playback; invalidating only the destination restores the outgoing track to full gain. Unrelated cache invalidation leaves playback and its fade alone. A later explicit play can build the invalidated track afresh.
- If the destination track cannot initialize after a fade-out, restore the outgoing track's configured volume. The failed destination remains uncached and can be retried on the next request.
- Pausing cancels the pending destination and fade. Resuming the paused track restores its configured volume and mute state; selecting another track starts a new transition.
- Unknown music keys are ignored: the current track, its key, and any bestiary preview stay untouched. Pausing all music also ends any bestiary preview.

### Sound effect lifecycle

One-shot sound effects have one lifetime owner in `sfx-player.ts`. `sfx.ts` selects registered
sounds and adapts browser media, settings, clocks, and timers to that player.
Each cue moves from ready to pending or playing, then finished. Stopping battle
sounds and resetting the runtime use the same idempotent disposal path, which
cancels timers, detaches handlers, and releases stopped media sources. Reset
also disposes UI sounds and stingers. Cooldown reservations belong to the player;
identity checks prevent an older failed play from clearing a newer reservation.
Finished cues ignore late failure callbacks, including callbacks after reset.

- Successful shop refreshes and Potion mixes play their registered service sounds after the transaction commits, including free services. Card removal has no service cue; any paid Gold transaction still follows its separate spending feedback. Rejected services remain silent.
- The first play of a sound has no cooldown; repeats inside `SFX_COOLDOWN_MS` are suppressed.
- Delayed sounds check and start their cooldown when playback starts, so a future cue cannot suppress an immediate cue. Cancelled or muted pending cues consume no cooldown; failed playback releases its reservation. Stopping battle SFX cancels their pending timers; UI sounds and stingers continue across battle transitions.

### Screen ambience lifecycle

Campfire uses the approved fire excerpt; Labyrinth and Mystery share the approved
cave excerpt. One loop at a time follows the shown screen. Leaving those screens,
muting, entering a non-player host, or resetting audio disposes its media element.
Unmuting can resume the requested room. Master/SFX controls update the live gain;
ambience uses `SFX_AMBIENCE_VOLUME` below one-shot cues. Failed playback is
non-fatal, and late callbacks cannot dispose a replacement loop. Truncated source
excerpts have short edge fades to prevent hard-cut clicks; their loop character
still needs an in-game listening pass.

Battle feedback uses resolved `critical` and `periodic` combat-text metadata to
distinguish critical hits and selected Burn/Bleed ticks from ordinary spell
damage. These optional presentation fields do not change combat calculations or
save data. Existing visual aggregation remains unchanged.

## Change checklist

1. Register new card, enemy, or companion sounds in the owning sound registry or audio module (`sound-registry.ts`, `COMPANION_SOUND_CARD_IDS`); cards and enemies intentionally left silent go on the exact pin lists in `tests/lib/audio/sound-registry.test.ts`.
2. Add or replace source audio through [the asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound) and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the runtime audio owners above.
4. Run focused unit suites with `npm run test:full -- tests/lib/audio` and any affected lifecycle tests, then the task-scoped local gate. Browser playback verification uses `npm run test:e2e:route -- audio` under the [local execution policy](../CONTRIBUTING.md#what-to-run-when-you-change).

Changed-path and CI tier policy: [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).
