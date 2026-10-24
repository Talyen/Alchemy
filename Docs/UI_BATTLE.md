# Battle UI

## Battle layout

Draw Pile and Mana, the centered hand, and Discard Pile with End Turn form one
centered three-column group. Gaps follow
[the shared battle layout](../src/features/alchemy/shared/config/layout.ts);
the shared [display-sizing contract](./UI.md#display-sizing) governs scaling.

The hand rests against the bottom viewport edge as a centered fan, with capped
spacing, responsive card sizing and clearance for rotated artwork. Draw Pile sits beside the hand's left edge and Discard Pile
beside its right, both with their pile artwork in the bottom corners. Clicking either
pile opens that pile in the shared card viewer. Draw Pile also includes Hand Overflow
when cards are waiting for room. All battle transfer and feedback
coordinates use the full viewport scene.

Mana crystals sit centered above Draw Pile in the left bottom column. Their shallow
curved arrangement, recessed settings, spending, refill, capacity, hover glint, glow,
and shard effects remain intact. Full crystals retain subdued Mana blue; spent
crystals are dim grayscale. Increasing counts gradually shrink the crystals and
effects; the row caps at nine. Beyond nine, the final crystal carries a +N badge.
Exact current and maximum Mana remain in accessible inspection, without a persistent
numerical readout. Hover leaves each crystal at rest and glints only its artwork;
refresh effects remain independent. Reduced motion keeps crystals static.

The top-right battle cluster shows live Gold, the Autoplay and
Boons toggles, the dev-only Skip Combat control, and Menu. Gold briefly highlights on
increases. End Turn is an outline text button above Discard Pile and commits
immediately after input gates pass, without confirmation. Dev-only Skip Combat uses a labeled skip-forward
icon and a below-icon tooltip using `horizontalInset={8}` so the wide content inset does not detach its label. End Turn has no tooltip.

The hand's bottom dock stays centered and stationary as the hand grows to seven
cards; smaller hands remain centered with capped spacing. Every resting card
touches or overlaps the bottom edge; playable card centers stay visible. Hover
and keyboard focus lift cards for inspection. Hand hover and pointer
activation use the nearest stable slot center, with boundaries halfway between
centers, independent of raised artwork and reflow motion. Hidden transfer cards
cannot receive pointer selection. Keyboard focus uses the native card buttons.

Actor anchors use `BATTLE_ACTOR_TOP` plus `BATTLE_ACTOR_VIEWPORT_OFFSET` from
[layout constants](../src/lib/game-constants/ui-layout.ts).
[BattleActors](../src/features/alchemy/run-loop/screens/battle-screen/actors.tsx)
applies upward Game Size compensation, including health bars and statuses, to keep
health and controls clear. Backgrounds fill the frame.

## Boss idle artwork

Battle portraits for Blight Treant, Blood Countess, Seraph and Stone Titan play
muted idle clips continuously. Each next clip is selected randomly excluding the
current clip. Two video elements preload the next clip. Playback starts its
replacement 240 ms before the end, retains the outgoing image until the incoming
decoder is ready, then blends opacity for 180 ms. Native looping keeps the
outgoing video moving if loading or a busy main thread delays that handoff. The
outgoing buffer is paused and rewound before reuse, including when the next
selection has the same URL.
Only the short blend plays both decoders. This cosmetic selection never uses
the world's gameplay RNG. Hidden tabs pause playback; reduced/disabled motion and
unavailable video playback use the usual static artwork. Defeat freezes the
visible video frame for the existing sliced-portrait effect.

Prepared clips contain 60 fps motion interpolation, computed offline, and filtered
640/1280/1920-pixel variants. The player selects the smallest width covering the
portrait's actual transformed width times display density, capped at the 1920-pixel
master resolution. Resizing or changing displays updates the waiting buffer; the
visible clip finishes without a resolution switch or seek. No runtime optical
flow, canvas downsampling, or per-frame React updates are used. Interpolation
cannot correct motion artifacts already present in the authored clips, and short
blends soften rather than reconstruct mismatched poses.

Animated portraits use the clips' full 16:9 composition with `contain` scaling. A
small matte inset keeps the complete rectangular video clear of the rounded
frame corners. The static fallback disappears when playback starts, leaving a
plain matte around the video rather than a second portrait. Neither video nor its
static fallback uses cover/crop scaling. Their extra width retains the same base
frame height as the hero's 3:4 portrait and other enemies' 4:3
portraits. Hero and enemy frames keep that height through turn changes and hover;
the shining border indicates the active turn. Stone Titan's battle artwork is
mirrored, including idle playback and the frozen defeat image. Collections, Destination,
Labyrinth, inspection and bosses without clips retain their static artwork.

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

Universal reactions show their localized names above the numbers in the same
portrait-anchored action group, without a standalone damage-type icon or a repeated
bonus amount. Reaction IDs select the shared names and keyword palettes:
Shatter uses Freeze/Physical, Frostfire Freeze/Burn, Thunderclap Stun/Nature,
Wildfire Burn/Nature, Consecration Bleed/Holy, Bloodboil Burn/Bleed, and Venomflash
Poison/Burn. Reuse keyword text shine with a dark drop shadow. Transparent gradient
text must reset inherited text strokes: an outline can cut through its letter interiors.
This applies to all shared ShineText consumers and the corrupted-title shine.

Reaction names have a lifetime independent of numeric bursts. They pop, settle,
rise with numeric feedback, then hold the final position until expiry while fading. Reserve space for the numeric pop, stack older actions above
newer ones, and keep numeric size fixed during dense sequences. Names fit each column
independently, accounting for pop scale, without wrapping/truncation: one or two names
use one column, three or more use two. New groups may evict the oldest at the shared
per-target limit. Merging numbers never restarts name motion or extends lifetime.
Reduced/disabled motion shows static keyword-colored names for the same duration.
Names never block play; teardown cancels timers and portrait tracking.
[Reaction text](../src/features/alchemy/run-loop/battle/presentation/ui/reaction-text.tsx)
owns size/pop curves; [combat text](../src/features/alchemy/run-loop/battle/presentation/ui/combat-text.tsx)
owns anchors/repositioning; [motion constants](../src/lib/game-constants/ui-motion.ts)
and [battle styles](../src/styles/battle-scene.css) own lifetimes and the single shine sweep.

Within each resolved action, damaging packets of the same type and recipient
produce one numeric total, including non-additive reaction damage and natural
ticks. Resource removals and Health costs remain separate. Preserve original
packets for gameplay, audio, and impact strength; visual aggregation never turns
a reaction into a Critical. A total containing Critical damage uses the existing
accent and an accessible label saying it includes a Critical.

Critical damage retains ordinary typed color/icon with a brief pale flash and
gold glow, without changing font size, weight or angle. Reduced/disabled motion
keeps a steady glow for the ordinary lifetime. Critical remains in the accessible
label and sound cue. Merging into an already critical entry neither restarts its
pulse nor extends its lifetime; exact curves live in
[battle styles](../src/styles/battle-scene.css).

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
Do not duplicate outline elements; ordinary dark shadows stay static. Only the
brief critical gold glow fades, through its bounded filter animation in
[battle styles](../src/styles/battle-scene.css). Implementation and playback
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
The Mana area stays still, and all effects follow displayed battle frames without
gating accepted gameplay. Initial mount and resume settle without effect replay;
reduced motion settles immediately, and presentation reset cancels pending exits.

Cards entering Hand Overflow briefly shake only the Draw Pile artwork and play
the card-rejection sound. Each batch receives one cue, including fresh opening
draws. Retained overflow, delivery into the hand, and saved-battle mount stay quiet.
Reduced or disabled motion suppresses the shake while preserving sound settings.

## Boss lyrics

Timed boss lyrics sit inside the boss portrait, centered near its bottom edge,
without intercepting inspection or card input. Each complete phrase is measured
before its words appear: text grows up to 36px and shrinks to fit a single line
inside the frame, including room for its animation. Font loading and portrait
resizing recompute the fit; hand changes do not move the anchor.
Words appear as sung with a brief fade
and small pop; earlier words remain dim until the phrase ends. The gold highlight
switches directly between whole words. Instrumental gaps stay clear. Audio
settings owns the default-on **Boss Lyrics** switch; timing data and playback
synchronization follow the [audio contract](./AUDIO.md#local-lyric-alignment-experiment).

## Hand playability

`useHandPresentation` derives visual and interactive card eligibility together from
the current immutable battle snapshot and one presentation-store subscription.
The engine owns legality; presentation only excludes hidden cards from interaction.
Do not mirror engine field dependencies in a separate UI cache.

## Damage values in battle inspection

Card hover and keyboard inspection in the battle hand, Wish, and the pile viewers
show current offensive damage before defenses and critical strikes. Inspection
runs production card resolution against detached battle alternatives, including
payment, pre-triggers, ordered effects, and reactions that affect later packets.
Forge, prepared conversions, resource changes, conditions, and fight pacing
therefore come from the same rules as play. These are offensive packet values,
not final Health loss or a total of all reactions and damage over time.

Finite random outcomes retain their correlated state through later effects.
Agreement produces an exact value; disagreement produces an adjusted range or
damage-type alternatives. Chance clauses remain separate. Unknown drawn-card
identities or inspection work limits leave dependent damage at its authored
value; already known earlier packets remain usable. Delayed attacks also retain
authored values because future resources and pacing are unknown. Inspection
never consumes live RNG, resources, or prepared effects. Collection and other
nonbattle views retain authored descriptions. The [inspection owner](../src/lib/game-data/effects/BATTLE_HANDLERS.md#battle-inspection-ownership)
defines execution seams, uncertainty limits, and effect-authoring requirements.

## Deck and pile inspection

The stacked-cards toolbar icon opens the run Deck during drafting, non-battle run
screens, and meta detours from that run. Battle has no Deck toolbar button; clicking
Draw Pile or Discard Pile opens that pile. Draw Pile includes a separate Hand Overflow
section only while cards are queued, preserving their arrival order and individual
modifications. The section remains available when the draw pile is empty. Other
collections retain their alphabetical ordering. Each viewer has a centered title
(Deck, Draw Pile, or Discard Pile) with no collection tabs.
Titled screen headers place Deck on the left alongside any Back control and Menu
on the right, with the title centered between them. The icon has no tooltip.

`CardInspectionOverlay` is controlled by props and reuses the modal shell,
`useDialogFocus`, card presentation, and adaptive pagination. Each copy remains
visible individually, sorted by displayed title with an instance-content tie
break independent of draw order. The grid uses
[`viewCardWidthClass`](../src/features/alchemy/shared/config/layout.ts), matching
`CardSelectionGrid`'s reference width. The close button remains at the upper right. Empty collections retain
their title and show the collection icon. Pagination resets when switching collections
or reopening. There are no visible counts, instructions, or labels below cards.
Full Deck is the run deck, including cards Consumed in the current battle;
battle-only generated cards appear in their current piles instead. Inspected
cards show keyword Shine Border on hover or keyboard focus, with neutral shine
when no keywords resolve, matching Collection, Wish, and reward choices.

Inspection opens only between actions on a surviving player’s turn, with no
Wish, pending transition, hidden hand card, card ghost, or card transfer. While
open it contains focus and blocks underlying input, autoplay, and automatic End
Turn without changing saved automation preferences. Navigation, run replacement,
battle teardown, or opening a peer menu closes it. Escape, backdrop, and the close
button dismiss it and return focus to the toolbar or pile opener.

## Enemy inspection

Battle enemy portraits and discovered Bestiary entries open the shared
`EnemyInspectionOverlay`, sharing `InspectionPanel` and `InspectionCardGrid` with
deck inspection. The enemy name is the modal header, followed by Traits
and Abilities headings without a divider. Abilities reuse `BattleCardButton`,
`viewCardWidthClass`, the standard keyword border/hover behavior, and adaptive
card pagination. Cards show portrait art only; effects appear in ordinary card
tooltips on hover or keyboard focus. Inspection cards cannot be played or flipped
and do not inherit the hero's description context. Bestiary inspection uses
canonical card values. Live battle inspection passes the displayed battle snapshot
to `getBattleDamageInspectionCard` in `src/lib/battle/card-damage-inspection.ts`,
including room scaling, ability pressure, difficulty modifiers, enemy Forge,
active attack traits (including Glacial Surge), and pacing, before hero defenses.
The repertoire remains visible without selecting or revealing the next ability. Trait descriptions use the same encounter context through
`getEncounterEnemyTrait`. These are presentation copies; never pass scaled cards
back into ability resolution or mutate the canonical catalog.

`TraitBox` owns unboxed rows with colored icons, keyword descriptions and title
shine for enemy hover/inspection and Labyrinth details. Traits have no individual
border, background or box padding. Shared encounter icon themes also drive map effects.
Icons align with Trait names; descriptions sit below in the text column.
Inspection uses two equal columns when 40rem is available, one column otherwise,
and full width for a sole Trait. Hover/map Traits stay stacked. Inline-size
containment belongs only on inspection: shrink-to-fit tooltips need intrinsic width.

Enemy hover uses the [TraitBox](../src/features/alchemy/shared/ui/trait-box.tsx)
tooltip variant with the shared tooltip header and body typography, inheriting
tooltip scale once. Inspection and Labyrinth details use the default variant.
Trait rows share normal icon sizes and spacing; there is no compact text exception
to the [small-text baseline](./UI.md#display-sizing).

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
