# Battle handlers for card effects

## Adding a kind

1. Add its schema to the matching `<group>-schemas.ts` under this directory.
   Ordinary effect types and kind lists derive from the schemas.
2. Add utility rules to `battle/card-utility-resolution.ts`, or use the matching
   `<group>-handlers.ts` map under `battle/effect-handlers/`. Flag kinds use
   `FLAG_EFFECTS` and `FLAG_HANDLERS` in the utility owner.
3. Add keyword metadata and description rendering in `effect-metadata.ts`,
   extending the formatter or `describeCardEffects` for combined/conditional clauses.
4. For recursive shapes, also extend `types.ts`, recursive schema construction and
   `effect-tree.ts` before cloning, mixing or Corruption can traverse them safely.
   Child order is success effects followed by failure effects; it defines target paths.
5. Update `INSPECTION_EFFECT_POLICY` under [inspection ownership](#battle-inspection-ownership).
6. Verify consequential schema refinements, runtime behavior and independently
   expected descriptions. [Tests](#tests) identify existing protection; the shared
   formatter cannot serve as its own correctness oracle.

## Registry ownership

| Concern                                             | Owner                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared schema primitives                            | [`shared-schemas.ts`](./shared-schemas.ts)                                                                                                  |
| Domain schemas                                      | `damage-schemas.ts`, `status-schemas.ts`, `mana-health-schemas.ts`, `simple-schemas.ts`                                                     |
| Kind list, templates and recursive schema factories | [`registry.ts`](./registry.ts): `BATTLE_CARD_EFFECT_KINDS`                                                                                  |
| Runtime dispatch and recursive/Companion actions    | [`battle/effect-handlers/registry.ts`](../../battle/effect-handlers/registry.ts): `EFFECT_APPLY_BY_KIND`                                    |
| Grouped handlers and context                        | `damage-handlers.ts`, `status-handlers.ts`, `utility-handlers.ts`, `simple-handlers.ts`, `handler-types.ts` under `battle/effect-handlers/` |

Each schema owns its literal `kind`; ordinary `BattleCardEffect` members derive
from the grouped schemas. Recursive members stay explicit in `types.ts`, with
`isRecursiveBattleCardEffectKind()` as their shared classifier. Handler tables are
checked against `EffectHandlers`, narrowing each parameter by its table key.
Both registries reject duplicate kinds; the assembled runtime map covers every
non-recursive kind. Ordinary additions need no central registry edit.
`applyEffectByKind` checks own keys before dispatch or its narrow correlation cast;
unknown kinds warn and return unchanged state.

`companion-action` stays in the runtime registry to avoid an import cycle with
`companion-effects`. Non-card pulses use the `processCompanionTurnStart` binder in
`battle/companion.ts`.

## Description contract

The parity checker compares authored mechanic lines with generated text, including
summon summaries and added effects. Mixed Potion placeholders and Steal/Gain Gold
have narrow wording exceptions. Missing keyword/Consume lines warn; unrenderable
effects fail. Potion mixing renders traversed effects through `describeCardEffects`.
Outside battle, previews use authored amounts except summon lines recomputed with
Bond and damage bonuses.

## Potion scaling

Benefits scale; costs and factors do not. The runtime registry threads `potionMult`
from `isPotionCard` and `talentEffects.potionPotency`; handlers opt in with
`applyPotionMultiplier` in `amount-helpers.ts`. Damage, healing, Mana, Gold, Wish
and status gains scale. `self-damage`, `lose-*` and factor-based effects such as
`multiply-enemy-status` do not. Random damage/draw rolls before scaling.
`action.source === "repeat"` suppresses potency. Potion identity comes from
[`POTION_CARD_IDS`](../cards/card-pools.ts) plus Mixed Potions, independently of names.

## Resolution sequence

[`applyCardEffects`](../../battle/effect-handlers/registry.ts) is the single
`@/lib/battle` apply entry. It walks effects, routing `chance` through
`rollChance`/`getBattleRng` and queuing `repeat-over-turns` with source card ID,
Consume and tags before ordinary dispatch.

- `applySingleEffect` stops on hero defeat. Dispatch applies the handler, then
  Eager Pack's two immediate pulses for a summon, then `resolvePendingBattleReactions`
  after every effect.
- Companion and pending-turn-start pulses use synthetic cards under
  `resolveSecondaryAction` (`companion-effects.ts`, `player-turn-transition.ts`).
- `resolveCardEffectChain` in `card-play-effects.ts` owns paid and Dodge-triggered
  full-card execution: prepare once, resolve each copy/Potion use, then settle
  card-play rewards and Twin Casting once. Unique repeats use source `repeat`.
- Normal plays freeze `manaAtStart` before payment; Companion actions snapshot
  inside their scope; pending-turn and Unique-repeat pulses snapshot per pulse.
  `convertCurrentMana` reads that frozen value. Conditional Gold follows
  [ordering and semantics](#ordering-and-semantics).
- Crowd-control calls live in `status-handlers.ts` for multiplied enemy buildup
  and `enemy-turn-attack.ts` for player control. `action-context.ts` and
  `combat-flags.ts` own bonus eligibility; secondary actions never mask or restore
  gameplay flags. `battle-sequence.ts` owns step settlement and fatal cutoffs.

## Card utility ownership

[`battle/card-utility-resolution.ts`](../../battle/card-utility-resolution.ts)
owns the typed utility-effect table shared by live handlers and damage inspection:
Health, Mana, Mana Crystals, Gold, player statuses, cleansing, Armor removal,
Companion summoning/buffs, and armed action flags. It owns amount calculations,
Potion potency, conditional eligibility, resource limits, and effect feedback.
`effect-handlers/utility-handlers.ts` supplies live reactions and seeded status
choices. Reaction scoring uses the same table with explicit nominal healing, suppressed reward callbacks, and pre-enumerated status choices; it retains probability-weighted correlated alternatives without drawing live RNG. `damage.ts` owns attack flag preparation for both combat and reaction scoring. Inspection calls the production action resolver with an isolated finite
choice source; it does not assemble another utility or attack recipe.

## Battle inspection ownership

[`card-damage-inspection.ts`](../../battle/card-damage-inspection.ts) adapts
production observations into presentation-only card descriptions. Player payment,
pre-triggers, ordered effects, and follow-ups resolve through `card-play.ts`;
enemy abilities resolve through `enemy-turn-attack.ts`. Admission alone is
hypothetical, so cards outside the hand or above the current Mana remain inspectable.
`damage.ts` and `enemy-ability-damage.ts` report offensive power before defenses
and critical strikes. Resulting state still includes mitigation and prepared
critical consequences when later packets depend on them.

[`inspection-outcomes.ts`](../../battle/inspection-outcomes.ts) tracks exact,
alternative, or unknown packet observations by complete correlated execution.
It branches finite integer/chance decisions without drawing the live RNG. Random
critical strikes and Dodge are excluded by the existing inspection convention;
fractional resource/status procs retain their alternatives. It evaluates every
supported integer result, rather than assuming range endpoints bound nonlinear
threshold effects. Limits of 128 replays, 64 decisions per replay, and 4096 total
sequence steps downgrade unresolved dependent packets to unknown. Known earlier
packets remain usable. Unknown packets and future-turn effects retain authored
description values; they are never exposed as computed exact outcomes.

Drawn card identities stop dependent projection. Wish offers remain pending but
unsampled through the execution-only `sampleWishOptions` seam; their immediate
rewards keep the production recipe and order. `battleSnapshot` removes observers,
Wish samplers, RNG, and action callbacks. Inspection also strips borrowed execution
capabilities before running; it cannot invoke a live empty-draw callback.

Card-flight presentation uses these same observations through
`battle/card-animation-target.ts`. Inspection captures authored numeric feedback
per effect before display merging; costs and unmarked/secondary proc feedback
are excluded. The largest single direct point/count magnitude wins, rather than
the sum toward either recipient. Damage uses its first offensive packet before
enemy defenses and Critical/Dodge rolls; healing uses adjusted power before its
Health cap. Status multiplication compares gained stacks, never its factor;
Haste/Phoenix Feather durations or charges and other nonnumeric actions do not
compete. Ties, uncertain mixed-target branches and unresolved numeric outcomes
retain the first non-cost authored recipient. The choice affects only the card
travel ghost, never combat targeting, resolution, state or live RNG.

Effect occurrence addresses, including both Chance branches, own observation and
Corruption-mark mapping. Repeated references to one authored effect object still
have independent packet identities. Import boundaries keep the description adapter
on action owners and keep the alternative collector free of combat rules.

When adding a kind, update the exhaustive `INSPECTION_EFFECT_POLICY` classification
and the production handler. Add independent outcome assertions when the mechanic
can change later packets. No second inspection handler should be introduced.

## Resource reward ownership

`battle/player-resource-resolution.ts` owns the ordered Health, Mana, Gold, Forge,
Armor, Block, and Cleanse recipes, including card overhealing, Health-threshold
rewards, and Block depletion. `player-rewards.ts` binds the live interpreter and
exports its operations directly; `status-player.ts` retains status-application
helpers and the existing resource exports. Inspection runs that same production interpreter. Its ports retain chance,
healing, and Holy draw behavior; the inspection decision source preserves finite
alternatives without consuming gameplay RNG. Unknown draws stop dependent projection.

`battle/resource-reward-resolution.ts` owns Leech restoration facts and riders,
Nature resource payouts, Cutpurse Gold, and Bloodfire's Leech eligibility. Both
execution and inspection use these rules. Inspection carries earned resources
between damage packets, including Gold, so later ingredients use the resulting
purse, Mana, Block, and Health. Rendering owns only damage summaries and presentation copies; it must not execute
the displayed card.

## Crowd-control ownership

`battle/crowd-control-resolution.ts` owns enemy Stun and Freeze eligibility,
retained buildup, trait reactions, and reward ordering. Inspection runs the live resource and hit policies through the same recipes. `status-stun-core.ts` binds
live Stun reactions without importing its Leech orchestrator; Freeze binds through
`damage-status-riders.ts`. Guaranteed Thunderstone Mana and Gold rewards carry
into later inspected packets. `scaled-damage.ts` shares pacing, vulnerability,
Block spending, and Armor mitigation before host-specific hit reactions. Unknown
draws remain unprojected.

## Ordering and semantics

- `player-status` with `convertCurrentMana` interprets the value as **block per mana** (`manaAtStart * convertCurrentMana`), zeroes mana, and respects `manaAtStart` snapshot from `CardEffectResolutionContext` (frozen before any effect mutates `state.mana`). `perManaCrystal` uses live `maxMana`. A defined zero coefficient yields zero gain; Mana conversion still spends Mana.
- `restore-mana` may opt into `allowOverflow` for temporary extra Mana (Mana Moth). Omission preserves capped restoration; restoration never removes existing overflow. This does not add Mana Crystals.
- `damage` with `equalToBlock`/`equalToArmor` takes its base from the live resource and applicable Forge. [player-damage-base.ts](../../battle/player-damage-base.ts) then includes shared conditional, Archery, attack, Potion, and Consume packet bonuses, but bypasses the per-type flat/scaling handlers. Normal damage multipliers, pacing, critical strikes, and defenses still apply.
- `damage.equalToBlockPercent` scales the live actor Block resource before the same equal-to-resource modifiers and rounding; omission preserves full Block scaling. Enemy abilities read the enemy's live Block after preceding effects such as Shield Bash's Block gain. `player-status.statusPool` selects one listed beneficial status with the battle RNG before applying the authored amount.
- `damage.ignoreArmor` bypasses only the target's Armor reduction. `damage.ignoreBlock` bypasses and preserves the target's Block. Dodge, other mitigation, normal Armor decay, and gear reactions still apply, for both heroes and enemies.
- `remove-enemy-armor.removeAll` removes the target's current Armor before subsequent effects. Authored cards omit `amount` (old saves may still carry an ignored one); omission preserves fixed-amount removal for saved cards. The same applies to `remove-harmful-status` with `removeAll`.
- `remove-enemy-armor.halve` leaves `Math.round(current Armor / 2)` Armor and cannot be combined with a fixed amount or `removeAll`.
- `multiply-enemy-status` adds the stacks implied by its authored factor without reapplying attack-only Labyrinth buildup bonuses. Native buildup resistance and Stun/Freeze immunity still apply to those added stacks; Cold Snap’s initial damage retains ordinary attack buildup bonuses.
- `random-draw` rolls a uniformly distributed integer between its inclusive bounds using the world RNG, then uses ordinary drawing, reshuffling, and hand limits. Roll the Dice has fixed bounds 1–6; its die faces are rules rather than upgradeable magnitudes.
- `companion-action` invokes the existing Companion resolver once per `amount`, including utility actions, Bond bonuses, and reactions. No Companion is a no-op; victory or hero defeat prevents later actions. These actions do not count as additional card plays. Pack Tactics keeps two actions while its conditional Wish effect offers only Companion summon cards when no Companion is active; Whistle still grants its separate action once per card play.
- `random-damage` and `cleanse-player-status-to-damage` preserve optional `lifesteal` when constructing their resolved damage packet. Transmutation adds Leech to these attacks as well as ordinary `damage`; omitted flags retain existing behavior.
- `random-damage` enforces `maxAmount >= minAmount` at schema level and throws loudly on inverted bounds at runtime. Corruption clamps either bound at the other bound, keeping the description and effect valid even after repeated mutations. An optional `damageTypePool` replaces the default all-type pool; amount and type each use the battle RNG. Direct random-damage cards trigger the same once-per-card enemy retaliation as direct damage cards.
- `damage.detonateAllBurn` and `damage.detonateAllBleed` detonate all matching enemy DoT stacks after the hit, including stacks added by that hit.
- `damage.tripleIfEnemyNotBurning` triples Kindling’s hit when the enemy has no Burn.
- `gain-gold` with `ifEnemyStunned` requires positive live `enemyCC.stunSkipTurns`; it does not compare against a pre-card snapshot. An enemy already Stunned before the card qualifies, as does one Stunned by an earlier effect on that card.

- Effect structure belongs to `game-data/effect-tree.ts`. Description generation, Potion mixing, and Corruption use `areBattleCardEffectsEqual` to compare complete payloads, including cloned pools and recursive branches. Object field order does not matter; field presence, array order, branch grouping, and numeric values do. Corruption additions derive their structured descriptions from `createEffectDescription` rather than maintaining a second wording table.
- Numeric upgrades and Corruption share `updateCardNumericValue` in `src/lib/corruption/numeric.ts`. `game-data/effect-description.ts` builds prose and magnitude bindings together; `card-description-model.ts` owns serializable lines, typed effect references, formatting, and derived highlights. Each magnitude explicitly declares every effect field it changes, including shared chance outcomes, repeated or scheduled hits, and doubled Frozen damage. Target discovery in `corruption/numeric-targets.ts` reads these bindings and captures exact addresses, expected values, and multipliers. It never parses wording or matches equal numbers. Mutation rejects the entire edit if any reference or expected field is stale, then renders strings and highlights again. Powerful Wish identifies costs from all referenced effect kinds, including a shared damage/Health-cost magnitude. Targets are transient; descriptions and corruption marks persist with the card. Nested paths index success effects followed by failure effects; probabilities and schedule durations remain fixed. Custom single-valued Random damage must explicitly bind both bounds. Independently authored delayed values own independent references. “Draw a card” binds one draw while fixed rules stay non-editable. Keep original catalog effects and descriptions immutable.
- Immediate and delayed damage may share a description line: “Deal 1 Freeze damage now and 3 at the start of your next turn” retains two independently editable magnitudes. “Deal 2 Stun damage now and at the start of your next turn” shares one magnitude across both hits.

## Enemy abilities

Enemies reference canonical cards through `BestiaryEntry.abilityIds`; they do not
author a parallel effect library. `game-data/enemy-abilities.ts` validates the
supported subset (hero `damage` with the supported type pools, resource scaling,
conditional fields, and Armor/Block bypasses; `player-status` block/armor/forge/thorns,
`heal`, `remove-enemy-armor`, freeze-only `multiply-enemy-status`, and recursive
`chance`), including every chance branch and conditional field. Adding a field to
hero `damage` requires triage in `ENEMY_DAMAGE_FIELDS`, which defines both the
runtime allowlist and `EnemyAbilityDamageEffect`. One cached analysis per immutable
effect tree supplies eligibility, the first unsupported leaf, and damage detection
across both Chance branches. Replacing a tree gets a fresh analysis; card-level
Consume eligibility is checked on every call. `getEnemyAbilityCard` names the
offending effect in its error.
`battle/enemy-turn-attack.ts` resolves that subset from the enemy's perspective,
using shared incoming-damage, crowd-control, healing, and mitigation primitives.
Hero-only resources and rewards never run for enemy self-benefits. Card-granted
Thorns and queued Bleed Leech use the same status semantics as hero cards while
retaining existing encounter exceptions. Selection and trait limits are owned by
[GAME_RULES](../../../../Docs/GAME_RULES.md#enemy-abilities-and-traits).

## Tests

[Battle units](../../../../tests/lib/battle/) protect dispatch, runtime semantics
and ordered resolution. [Registry tests](../../../../tests/lib/game-data/effects-registry.test.ts)
protect schema refinements, and [kind coverage](../../../../tests/lib/game-data/effect-kind-coverage.test.ts)
checks exhaustive dispatch. [Type tests](../../../../tests/types/battle-effect-handlers.test-d.ts)
reject mismatched handlers. [Content validation](../../../../tests/lib/content-validation/)
protects description parity; the formatter is not its own correctness oracle.
Inspection tests compare independently expected packets with production plays,
including uncertainty, resource changes and unchanged live RNG/state.

## Gear and trinket effects

Equipment does not use the card-effect registry above. Gear affixes resolve to
[`GEAR_EFFECT_KEYS`](../../gear/gear-effect-manifest.ts) via `gear/affixes.ts`
(description formatting shared in `formatAffixDescription`), uniques contribute
canonical rolls from `gear/unique-catalog.ts`, and `computeGearManifest`
snapshots the equipped loadout into battle (`rebindLiveRunMeta`); see
[ARMORY battle integration](../../../../Docs/ARMORY.md#battle-integration).
Trinket effects resolve to `TrinketManifest` via `computeTrinketManifest` in
`lib/trinkets.ts`; every key has a documented consumer pinned by the manifest
coverage test in `tests/lib/content-validation/trinket-validation.test.ts`.
`battle/scaled-damage.ts` holds only shared helpers, not a dispatch table —
each battle consumer reads the manifests where its effect applies.

## Conditional damage and feedback

Damage supports paired `damageTypeIfTargetFrozen`/`amountIfTargetFrozen`
for the current Frozen alternative. Resolve it before hit processing changes
control state. Other resource selectors remain mutually exclusive.

Conditional descriptions share one formatter with numeric editing and parity
validation. Block cost is a fixed rule; base damage, Block damage bonus, and Frozen
alternative damage are editable. Damage pools and repeated immediate-hit lines
share one displayed amount; “Deal N damage twice” updates both hit effects.
The loader currently preserves complete saved conditional/chance effects.
Preserve valid current-run modifications as a unit; retirement of obsolete
card mechanics follows the [save baseline](../../../features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

Boolean preparations, draw/summon/Wish, cleansing, and scheduling emit meaningful
combat events. Unsupported effects still warn without inventing a successful
result. Numeric zero fallback is restricted to valid ineffective actions.
Cross-action consolidation belongs exclusively to presentation; source events
and battle snapshots remain immutable. See the canonical UI feedback policy.

`player-status.forgeAmount` overrides the Forge outcome of a Block/Forge/Armor `statusPool`; Avatar uses 5/2/5 with the existing uniform pool selection. Both amounts participate in typed descriptions, numeric upgrades and saved-card validation.
