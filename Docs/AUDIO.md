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

## Ownership

| Concern                              | Owner                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playback host, cache, music, and SFX | `src/lib/audio/index.ts` (facade) + `host.ts`, `sfx.ts`, `music.ts`, `music-player.ts`, `state.ts`, `preload.ts`, `volume.ts`, `url.ts`, `element.ts`, `reset.ts`                 |
| Player volume values and bounds      | Defaults in `src/lib/game-constants/settings.ts`, ranges in `src/lib/settings-values.ts`, live pct in `settings-store.ts`, runtime fraction in `src/lib/audio/state.ts`           |
| Sound-to-content registration        | `src/lib/audio/sound-registry.ts` + `COMPANION_SOUND_CARD_IDS` in `src/lib/game-constants/audio.ts`                                                                               |
| Screen ambience loops                | `src/lib/audio/ambience.ts`, screen mappings in `sound-registry.ts`, lifecycle in `useAppAudioEffects`                                                                            |
| Single music catalog and boss map    | `src/lib/audio/music-catalog.ts` (`MUSIC_CATALOG`, boss lookup, volume curve)                                                                                                     |
| Bestiary boss preview                | `src/lib/audio/music.ts` (`previewBossMusic`/`endBossPreview`), called by `collection-screen.tsx`                                                                                 |
| App lifecycle wiring                 | `src/app/use-app-effects.ts` (`useAppAudioEffects`)                                                                                                                               |
| Desktop capability                   | `src/lib/audio/host.ts` reads `src/lib/desktop-api.ts` (foreign Electron hosts stay silent)                                                                                       |
| Authored files and optimized outputs | [WORKFLOWS-ASSETS.md](./WORKFLOWS-ASSETS.md#add-or-replace-sound)                                                                                                                 |
| Playback test setup                  | `tests/helpers/audio-fixture.ts` (`installCleanAudio`) over `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts`; `tests/helpers/fake-audio.ts` only for mid-test stub swaps |
| Asset/pipeline test                  | `tests/lib/audio/audio-assets.test.ts` (disk + `scripts/assets/*` validators; run on registry/asset/pipeline changes)                                                             |

## Local lyric alignment experiment

The [boss karaoke experiment](../scripts/lyrics-trial/README.md) runs local
word alignment against supplied lyrics and provides a standalone preview.
Phrase-bounded timing snapshots for The Blight Treant, The Forge Golem,
The Frostwarden and The Iron Bear live in `src/lib/audio/lyrics/`, each tied to
its recording by SHA-256. `lyrics.ts` registers them by music key. The new lyric
sheets are retained in `scripts/lyrics-trial/` and match the supplied sheets and
the MP3 lyric metadata; section labels and sound directions are excluded.
Unclear Forge Golem chant groups use bracketed vocal cues.
The experiment remains a separate comparison tool. Generated timings still need
performance-coverage and audible synchronization review; coverage metadata
records undetected phrases and unmatched ASR words rather than forcing them
into the timeline. Treant's existing snapshot has two undetected introductory
lines and two unmatched ASR words.

Targeted vocal-stem recovery restores Iron Bear's three rejected chorus repeats
and second "singe through hide" line, plus four missing Frostwarden lines.
The two adjoining Frostwarden "Melts me" responses are realigned so they no
longer consume the preceding "What burns me" call. The
[recovery workflow](../scripts/lyrics-trial/README.md#targeted-vocal-stem-recovery)
retains source hashes, search windows and model settings. These lines were in
the supplied sheets; detection and invalid word timings caused their omission.
Iron Bear's growled bridge, final "remember what you bleed" and one backing
vocal, Forge Golem's chants, and Frostwarden's "Aaaah" remain unresolved as exact
word alignments. These passages now display `[growls]`, `[chants]`, or
`[vocalizing]` in bounded vocal windows. Clear adjoining lyrics retain their word
timings. Cue boundaries are manually annotated from the separated vocal timeline;
they describe the passage without asserting its words. This does not establish
that the supplied words are absent from the recordings.

`Boss Lyrics` in Audio settings defaults on and persists through the normal
settings codec. The battle lyric leaf samples `readMusicPlayback()` from the
music player, using the active track key and actual media position rather than
an elapsed wall clock. It clears for other tracks, pauses, mute, and instrumental
gaps, and follows seeks and loops. Sampling uses one animation-frame callback
only while an enabled boss with timing data is mounted; React updates only when
the visible words or highlight change. Words build the phrase as sung, with a
180ms opacity and small scale pop on entry. Earlier words stay dim and still;
only the current whole word uses the gold highlight. No alignment models,
transcription, audio decoding, or per-word timers run in the game.
Iron Bear timings use the original recording's timestamps, including its
six-second playback skip; no second offset is applied. Sung words remain in the
recording's language when the interface language changes. The accessible
"Song lyrics" label and bracketed vocal cues follow the interface language.

## Runtime contract

### Shared playback rules

Playback modules live together in `src/lib/audio/`; callers use `@/lib/audio`, backed by `index.ts`. `getSoundUrl` is exported once from the facade (owner `url.ts`); `isAppInBackground` is exported once from the facade (owner `host.ts`). Tests mirror this folder in `tests/lib/audio/`, with `*.dom.test.ts` identifying tests that need browser APIs.

- Only the active audible host plays sound. Foreign Electron hosts, automated browsers, and undisplayed windows remain silent. Host muting is re-evaluated on lifecycle updates so an initially undisplayed player window can become audible when shown. `hasVisibleWindowArea()` in `host.ts` is the shared visibility check; `shouldTreatAsBackground()` holds the pure background decision and `isAppInBackground()` is its DOM-reading wrapper for app lifecycle wiring.
- Player volume and mute behavior use the shared settings values; do not introduce audio-local bounds or persisted preferences. Settings store percents (0–100); the audio runtime holds fractions (0–1) converted once in `useAppAudioEffects`, with `clamp01` applied locally on fractions only. Test resets go through `resetAudioRuntimeForTests()` in `src/lib/audio/reset.ts` (volumes stay owned by the test).
- Playback failures are non-fatal: report useful diagnostics and continue. Audio failure must not block startup, navigation, battle, saves, or quit.
- Cache, preload, deduplication, and playback lifetime remain below UI callers. Screens request semantic sounds rather than managing media elements.

### Loading and registration

- `useAppAudioEffects` starts best-effort warming when the app shell mounts after the startup gate. UI sounds and the draw-transfer cue warm immediately; the remaining manifest warms in one input-idle callback. Startup does not wait for audio fetching or decoding. Battle initialization also warms the full battle event set, opening-hand cards, and enemy ability cards.
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

- Starting a battle invalidates the upcoming enemy's battle music cache, even while the previous screen remains visible. It preserves menu playback until navigation selects the battle track. Invalidating the currently playing key forgets it entirely, so the next play builds a fresh track.
- Invalidating either the playing track or the pending destination cancels the transition. Invalidating the playing track stops playback; invalidating only the destination restores the outgoing track to full gain. Unrelated cache invalidation leaves playback and its fade alone. A later explicit play can build the invalidated track afresh.
- If the destination track cannot initialize after a fade-out, restore the outgoing track's configured volume. The failed destination remains uncached and can be retried on the next request.
- Pausing cancels the pending destination and fade. Resuming the paused track restores its configured volume and mute state; selecting another track starts a new transition.
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

Trinket's Heal, Holy impact, Gut Punch, control activation, Dodge, Salvage,
talent-unlock, toggle and short Victory recordings are adopted through the source
manifest. Corruption uses the dark Life Tap cue; structure improvements use the
hammer cue and companion bonding retains the positive piano. The short rock
revision used by Meteor/Earthquake selects 0–1.2 seconds; shared revisions and
critical/bow processing are recorded by the Asset Library's
`Sounds/Game Sources/Sound Effects/Shared Revisions/sound_fit_20261015/sources.json`.
Both games retain their own encoders and user-volume controls. Perceptual and
hardware mix acceptance remains pending.

The [focused Sound desk](#battle-replacement-auditions)
covers card and companion cues. Exorcism uses
Purge; Prayer uses the shorter choir excerpt; Avatar uses the longer
choir excerpt. The selected files, source hashes and exact excerpt boundaries
are recorded in [the approved cue mappings](./design/audio-review/approved-choices.json).

## Change checklist

1. Register new card or companion sounds in the owning sound registry or audio module (`sound-registry.ts`, `COMPANION_SOUND_CARD_IDS`); the exact catalog coverage in `tests/lib/audio/sound-registry.test.ts` requires a nonempty focal registration for new content.
2. Add or replace source audio through [the asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound) and regenerate committed outputs.
3. Keep host visibility, volume, cache, and failure behavior in the runtime audio owners above.
4. Run focused unit suites with `npm run test:full -- tests/lib/audio` and any affected lifecycle tests, then the task-scoped local gate. Browser playback verification uses `npm run test:e2e:route -- audio` under the [local execution policy](../CONTRIBUTING.md#what-to-run-when-you-change).

Changed-path and CI tier policy: [CONTRIBUTING.md](../CONTRIBUTING.md#what-to-run-when-you-change).

## Sound desk

Generate preview copies under ignored `reports/audio-review/` with
`npm run audio:review`. Reopen an existing snapshot with:

```sh
npm run audio:review -- --serve-only
```

Open [Sound desk](http://127.0.0.1:4317/). Stop the server with Ctrl+C. It binds
only to localhost and serves an explicit list of board files and prepared media.
It does not expose the Asset Library or repository as a general file server.

To regenerate from the curated manifest and current game catalogs:

```sh
npm run audio:review
npm run audio:review -- --check
```

`--check` checks content coverage, current source identity, candidate file paths
and hashes without writing previews. Generation converts and decodes both
preview levels before publishing them. Source hashes and output hashes protect
the preview cache. Identical recordings with the same excerpt share one conversion,
even under different source IDs, while retaining each source's identity and provenance.
Preview duration comes from PCM audio data, so embedded recording metadata cannot
inflate it; cache hits recompute duration from the verified bytes as well.
Local snapshots expire after 24 hours when no artifact tool is active; regenerate them when missing. Missing or undecodable selected media fails generation;
the generated board still exposes the failure for inspection. Unselected stale
catalog paths are reported separately.

Use `--library '/full/path/to/Sounds'` for a relocated library and `--port 4318`
if the default port is occupied. Serve at the same port to retain browser-local
choices. `--serve` regenerates and launches in one command. `--serve-only` opens
the last generated snapshot; regenerate after changing mappings or game content.
If the existing encoder dependency lacks its binary, restore it with
`node node_modules/ffmpeg-static/install.js`. No additional dependency is needed.

## Battle replacement auditions

Prepare the focused card and companion rows and start a separate review session:

```sh
npm run audio:review -- --battle-focus --serve --port 4318
```

Most rows have two short, level-matched candidates and their current cue or silence.
Exorcism and Prayer each have four options, including their original pair.
The queue includes Avatar, Exorcism, Sanctified Plate, Tithe, Prayer, Wishing Well,
Will-o'-Wisp and Library Owl. Companion selections also apply to their summoning
cards. Enemy abilities use the selected card's focal sound; there are no separate
enemy or Bestiary sound choices.

Will-o'-Wisp has one listening decision shared by the companion and summoning
card. The companion row owns the choice in the focused queue; the summoning
card follows it in the whole-game queue and exports.

Focused previews and imported choices live in `reports/audio-review/battle-focus/`.
Their browser storage is separate from whole-game choices. Use
`--battle-focus --serve-only --port 4318` to reopen the prepared session, or add
`--battle-focus --choices '/full/path/to/export.json'` when importing it. Export
choices after listening; these previews do not install production replacements.

When `reference/catalog.csv` is absent, generation checks selected master files
and hashes directly. Recording and pack names are inferred from filenames and
labeled as such; catalog provenance is not invented. Malformed existing catalogs,
missing files and conflicting source identities still fail. Long recordings use
explicit short excerpts selected from signal levels, with 5 ms edge fades.
The old Doppler/Weirdness proposal sources are no longer present in the library;
available casting takes replace them for this review.

## Review workflow

The default **Remaining** queue shows one undecided mapping at a time. Existing
choices are skipped, and the header shows total progress.

1. Listen to Current, Recommended, or an Alternative. Listening does not select it.
2. Click **Choose this**, **Keep current**, or **No sound** once. The decision saves,
   marks the mapping reviewed, and advances to the next undecided mapping.
3. Use **Undo last choice** to restore the previous decision and notes. Skip/Next
   leaves the mapping undecided; Chosen lets you revisit saved decisions.
4. Export your choices before sharing them or changing browsers/ports.

Keyboard shortcuts: **1** keeps current, **2–5** choose candidates, **0** chooses
silence, and arrow keys navigate. Shortcuts ignore typing in notes, search and
select controls. No cue plays automatically when the queue advances.

Notes, rationales and source details are collapsed. **More controls** contains
level switching, extra filters, action sequences/repeats and an option to disable
automatic advance. Current sequences omit silent and registered-unused cues;
Your choices use the recommendation for undecided steps, as labeled.

To carry an exported batch into the board, regenerate with:

```sh
npm run audio:review -- --choices '/full/path/to/alchemy-audio-choices.json'
```

Imports merge into an ignored local `reports/audio-review/imported-choices.json`
snapshot, retained by later regeneration. The board merges imported decisions
with browser-local choices; valid browser choices take precedence. Unknown
mappings or stale candidate IDs reject the import without replacing the snapshot.
Only choice IDs, notes and review state are imported; source metadata is resolved
from the current mappings. Imported files are never modified.

Playback stops when another audition starts, filters change, the page becomes
hidden, or Stop all is pressed. Sequence repetition does not trigger gameplay.
Browser autoplay restrictions or audio failures leave the board usable and show
a visible message. Essential in-game feedback must continue to work under mute.

## Sound desk validation

Every card and companion requires an explicit assignment; battle/UI/stinger
registrations need review rows. Destination and keyword inventories are checked.
New content without an assignment fails validation. Path, hash and decode checks
cannot establish audible suitability; listen before choosing takes, trimming,
layering or approving loop seams.

Matched previews use fixed gain toward −22 dB mean, capped at −1.5 dB peak and a
+12 dB boost. They preserve dynamics. Original-level previews apply no gain.
Both levels are 48 kHz stereo 16-bit PCM copies, with excerpt boundaries visible.
The production sound pipeline retains its own loudness/OGG/MP3 policy.

The catalog's four stale protected-master paths are listed in the board and report;
none is selected. Provenance stays attached to candidates. Unattributed library
entries are explicitly unverified; they are audition references, not cleared
shipping selections. The library's own listening-review flag is also visible.

## Owners and artifacts

- [Curated manifest](./design/audio-review/mappings.json): candidate IDs/paths, excerpts, rationales,
  explicit content assignments, action evidence and sequence definitions.
- `scripts/audio-review.mjs`: generation, validation and launch command.
- `scripts/audio-review/`: mapping validation (`core.mjs`), preview media (`media.mjs`), localhost serving (`server.mjs`), standalone board and isolated playback.
- `reports/audio-review/index.html`: generated board, opened through localhost.
- `reports/audio-review/mappings.json`: resolved whole-game mapping, media identity,
  provenance, current registration/state, coverage and source-code evidence index.
- `reports/audio-review/report.md`: full readable report and prioritized proposals.

Generated media and reports are ignored. The manifest and tool are reproducible
without committing library audio. Current cue identity compares library hashes
against shipped bytes and authored sources; a renamed copy is labeled as the
same recording rather than a replacement. Evidence rows are an inspection index,
not proof that every string occurrence executes; current action classifications
come from reading their callers and transaction owners.

After listening decisions, approved gameplay installation should use the canonical
[runtime contract](#runtime-contract) and [asset workflow](./WORKFLOWS-ASSETS.md#add-or-replace-sound).
This proposal pass does not activate currently unused registrations.
