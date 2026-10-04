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

The original export selected silence for Prayer, Mana Moth, Will-o'-Wisp,
Library Owl, Card Shop removal, card hover, Collection paging and screen-transition
accents. The battle revisions below replace the four battle silence choices.
UI and service silence remains explicit.
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

## Battle focus revision — 2026-10-03

The requested focal-sound policy now suppresses routine effect layers, allows
one priority-selected special accent, and retains paper movement and major
outcome cues. Accepted no-effect Cleanse, End Turn, and Wish selection receive
acknowledgment; standalone Poison uses its dedicated tick cue.

Six card registrations (including Mana Moth) and three enemy fallbacks now reuse
shipped recordings. The resolved ledger's `runtimeRevisions` records these
explicit replacements and the standalone Mana/cleanse bindings; its original
choices and the submitted export remain preserved. The remaining eight card registrations and eight enemy fallbacks were installed
from the focused listening choices below.
See [the focused review instructions](./README.md#battle-replacement-auditions).

## Focused listening choices installed — 2026-10-03

All sixteen selected targets are now registered, completing focal coverage for
all cards, enemies and companions. Fifteen independent decisions resolve to
thirteen raw excerpts: Avatar and Seraph share a choir take, Tithe and Inquisitor
share a chime impact, and the enemy Will-o'-Wisp and its companion/summoning card
share the selected casting take. Exorcism uses Purge and Prayer uses the shorter
choir excerpt. Library Owl uses the magical grimoire; the Snake and Spider use
the selected creature recordings.

[The validated choice snapshot](./battle-focus-approved-export.json) was reconstructed
from the fully read, reviewed and hash-validated export after its Downloads path
became unavailable. This fact is recorded in the archive and installation metadata;
it is not presented as a byte-for-byte copy of the original download. All source
IDs, selected excerpt boundaries and empty listening notes preserve the supplied
choices. The existing whole-game export remains untouched.

Each new WAV is 48 kHz stereo 24-bit PCM with the same 5 ms edge fades as the
audition. The existing pipeline generated thirteen OGG files and thirteen MP3
fallbacks using its normal loudness policy. The ledger records library hashes,
raw excerpt hashes, bindings and processing. No library master or previous raw
source was overwritten or removed. Source attribution remains filename-derived
where the catalog was unavailable; the supplied reviewed choices record listening
approval. In-game balance and browser/Electron playback remain separate listening
and opt-in verification steps.

Review corrected the six excerpts with nonzero start offsets: seeking now happens
before decoding so the 5 ms fades apply to the excerpt's edges. The previous
ordering missed the fade-in and silenced the tail early. Source identities and
selected boundaries are unchanged; the corrected WAV hashes and regenerated
OGG/MP3 outputs are recorded in the ledger. A synthetic late-start excerpt test
checks that the middle stays audible and both edges fade.
