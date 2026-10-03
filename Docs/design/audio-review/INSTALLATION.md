# Approved Alchemy sound installation

The complete October 3, 2026 export covers **245 decisions: 104 selected candidates,
13 silence choices, and 128 choices to keep current behavior**.

- [Approved export](./approved-export.json) preserves the submitted choices.
- [Resolved installation ledger](./approved-choices.json) maps each decision to
  runtime filenames and records source paths, hashes, excerpts and processing.
- [Curated mappings](./mappings.json) now reference the installed registrations.

Forty selected excerpts resolved to **33 new raw WAV sources and seven existing
recordings**. Source hashes were checked against the external catalog before
import. New excerpts retain 24-bit PCM precision. Truncated excerpts receive
5 ms fades at their edges; the existing sound pipeline applies its normal
loudness treatment and generates committed OGG/MP3 variants. All external masters
and existing raw sources are preserved. Twenty obsolete derived cue pairs were
removed through the sound pipeline after their registrations were replaced or
silenced.

## Installed behavior

Selected cues cover cards, enemy fallback attacks, companion effects, combat
impacts and reactions, navigation, settings/autoplay toggles, starter drafting,
shop ingredients, brewing, Corruption/Transmutation selections, map interaction,
Gear equipping/crafting, companion Bond, confirmed destructive actions and run
completion. Successful transaction cues follow their committed outcomes.

The selected silence for Prayer, Mana Moth, Will-o'-Wisp, Library Owl, Card Shop
removal, card hover, Collection paging and screen-transition accents is explicit.
The remaining silence decisions preserve already quiet inspection/slider actions.

**Keep current** preserves existing behavior, including unused registrations.
Unreviewed activations are not inferred from those choices. Enemy ability turns
continue to use their card cue before any fallback attack sound. Summon and
companion-turn choices agree and retain the existing shared card mapping.

Campfire and Labyrinth/Mystery have quiet selected ambience loops. They stop on
departure, mute and teardown. Full music replacement is outside this installation.
The pack-open registration uses the selected card fan, but Alchemy currently has
no pack-opening action to attach it to; no new gameplay feature was invented.

## Verification and limits

The approved-choice contract checks every decision against the installed
registrations. Asset checks cover source ownership, on-disk outputs and Safari
fallbacks. Playback tests cover null cues, mute/volume, room-loop disposal, late
callbacks and combat signal selection. Selected clips were technically decoded;
subjective fit comes from the submitted listening choices.

Browser/Electron playback, loop polish and full builds remain separate opt-in
checks. The previously reported Mac speaker stutter was investigated separately;
this installation does not change macOS audio services or device settings.

Registry filename-shape tests duplicated the asset validator and were retired.
Two trivial SFX wrapper checks were also retired. The approved-choice, asset,
playback-lifetime and feedback-routing protections remain, with focused coverage
for the new ambience and battle signals.
