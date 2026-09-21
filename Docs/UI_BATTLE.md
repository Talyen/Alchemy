# Battle UI

Shared conventions: [UI](./UI.md).

## Battle feedback

Resolved actions show compact bursts over each affected combatant. Floating
feedback uses icons and numbers; notices have descriptive accessible labels but
no visible words. Purge and Cleanse pair their icons with the affected status;
preparations pair a preparation icon with their existing armed-status icon.
Death’s Door retains its skull. Draws, summons, and scheduled effects acknowledge
their actual outcome; a valid ineffective action can show its effect icon with 0.
Nonzero results suppress redundant zero entries in the same action.

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
curves live in [combat text](../src/features/alchemy/shared/ui/battle/combat-text.tsx);
lifetimes and limits live in [motion constants](../src/lib/game-constants/ui-motion.ts).
Do not duplicate outline elements or animate shadows. Implementation and playback
ordering follow [the battle workflow](./WORKFLOWS.md#change-battle-playback).

Divine Intervention readiness uses an armed player status chip, not another floating notice. Its tooltip explains the extra choice, nonstacking behavior, and combat lifetime.

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
and do not inherit the hero's description context. Ability tooltip text is universal: edit the canonical card description once for
all inspection and play surfaces.

Enemy portrait tooltips show traits only, with no repeated-attack text, ability
cards, or upcoming-action indicator. `EnemyTraits` renders the same named trait
sections in Battle hover, Bestiary hover, and the modal. Each subheader pairs a
small static Lucide icon with `ShineText`; colors come from up to three distinct
keywords in description order through `getKeywordTextShineColors`. Descriptions
use the shared keyword tokenizer for bold/color emphasis. No-keyword titles use
the normal neutral fallback. Encounter modifiers use the same rendering and are
shown once in their existing separate group. Enemy trait copy refers to heroes.

Opening inspection dismisses the portrait tooltip through its standard fade.
`useHoverVisible` supports `suspended` and `dismiss`: restored focus must not flash
the old tooltip back; deliberate pointer movement or a new focus visit can show
it again. While the modal is open, Battle input, autoplay, and automatic End Turn
use the shared inspection gate. Opening is restricted to the same safe decision
window as deck inspection. Modal dismissal and focus return follow the shared
overlay lifecycle.

Bestiary clicks retain the enemy sound and Boss music preview. Opening, closing,
and reopening the modal do not restart or stop preview music; existing page/tab
changes still restore menu music. Undiscovered entries retain their current
concealment and audio behavior and cannot open inspection.

## Corrupted card text

Corrupted card titles retain the animated red-and-white shine on the “Corrupted” prefix only. Corrupted numerical values use solid `text-destructive` dark red with no animation. Keywords retain their normal colors, including added Leech and Consume; removed Consume disappears without a placeholder. The altar uses the existing card picker and before/after result, with no extra outcome choices or previews.
