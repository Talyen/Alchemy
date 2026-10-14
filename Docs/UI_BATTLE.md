# Battle UI

## Shared tabletop appearance

Battle artwork shares one automatic scene treatment. The stage samples the selected
board thumbnail's central playing area once and caches the result by artwork URL.
Extreme pixels are rejected, luminance outliers are trimmed, and the resulting tint
has limited saturation and at most 6% opacity. Loading, missing boards, and sampling
failures use neutral grounding; late samples cannot repaint a different board.
No board, combatant, or card needs authored lighting metadata.

Framed portraits and cards use consistent contact and cast shadows. Transparent
pile and Mana artwork use silhouette shadows. Raised hand cards crossfade an
additional elevated shadow; card transfers, backs, play ghosts, Companions, and
death slices retain the same treatment. Shadow sizes follow content scaling.
The fixed tabletop clips overflow without becoming a scroll container, so focusing
partially concealed controls cannot shift the scene.

`BattleSceneArtwork` contains artwork-only tint, isolated from frames, labels,
Health, status icons, focus, keyword shine, and tooltips. Effects are scoped to
the Battle tabletop so shared cards and inspection overlays retain their normal
appearance elsewhere. Keep shadow filters on separate artwork wrappers so existing
damage, crowd-control, hover, and Mana filters continue to compose. There are no
continuous lighting updates, inferred light directions, extra glows, or asset variants.

Shared conventions: [UI](./UI.md).

## Battle feedback

Resolved actions show compact bursts over each affected combatant. Floating
feedback uses icons and numbers; notices have descriptive accessible labels but
no visible words. Purge and Cleanse pair their icons with the affected status;
preparations pair a preparation icon with their existing armed-status icon.
Death’s Door retains its skull. Draws, summons, and scheduled effects acknowledge
their actual outcome; a valid ineffective action can show its effect icon with 0.
Nonzero results suppress redundant zero entries in the same action.

Phoenix Feather revival shows its Feather notice and the Health restored, even
when revival leaves the final Health unchanged. Rejected Stun/Freeze buildup
during immunity pairs a shield icon with the affected status and an accessible
immunity label; it does not play a successful control cue. Zero damage retains
ineffective-action feedback without shaking a portrait.

Matching additive entries can sum across effects, cards, and actions during the
first 250 ms of the original burst. Match recipient, effect kind, resource/type,
and gain/loss direction; keep preparation refreshes and non-additive values out
of numeric sums. Identical notices deduplicate. Updates retain their original ID,
start time, animation, and expiry: merging never renews the window or lifetime.
Reserve tabular numeric width for the initial digits plus one extra digit and
its sign. Sums exceeding that width become separate entries. Partial matches
create a new burst only for unmatched entries. Expired/evicted entries cannot
return. The same window applies to reduced/disabled motion.

Notices come first, damage/loss next, healing/gains last, with stable order within
each group. Up to three numeric entries use one centered column; larger bursts
use two columns, with notices spanning both. Impact and audio cues follow each
incoming action's actual events, never accumulated display totals. Resource
payments and removals do not invent damage impacts.

Each action appears immediately above card flights, anchored to its moving portrait.
Measured layout moves earlier bursts upward without changing their values or
restarting their animations. Keep at most three active bursts per target; overflow
fades the oldest early without truncating the new action's types or queuing feedback.
Reduced motion or disabled animations remove pop, travel, and animated repositioning.
Use the existing game-delay policy and minimum readable lifetime; teardown cancels
all lifetimes and tracking stops when no bursts remain or the layer unmounts.

Preserve text and icon sizing, portrait-relative placement, and static dark outlines
and shadows for contrast against artwork. Exact geometry, typography, and animation
curves live in [combat text](../src/features/alchemy/run-loop/battle/presentation/ui/combat-text.tsx);
lifetimes and limits live in [motion constants](../src/lib/game-constants/ui-motion.ts).
Do not duplicate outline elements or animate shadows. Implementation and playback
ordering follow [the battle workflow](./WORKFLOWS.md#change-battle-playback).

Divine Intervention opens or queues an ordinary Wish under the [Talent rules](./TALENT_RULES.md#wishes-and-mana), using the existing [Wish interaction](./UI_BROWSING.md#rewards-and-wishes).

Manual unplayable-card attempts show a brief warm outline on the card, including
when Mana is insufficient, so rejection remains visible with sound muted. The
rejection sound reinforces this feedback; the Mana row stays unchanged. Repeated
attempts share a 260ms feedback window. Playback locks, hidden transfer
cards, and stale clicks remain silent. Automatic play does not trigger rejection
feedback. Existing unavailable appearance and inspection remain available.

Mana spending dims only the affected crystals; restoration brightens them with
a brief glint. Capacity gain introduces a gem; capacity loss removes
it with a small shard burst. Temporary bonus Mana disappearing only fades, rather
than shattering a capacity crystal. Unchanged gems retain their animation identity.
The frame stays still, and all effects follow displayed battle frames without
gating accepted gameplay. Initial mount and resume settle without effect replay;
reduced motion settles immediately, and presentation reset cancels pending exits.

## Boss lyrics

Timed boss lyrics sit centered across the space between the combatants and the
hand, without intercepting card input. Words appear as sung with a brief fade
and small pop; earlier words remain dim until the phrase ends. The gold highlight
switches directly between whole words. Instrumental gaps stay clear. Audio
settings owns the default-on **Boss Lyrics** switch; timing data and playback
synchronization follow the [audio contract](./AUDIO.md#local-lyric-alignment-experiment).

## Hand playability

`useHandPresentation` derives visual and interactive card eligibility together from
the current immutable battle snapshot and one presentation-store subscription.
The engine owns legality; presentation only excludes hidden cards from interaction.
Do not mirror engine field dependencies in a separate UI cache.

## Deck and pile inspection

The stacked-cards icon opens the run Deck during drafting,
run screens, and meta detours from that run. Drafting exposes picks so far through
the icon; it does not add a previous-picks strip. The icon has no tooltip. Draw
and Discard piles have keyboard-accessible inspection actions without visible
counters; counts remain in accessible action names.
Titled screen headers place Deck on the left alongside any Back control and Menu
on the right, with the title centered between them.

`CardInspectionOverlay` is controlled by props and reuses the modal shell,
`useDialogFocus`, card presentation, and adaptive pagination. Each copy remains
visible individually, sorted by displayed title with an instance-content tie
break independent of draw order. The grid uses [`viewCardWidthClass`](../src/features/alchemy/shared/config/layout.ts),
matching `CardSelectionGrid`’s reference width; larger Collection tiles do not fit
that measurement. The viewer shows only a centered collection title, cards,
and an upper-right close button, plus pagination controls when needed. It has no
collection tabs, counts, instructional text, or labels below cards. Empty collections
show the collection icon using the shared [overlay layout](./UI_INTERACTION.md#overlay-lifecycle).
Open each collection from its own opener. Pagination resets on reopening.
Full Deck is the run deck, including cards Consumed in the current battle;
battle-only generated cards appear in their current piles instead. Deck, Draw
Pile, and Discard Pile cards show their keyword Shine Border on hover or
keyboard focus, with neutral shine when no keywords resolve, matching
Collection, Wish, and reward choices.

Inspection opens only between actions on a surviving player’s turn, with no
Wish, pending transition, hidden hand card, card ghost, or card transfer. While
open it contains focus and blocks underlying input, autoplay, and automatic End
Turn without changing saved automation preferences. Navigation, run replacement,
battle teardown, or opening a peer menu closes it. Escape, backdrop, and the close
button dismiss it and return focus to the opener. Pile measurement wrappers must
match the artwork bounds: their button is block-level so inline baseline spacing
does not shift transfer anchors.

## Enemy inspection

Battle enemy portraits and discovered Bestiary entries open the shared
`EnemyInspectionOverlay`, sharing `InspectionPanel` and `InspectionCardGrid` with
deck inspection. The enemy name is the modal header, followed by Traits
and Abilities headings without a divider. Abilities reuse `BattleCardButton`,
`viewCardWidthClass`, the standard keyword border/hover behavior, and adaptive
card pagination. Cards show portrait art only; effects appear in ordinary card
tooltips on hover or keyboard focus. Inspection cards cannot be played or flipped
and do not inherit the hero's description context. Bestiary inspection uses
canonical card values. Live battle inspection passes `EnemyDescriptionContext`
to `getEncounterEnemyAbility` in `src/lib/battle/enemy-description.ts`, deriving
displayed amounts from the encounter's room scaling, ability pressure, and
difficulty modifiers. Trait descriptions use the same encounter context through
`getEncounterEnemyTrait`. These are presentation copies; never pass scaled cards
back into ability resolution or mutate the canonical catalog.

Enemy portrait tooltips show traits only, with no repeated-attack text, ability
cards, or upcoming-action indicator. `EnemyTraits` renders the same named trait
sections in Battle hover, Bestiary hover, and the modal. Each subheader pairs a
small static Lucide icon with `ShineText`; colors come from up to three distinct
keywords in description order through `getKeywordTextShineColors`. Descriptions
use the shared keyword tokenizer for bold/color emphasis. No-keyword titles use
the normal neutral fallback. Enemy artwork borders use keywords in those visible
Trait descriptions, including active encounter Traits; ability-only keywords do
not color the border. Encounter modifiers join native Traits in one deduplicated
list using the same rendering. Enemy trait copy refers to heroes.

Opening inspection dismisses the portrait tooltip through its standard fade.
`useHoverVisible` supports `suspended` and `dismiss`: restored focus must not flash
the old tooltip back; deliberate pointer movement or a new focus visit can show
it again. While the modal is open, Battle input, autoplay, and automatic End Turn
use the shared inspection gate. Opening is restricted to the same safe decision
window as deck inspection. Modal dismissal and focus return follow the shared
overlay lifecycle.

Bestiary clicks retain the Boss music preview without an enemy sound effect. Opening, closing,
and reopening the modal do not restart or stop preview music; existing page/tab
changes still restore menu music. Undiscovered entries retain their current
concealment and audio behavior and cannot open inspection.

## Corrupted card text

Corrupted card titles retain the animated red-and-white shine on the “Corrupted” prefix only. Corrupted numerical values use solid `text-destructive` dark red with no animation. Keywords retain their normal colors, including added Leech and Consume; removed Consume disappears without a placeholder. The altar uses the existing card picker and before/after result, with no extra outcome choices or previews.
