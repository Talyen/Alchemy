# Battle UI

## Battle layout

Draw Pile and Mana, the centered hand, and Discard Pile with End Turn form one
centered three-column group. Gaps follow
[the shared battle layout](../src/features/alchemy/shared/config/layout.ts);
the shared [display-sizing contract](./UI.md#display-sizing) governs scaling.

The hero and enemy portrait centers sit at equal horizontal distances from the
stage center in every battle. Preserve their intrinsic sizes and the action gap;
use the displayed enemy width, including the reduced-motion static fallback.
Center points are the anchors, not the combined outside bounds. The current
renderer has one enemy; a Companion stays attached to the hero and extends into
the reserved gap without shifting the hero's anchor when summoned. Health,
status panels, targeting, card flights and impact effects follow the same
portrait refs. The hand and corner HUD remain fixed.

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

Animated portraits use the clips' full 16:9 composition with `contain` scaling,
filling the frame edge to edge. Only the frame's rounded corners mask the video;
there is no matte inset. The static fallback disappears when playback starts,
so a second portrait never shows around the video. Neither video nor its static
fallback uses cover/crop scaling. Their extra width retains the same base
frame height as the hero's 3:4 portrait and other enemies' 4:3
portraits. Hero and enemy frames keep that height through turn changes and hover;
the shining border indicates the active turn. Earth Elemental and Stone Titan battle artwork is
mirrored toward the hero, including available idle playback and the defeat image. Collections, Destination,
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

Each entry follows its own path. Intended card damage and healing use the center
launch queue. For cards without a meaningful direct hit or heal, the first meaningful
authored result appears centrally: Block is primary for Spiked Shield, with Thorns
secondary. An ineffective first effect yields to a later successful authored result;
costs and triggered rewards never become primary merely because their number is larger.
Direct emitters mark intent before aggregation, keeping a proc separate even when it
grants the same status. Secondary benefits use the lower-left corner and setbacks
the lower-right. Corner placement reserves the label's actual width and peak pop
footprint inside the measured portrait, rather than fixed fractions of portrait width.
Resource costs and removals belong to setbacks. Secondary Cleanse, immunity, and preparations
belong to benefits; Purge and harmful control notices belong to setbacks. Unattributed
turn feedback retains its existing damage, healing, Block-loss and Dodge center route. Status
entries use a smaller, stationary pop. Within an action, notices precede losses
and gains; each lane preserves arrival order. Impact and audio cues remain immediate
and follow actual incoming events, never accumulated display totals.

Universal reactions share one central portrait-anchored feedback group per action.
Direct typed damage stays on its own first row; each localized reaction name sits
beside its actual typed bonus on a following row. Damage packets carry their exact
reaction ID through display aggregation: prerequisite keywords never imply extra
damage types. Shatter's Block and Armor losses remain separate defense feedback.
The name and bonus number use the same keyword text shine, with a dark shadow and
no inherited stroke through transparent glyphs. The ordinary type icon preserves
the payoff's damage type. Shatter uses Freeze/Physical, Frostfire Freeze/Burn,
Thunderclap Stun/Nature, Wildfire Burn/Nature, Consecration Bleed/Holy, Bloodboil
Burn/Bleed, and Venomflash Poison/Burn.

The complete group pops, settles, rises up to 24 scaled pixels, then holds and
fades together over 1600 ms. Each localized name and its bonus fit the portrait
width without wrapping or truncation. Multiple reactions retain their actual
resolution order in the same group. Group footprints participate in the existing
clearance queue; new actions never move or restart an active group. Reduced or
disabled motion keeps a static group and the same keyword colors. The shared
[reaction renderer](../src/features/alchemy/run-loop/battle/presentation/ui/reaction-text.tsx)
owns fitting and grouping; [combat text entries](../src/features/alchemy/run-loop/battle/presentation/ui/combat-text-entry.tsx)
render the typed numbers and accessible labels.

Within a resolved action, repeated damaging packets of the same type, recipient,
intent and reaction origin can total for display. Direct and reaction damage never
merge with one another; different reactions remain separate even when their output
type matches. Resource removals and Health costs remain separate. Preserve original
packets for gameplay, audio and impact strength; visual aggregation never turns
a reaction into a Critical. A direct total containing Critical damage retains its
existing accent and accessible label saying it includes a Critical.

Critical damage retains ordinary typed color/icon with a brief pale flash and
gold glow, without changing font size, weight or angle. Reduced/disabled motion
keeps a steady glow for the ordinary lifetime. Critical remains in the accessible
label and sound cue. Merging into an already critical entry neither restarts its
pulse nor extends its lifetime; exact curves live in
[battle styles](../src/styles/battle-scene.css).

The Balanced treatment uses 38.4px base text, an 85 ms pop to 1.85×, a settle to
1.55×, and a smooth shrink toward 1.2×. Travel begins at 240 ms, slows over 810 ms,
and ends 76 scaled pixels above the launch point. Numeric entries last 1050 ms
with a smooth final 280 ms fade. Benefits and setbacks use 80% of the base size.
All coordinates and travel follow Game Size and remain above card flights.

The [feedback owner](../src/features/alchemy/run-loop/battle/combat-feedback.ts)
assigns each entry a waiting/visible phase, launch time, and post-launch lifetime.
The [queue](../src/features/alchemy/run-loop/battle/combat-feedback-queue.ts) samples
projected visible footprints with a preferred 6px clearance and 80 ms launch interval.
Every entry launches within 180 ms of arrival, even when that permits overlap.
New numeric flights compare projected footprints before selecting a fixed center
or diagonal path. Wider paths add vertical separation, protecting different damage
types from receiving the same path when their queue deadlines coincide. Complete
masking receives priority over smaller overlaps. Damage and healing prefer opposite
sides when mixed. Fan distance is capped to the portrait width.
Corners and names receive fixed extra rows. Crowded numeric bursts can use extra
rows rather than reuse an occupied path; all regions of a recipient share the
covering check while keeping their own launch stagger. Each path is chosen once: new arrivals
never push, restart, shorten, or evict existing text. All waiting entries are retained
and every entry keeps its full post-launch lifetime. One owner timer advances launches and
expiry, and reset/unmount cancels it. Queues never block card input or playback.
Reduced/disabled motion removes pop and travel and uses separate static rows; the existing minimum-readable-lifetime policy remains in effect.

Dark outlines and shadows stay static for contrast against artwork. Only the brief
Critical gold glow fades through its bounded filter animation in
[battle styles](../src/styles/battle-scene.css). Exact tuning lives in
[motion constants](../src/lib/game-constants/ui-motion.ts). Implementation and playback
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

## Battle motion

Living combatant artwork, including Companions, enlarges during its active turn
alongside the shine border. Hover multiplies that active size. Exact scale and
transition values belong to [component styles](../src/styles/components.css).

[The playback workflow](./WORKFLOWS.md#change-battle-playback) owns wiring and lifecycle. Battle VFX live in `run-loop/battle` (visual state in
`battle-presentation-store.ts`, overlays in `presentation/` leaves); every fight
action presents numbers + shake + sound through `presentCombatTexts` in
`battle/controller-utils.ts`.

Player lunges occur only for cards with a damage effect and move the portrait,
not the Health/status column. Feedback and the single portrait impact flash appear
as soon as the action resolves, independently of the attack animation. Health
damage takes priority over Block-only impacts; the largest eligible amount wins,
with first occurrence breaking ties. Portrait recoil has light, normal, and heavy
strengths: below 5%, from 5%, and from 20% of the target's maximum Health per
selected impact. Block and periodic damage always use light recoil. Recoil stays
on artwork, leaving Health and statuses steady; at most one recoil starts per
target every 180ms. Every resolved impact still retains its flash, numbers, and
sound. These effects never delay input. Each action requests each combat sound family
at most once. Player and enemy deaths share the slice effect and battle-end delay;
Death's Door is not defeat, and voluntary run exits remain immediate.

Player and enemy dodges use a mirrored, shallow dip and backward lean on the
artwork frame, easing back over 460ms without hit recoil or an added effect.
Health and statuses stay steady. Existing floating Dodge text and sounds remain
unchanged. Dodge motion never delays input; another dodge replaces the previous
motion, and reset, death, teardown or reduced/disabled motion cancels it.

The shared death effect uses a straight diagonal cut for portrait halves and
particle origins, with a pointed white blade flash and restrained warm halo.
[Battle timing](../src/lib/game-constants/battle-timing.ts) and the effect's styles
own durations. Dark shading and thin warm glints
follow the cut edges as the halves separate and fade; a small directional spark
burst accompanies the cut, followed by the existing border dissolve. Motion-disabled
preferences skip the effect and its sound cue.

Played cards fly as artwork and finish with a small pop before fading on
arrival, marking the activation. At most six flight ghosts overlap; the oldest
sheds first. Motion-disabled preferences skip the flight.
Autoplay flashes the hover lift, scale, and shine for a beat before committing,
without the description popup; reduced motion plays instantly with no preview.
Cancelling or restarting the battle clears its pending autoplay preview immediately
and prevents that preview from committing a card or Wish choice.

Draws fly from the bottom-left Draw Pile into measured hand slots and flip from
back to front. Discards leave right-to-left, flip onto the bottom-right Discard
Pile, and scale to its top card. Both follow the shallow curved path in
[transfer motion](../src/features/alchemy/run-loop/battle/presentation/card-transfer-motion.ts),
with batch-accelerated timing. Flights run sequentially;
each departure starts its sound. The live card identity follows hand reflow.
Tuning lives in `CARD_TRANSFER_CONFIG`.

Existing playback owns batch completion, input gates, hidden-card handoff,
cancellation, and timers. A batch waits for its last flight rather than pausing
between cards. Reduced or disabled motion settles immediately. Cancellation
revokes pending departures, flights, and sounds; absent geometry cannot leave a
committed card hidden. Played cards retain their travel, pop, and fade animation.

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

Draw Pile, Discard Pile, and Deck inspection share the backdrop fade and upward
panel settle defined in [component styles](../src/styles/components.css), using
the shared [motion duration](../src/lib/game-constants/ui-motion.ts). Closing
uses only the fade; reduced motion omits the settle. Cards appear together, and
populated panels retain content-based sizing without animated dimensions. Empty
collections show a centered, muted collection icon in a 10rem-high content area with a
20rem minimum panel width, bounded by the available viewport with overflow scrolling.
Deck, Draw Pile, and Discard Pile use the stacked-cards icon; Boons uses the trophy icon.
Each empty icon is exposed as an image labelled Empty Deck, Empty Draw Pile,
Empty Discard Pile, or Empty Boons.

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
