# Audio workflow

Canonical workflow for runtime music and sound effects. Asset authoring and
optimization remain in [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md).

For proposed external-library mappings and current/proposed audition, use the
standalone [Sound desk](#sound-desk). Its review choices and
preview copies do not change runtime registrations or shipped assets.

Follow [Every player action receives feedback](./UI.md#every-player-action-receives-feedback):
audio may reinforce visible acknowledgment and outcomes, but essential meaning
must survive mute or playback failure. This principle does not require a sound
for every action or change the intentional silent-content registrations below.

## Change checklist

1. Register new card or companion sounds in the owning sound registry or audio module (`sound-registry.ts`, `COMPANION_SOUND_CARD_IDS`); the exact catalog coverage in `tests/lib/audio/sound-registry.test.ts` requires a nonempty focal registration for new content.
2. Add or replace source audio through [the asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound) and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the [runtime audio owners](#runtime-contract).
4. Relevant coverage lives in `tests/lib/audio/` and affected lifecycle tests;
   the browser audio route protects playback integration. Use
   [Contributing](../CONTRIBUTING.md#what-to-run-when-you-change) to select checks
   and determine execution permissions.

## Ownership

| Concern                              | Owner                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio/index.ts` (facade) + `host.ts`, `sfx.ts`, `music.ts`, `music-player.ts`, `state.ts`, `preload.ts`, `volume.ts`, `url.ts`, `element.ts`, `reset.ts`                     |
| Player volume values and bounds      | Defaults in `src/lib/game-constants/settings.ts`, ranges in `src/lib/settings-values.ts`, live pct in `settings-store.ts`, runtime fraction in `src/lib/audio/state.ts`               |
| Sound-to-content registration        | `src/lib/audio/sound-registry.ts` + `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`                                                                                   |
| Screen ambience loops                | `src/lib/audio/ambience.ts`, screen mappings in `sound-registry.ts`, lifecycle in `useAppAudioEffects`                                                                                |
| Single music catalog and boss map    | `src/lib/audio/music-catalog.ts` (`MUSIC_CATALOG`, boss lookup, volume curve)                                                                                                         |
| Bestiary boss preview                | `src/lib/audio/music.ts` (`previewBossMusic`/`endBossPreview`), called by `collection-screen.tsx`                                                                                     |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` (`useAppAudioEffects`)                                                                                                                                   |
| Desktop capability                   | `src/lib/audio/host.ts` reads `src/lib/desktop-api.ts` (foreign Electron hosts stay silent)                                                                                           |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                                                                                     |
| Playback test setup                  | `tests/helpers/fake-audio.ts` creates injected media for Node player tests; `tests/helpers/audio-fixture.ts` installs the shipping adapters and resets them for DOM integration tests |
| Asset/pipeline test                  | `tests/lib/audio/audio-assets.test.ts` (disk + `scripts/assets/*` validators; run on registry/asset/pipeline changes)                                                                 |

## Local lyric alignment experiment

The [alignment tool](../scripts/lyrics-trial/README.md) owns model setup,
phrase detection, vocal recovery, provenance and known timing gaps. Running it
creates review candidates; replacing a runtime snapshot requires checking performed
coverage and audible synchronization. Source sheets, MP3 metadata or structurally
valid times alone cannot establish accuracy. Uncertain passages use bounded
`[growls]`, `[chants]` or `[vocalizing]` cues, not asserted words.

Runtime snapshots in `src/lib/audio/lyrics/` register through `lyrics.ts`, tied to
recordings by SHA-256. `Boss Lyrics` defaults on in the normal settings codec.
The battle leaf samples the active key and actual media position from
`readMusicPlayback()`, following seeks and loops; it clears on other tracks,
pauses, mute and instrumental gaps. One frame callback runs only while enabled
boss lyrics are mounted; React updates only on visible word/highlight changes.
No alignment model, decoding or per-word timer runs in the game.

Words enter with a 180ms opacity/scale pop; prior words dim and stay still, and
only the current whole word is gold. [Battle UI](./UI_BATTLE.md#boss-lyrics) owns
placement. Iron Bear uses original recording timestamps including its playback
skip, without a second offset. Sung words keep the recording's language; the
accessible label and bracketed vocal cues use the interface language.

## Runtime contract

### Shared playback rules

Playback modules live together in `src/lib/audio/`; callers use `@/lib/audio`, backed by `index.ts`. `getSoundUrl` is exported once from the facade (owner `url.ts`); `isAppInBackground` is exported once from the facade (owner `host.ts`). Tests mirror this folder in `tests/lib/audio/`, with `*.dom.test.ts` identifying tests that need browser APIs.

- Only the active audible host plays sound. Foreign Electron hosts, automated browsers, and undisplayed windows remain silent. Host muting is re-evaluated on lifecycle updates so an initially undisplayed player window can become audible when shown. `hasVisibleWindowArea()` in `host.ts` is the shared visibility check; `shouldTreatAsBackground()` holds the pure background decision and `isAppInBackground()` is its DOM-reading wrapper for app lifecycle wiring.
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences. Settings store percents (0–100); the audio runtime holds fractions (0–1) converted once in `useAppAudioEffects`, with `clamp01` applied locally on fractions only. Test resets go through `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts` (volumes stay owned by the test).
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.

### Loading and registration

- `useAppAudioEffects` starts best-effort warming when the app shell mounts after the startup gate. UI sounds and the draw-transfer cue warm immediately; the remaining manifest warms in one input-idle callback. Startup does not wait for audio fetching or decoding. Battle initialization also warms the full battle event set, opening-hand cards, and enemy ability cards.
- Sound warmups release stalled sources after 15 seconds. Completion, failure and reset clear that deadline; completed sources retain their warm cache, and late callbacks cannot revive abandoned work.
- Crafted Mixed Potion IDs resolve to the base Potion sound for both playback and battle preloading.
- Every card and companion has a nonempty focal registration, enforced by exact catalog coverage in `tests/lib/audio/sound-registry.test.ts`. Companion turns select from their actual resolved effects; summoning cards retain their authored arrival cue. Enemy turns use ability card cues, and Bestiary portrait clicks have no sound effect. Gold gain/spending remain distinct, and explicit UI/service silence remains intentional.
- Card selections in drafting, Transmutation and Corruption, plus battle draw-batch acknowledgment, are intentionally silent. Successful Transmutation plays the existing card-reward chime (`talentUnlock`) once after the covering save; resuming its result screen is silent. Card movement into the hand retains its separate draw-transfer cue.
- UI event keys remain available when their cue is `null`. Playback and preloading skip these explicit silence choices. Resolved registrations and processing inputs live in [the approved cue mappings](./design/audio-review/approved-choices.json).

### Music lifecycle

Music playback has one lifetime owner in `music-player.ts`: cached records bind the track key,
media element, and fade gain. Its playback state distinguishes idle, paused,
playing, fading in, and fading out; only fading out carries a pending destination.
Fade states own their timers, and cancellation invalidates their callbacks.
`state.ts` contains shared preferences, never playback pointers or cooldowns.
Volume controls call `syncMusicSettings()` so updates retain the actual playing
track's boss boost and fade gain. `music.ts` constructs the shipping player and adapts browser media, host eligibility,
track selection, settings, clocks, timers, and diagnostics. The player receives those
dependencies explicitly; its caches, preview state, and transitions belong to each
instance. Reset releases only that instance's media and timers. The catalog and
volume curve live in `music-catalog.ts`, independent of browser initialization.
Core lifecycle tests run in Node with injected media and scheduling; DOM suites
protect the shipping adapter, settings, host recovery, and screen integration.
Play attempts own their failure callbacks: pause, reset, invalidation, or a newer
attempt revokes late failures. Failed track setup releases its partial media
element. Invalidation releases the source without seeking a discarded track;
reset revokes playback before releasing every cached source.

- Starting a battle invalidates the upcoming enemy's battle music cache, even while the previous screen remains visible. It preserves menu playback until navigation selects the battle track. Invalidating the currently playing key forgets it entirely, so the next play builds a fresh track.
- Invalidating either the playing track or the pending destination cancels the transition. Invalidating the playing track stops playback; invalidating only the destination restores the outgoing track to full gain. Unrelated cache invalidation leaves playback and its fade alone. A later explicit play can build the invalidated track afresh.
- If the destination track cannot initialize after a fade-out, restore the outgoing track's configured volume. The failed destination remains uncached and can be retried on the next request.
- Pausing cancels the pending destination and fade. Settings updates keep a paused track muted even if the media pause failed. Resuming the paused track restores its configured volume and mute state; selecting another track starts a new transition. Diagnostic failures cannot interrupt cleanup or replacement playback.
- Restoring an undisplayed player window resumes paused music for the current screen, including its boss track, even after startup gesture recovery has completed.
- Unknown music keys are ignored: the current track, its key, and any bestiary preview stay untouched. Pausing all music also ends any bestiary preview.
- Startup gesture recovery retries paused music on foreground input until playback starts, then removes its listeners. A blocked attempt does not consume the only recovery opportunity; background and non-player hosts remain silent.

### Sound effect lifecycle

One-shot sound effects have one lifetime owner in `sfx-player.ts`. `sfx.ts` selects registered
sounds and adapts browser media, settings, clocks, and timers to that player.
Each cue moves from ready to pending or playing, then finished. Stopping battle
sounds and resetting the runtime use the same idempotent disposal path, which
cancels timers, detaches handlers, and releases stopped media sources. Reset
also disposes UI sounds and stingers. Cooldown reservations belong to the player;
identity checks prevent an older failed play from clearing a newer reservation.
Finished cues ignore late failure callbacks, including callbacks after reset.
Core SFX scheduling, cooldown, and disposal tests use the injected Node player;
the DOM adapter test protects cue routing, mute, and battle cleanup. Media release
attempts pause, source removal, and reload independently so one failure cannot
skip the remaining cleanup. Preload completion similarly revokes its handlers,
including callbacks already queued before success or cancellation.

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

### Battle sound focus

Accepted cards and enemy abilities select one cue from their committed results
before playback. Authored sword, bow, bite, food, Potion, ritual and movement
identities remain the ordinary cues. Maul, Cinderbloom, Sunburst, Blessed Aegis,
Molten Bulwark, Golden Plate, Spiked Shield, Pixie Dust, Shield Bash, Astral Arrow,
Holy Radiance, Burning Blade, Cauterize and Bellows Blast follow their actual
resolved outcome. Companion turns use their actual damage/healing/status results;
summoning cards retain their arrival cues.

Shatter uses its existing impact recording without implying a Critical.
Thunderclap and Frostfire reuse ordinary typed-damage selection and existing
assets; their reaction names use the existing combat announcements.

Death's Door replaces the ordinary action cue. Actual Shatter, Dodge, Freeze and
Stun outcomes precede ordinary results; prepared, removed and immune statuses are
not control procs. Otherwise summed damage by keyword and direct/periodic role, actual Health restored,
Block gained and Block absorbed compete. Ties favor damage, healing, then Block,
with source order retained within a priority. Mana, Gold, Armor, Forge, Thorns,
Wish and draw are semantic fallbacks; stripping and spending do not add strength.
Critical Health-damage metadata selects a typed critical recording for the winning
damage result. There is no universal metallic critical layer or extra Wildfire
sound over a focal cue. Slash/Stab retain weapon criticals; Astral Arrow uses one
bow-plus-element recording matching its actual element, with corresponding critical
revisions. Periodic Poison and Bleed retain separate tick recordings.

Feedback packet metadata carries actual `healthLost` and `absorbedDamage` when
the resolver has those facts; displayed damage and Block spending amounts stay
unchanged. Merging sums these resolved facts and keeps direct hits separate from
periodic ticks. Self-costs and stripped Block use non-impact feedback.

The chosen filename travels to later text presentation so it cannot replay or add
a second cue. Playback returns this filename even when muted or cooldown-suppressed;
it does not claim output was audible. Accepted Cleanse still sounds when it removes
nothing. End Turn and Wish selection acknowledge successful commits. Slice death,
quiet paper movement and outcome stingers remain separate beats. Separate actions
may overlap; no new global voice-stealing policy is introduced.

Current recording identities, source hashes, processing and excerpt boundaries
live in [approved cue mappings](./design/audio-review/approved-choices.json) and
the [sound manifest](../scripts/assets/sound-assets.mjs). Those owners also supply
battle auditions; this guide does not maintain a second cue inventory. Perceptual
and hardware mix acceptance still requires listening.

## Sound desk

The standalone [Sound desk guide](../scripts/audio-review/README.md) owns
preparation, listening queues, choice import/export and preview validation.
`npm run audio:review -- --serve-only` reopens an existing local snapshot.
Preparing replacement auditions requires an explicit `--library <Sounds directory>`;
production sound preparation uses committed `assets/sources/` masters.
Audition choices do not install production replacements.

## Battle replacement auditions

Use [focused auditions](../scripts/audio-review/README.md#battle-replacement-auditions)
for card and Companion replacements. Enemy abilities follow their card cue;
Companions and summon cards share one listening decision.

Approved installation follows the [runtime contract](#runtime-contract) and
[asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound). Perceptual suitability
and loop seams require listening; path/hash/decode checks establish only identity
and structural validity.
