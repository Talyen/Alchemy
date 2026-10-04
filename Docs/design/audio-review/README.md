# Alchemy sound desk

Whole-game sound proposals in a **tactile fantasy** direction: paper, metal,
glass, organic magic, restrained frequent cues and stronger major outcomes.
This is a review tool. It does not change gameplay audio, saves, shipped assets,
or library masters. Full background-music replacement is outside this pass.

The completed export has now been applied to gameplay through the canonical
audio owners. See the [installation record](./INSTALLATION.md) for decisions,
source processing, verification and remaining listening checks. The board itself
continues to save review choices only.

## Open the audition board

The initial board and all preview copies are already generated locally under
`reports/audio-review/`. Launch them with:

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
the preview cache. Missing or undecodable selected media fails generation;
the generated board still exposes the failure for inspection. Unselected stale
catalog paths are reported separately.

Use `--library '/full/path/to/Sounds'` for a relocated library and `--port 4318`
if the default port is occupied. Serve at the same port to retain browser-local
choices. `--serve` regenerates and launches in one command. `--serve-only` opens
the last generated snapshot; regenerate after changing mappings or game content.
If the existing encoder dependency lacks its binary, restore it with
`node node_modules/ffmpeg-static/install.js`. No additional dependency is needed.

## Battle replacement auditions

The focused choices are now installed. [The validated approval snapshot](./battle-focus-approved-export.json)
preserves all sixteen submitted selections; its archive note records that the
Downloads file disappeared after validation, before copying. The source masters
and original whole-game export are preserved. Current/selected comparisons use
the installed clips when this review is regenerated.

Prepare the sixteen requested battle rows and start a separate review session:

```sh
npm run audio:review -- --battle-focus --serve --port 4318
```

Most rows have two short, level-matched candidates and their current cue or silence.
Exorcism and Prayer each have four options, including their original pair.
The queue includes Avatar, Exorcism, Sanctified Plate, Tithe, Prayer, Wishing Well,
both Will-o'-Wisp roles, Library Owl, Cleric, Inquisitor, Paladin, Seraph, Zealot,
Giant Snake and Giant Spider. Companion selections also apply to their summoning
cards; enemy rows choose fallback/Bestiary cues, while ability turns retain the
ability card's focal sound.

Will-o'-Wisp has one listening decision: the enemy choice automatically applies
to the companion and summoning card. The dependent companion row is omitted
from the queue and progress count, but its matching choice is included in exports.
The focused queue therefore contains fifteen decisions for sixteen targets.

Focused previews and imported choices live in `reports/audio-review/battle-focus/`.
Their browser storage is separate from the previous whole-game choices. Use
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

## Coverage and first-pass proposal priorities

The first pass covered **87 action categories, 105 cards, 39 enemies, 14 companions
and all 25 screens**, with 49 reusable families and 106 distinct candidate masters.
Every card, enemy and companion has an explicit assignment; every battle/UI/
stinger registration has a review row. Destination and keyword inventories are
also checked. New content without an assignment fails validation.

| Review first            | Proposal                                                                                                                                        | Reason                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Archery                 | Shared bow-release family, with elemental exceptions noted                                                                                      | At the first pass, Archery cards lacked card-specific sounds               |
| Block and armor         | Medieval armor parry                                                                                                                            | Material match; compare gain and absorption separately                     |
| Hero / enemy impact     | Short deep body hit                                                                                                                             | Avoid a sword identity on every damage source                              |
| Potions and brewing     | Glass pour, bottle opening, fizz and gurgle                                                                                                     | Replace generic pickup/water treatment with alchemy materials              |
| Gear crafting / salvage | Anvil strike / short debris crack                                                                                                               | Distinguish crafting from talent unlock and salvage from mining            |
| Boss fallback attacks   | Forge Golem: anvil; Frostwarden: ice; Blight Treant: wood; Iron Bear: heavy impact; Blood Countess: Life Tap; Seraph: chime; Stone Titan: rocks | Review each boss's ability cards too; ability turns use those cues first   |
| Gold and transactions   | Coins in a sack / soft-surface coin drop                                                                                                        | Short tactile acknowledgment; avoid a second spend cue on the same service |
| Victory / defeat        | Keep current harpsichord takes as the leading candidates                                                                                        | Existing recordings remain useful; replacements need a listening reason    |

These were **metadata-based, unheard proposals** at the first pass. The later
listening decisions and installed results are recorded in the
[installation record](./INSTALLATION.md); this table preserves the original
review priorities. Path, hash and decode verification alone cannot establish
audible suitability. New proposals still require listening for take selection,
trimming, pitch, layering and loop seams.

Matched previews use fixed gain toward −22 dB mean, capped at −1.5 dB peak and a
+12 dB boost. They preserve dynamics. Original-level previews apply no gain.
Both levels are 48 kHz stereo 16-bit PCM copies, with excerpt boundaries visible.
The production sound pipeline retains its own loudness/OGG/MP3 policy.

The catalog's four stale protected-master paths are listed in the board and report;
none is selected. Provenance stays attached to candidates. Unattributed library
entries are explicitly unverified; they are audition references, not cleared
shipping selections. The library's own listening-review flag is also visible.

## Owners and artifacts

- [Curated manifest](./mappings.json): candidate IDs/paths, excerpts, rationales,
  explicit content assignments, action evidence and sequence definitions.
- `scripts/audio-review.mjs`: generation, validation and launch command.
- `scripts/audio-review/`: standalone board and isolated playback owner.
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
[audio workflow](../../AUDIO.md) and [asset workflow](../../WORKFLOWS-ASSETS.md#add-or-replace-sound).
This proposal pass does not activate currently unused registrations.
