# Alchemy — Game rules and glossary

Canonical owner for game rules, content-system behavior, and shared domain terms. Coding rules: [AGENTS.md](../AGENTS.md). Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Command catalog: [REFERENCE.md](./REFERENCE.md).

## Guide index

- [Combat rules](#battle-implementation-rules) and [engine invariants](#engine-invariants).
- [Talent rules](./TALENT_RULES.md): progression, action rewards, triggers, and card-specific interactions.
- [Unique items](./UNIQUE_ITEMS.md): signature effects and combat exceptions.
- [Corruption altars](#corruption-altars).
- [Modes, saved runs, and Labyrinth exploration](#content-systems).
- [Terminology](./GLOSSARY.md#domain-glossary).

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](./GLOSSARY.md#domain-glossary). Tests: `tests/lib/battle/`.

### Direct player hit resolution

`hit-request.ts` names the source of each direct player-to-enemy hit. `hit-resolution.ts`
owns card, reflection, and purge recipes; `follow-up-hit-resolution.ts` is its lower
resolution tier, also used by Wish and defensive reactions. That dependency direction
keeps shallow hits from importing their parent card/Wish orchestration. Card-specific
reaction stages live in `card-hit-reactions.ts`; calculation and intrinsic statuses
remain in their existing lower-level owners.

The table describes the current hit recipes. “Intrinsic” means
`applyDamageStatuses`, including its existing status-triggered reactions, not just
adding a status stack. Thresholds and once-only kill rewards use `applyHitEpilogue`.

| Source                            | Amount and mitigation                                                                                                                                        | Reactions and closing order                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card attack (including Companion) | Attack orchestration calculates bonuses, pacing, critical strikes, Block and Armor once before requesting the hit. Dodge precedes next-hit flag consumption. | Capture eligibility before purge; apply Health damage; spend Forge; decay Armor; intrinsic/conversion reactions; Leech/frozen reactions; depth-first Archery reactions; Holy/Nature rewards; damage text; thresholds/kill rewards; frozen Physical Forge payout. |
| Archery extra hit                 | Copy half the parent's resolved amount, rounded; do not recalculate bonuses, critical strikes, pacing, or mitigation.                                        | Same card recipe and inherited origin, excluding purge and further Archery extra-hit/Broadhead/detonation rolls. It still spends Forge and runs other eligible card reactions.                                                                                   |
| Player follow-up                  | Card-style numeric bonuses, pacing, critical strikes and mitigation, with no real card metadata.                                                             | Health; Armor decay; intrinsic statuses; damage text; thresholds/kill rewards; Nature Gold/mana refunds or Holy Faith Barrier/Brass Censer. No card conversion recipe or Forge spending.                                                                         |
| Fixed talent hit                  | Pace its fixed amount, apply enemy multiplier and round, then Block and Physical/Stun Armor. No offensive card bonuses or critical strike.                   | Stop if no damage remains; otherwise Health, Armor decay, intrinsic statuses, text, thresholds/kill rewards, then Holy Leech/Faith Barrier/Block/Tithe, Nature refunds, or Burn Forge payout.                                                                    |
| Derived talent hit                | Round its already-paced amount and apply only the enemy trait multiplier, then round and mitigate as above.                                                  | Same shallow talent recipe. Do not apply pacing or offensive bonuses again.                                                                                                                                                                                      |
| Reflected Holy                    | Block lost × saved reflection percentage × Holy trait multiplier, rounded, then enemy Block.                                                                 | Health, Armor decay, damage text, intrinsic statuses, full Holy reactions including Wish, then thresholds/kill rewards using pre-damage statuses. No Forge spending.                                                                                             |
| Attack purge                      | Once per player turn, remove the first active Armor, Block, Forge, Thorns, Burn Bonus, or Freeze Bonus category.                                             | Emit a Purged notice with no damage or follow-up. The use is spent only when a benefit was removed.                                                                                                                                                              |

`HitFacts` keeps reaction eligibility, pre-hit Health, resolved damage, actual Health
lost, and the lethal transition together. Eligibility may precede purge while the
Health facts follow it. Status buildup and many rewards use resolved damage; Poison
Leech caps against pre-hit Health, and the Companion damage callback uses actual
Health lost before threshold healing. Never substitute the final Health difference
for those facts.

All chance checks retain their execution order in the seeded world stream. Card-style
calculation can roll critical strikes (a reserved or guaranteed critical strike skips
that draw). Talent/reflection/purge calculations do not. Intrinsic status reactions
and source-specific rewards can draw RNG, and nested hits finish depth-first before
the parent resumes. Do not eagerly roll disabled reactions or move rolls across
zero-damage/death cutoffs. Non-card Holy Wishes have no source card to exclude;
card-origin Wishes exclude the real originating card.

### Turn order and resources

- **1-on-1 targeting** — one enemy per battle; attacks/debuffs go to the enemy, blocks/heals/buffs to player/companions; no target selectors.
- **Turn order** — Player (companion attacks → play cards) → Enemy (enemy DoTs → ability → player DoTs → regen) → reset (draw 4, restore mana, halve player block). Enemy block halves when the next enemy phase begins.
- **Mana** — resets to `maxMana` each turn; unspent mana is lost (Wellspring talent excepted).
- **Companions** — invulnerable; act at player turn start; persist indefinitely.
- **Draw / deck** — Ecosystem tutors one Nature card before the ordinary opening draw. Battle initialization then commits the opening 4 plus other battle-start bonus draws before their animation; later turns draw 4. Max hand 7; ordinary and keyword draws reserve actual cards in an ordered battle-only queue when the hand is full, and Wishes queue chosen cards the same way. Queued cards enter the hand oldest first when space opens, before later draws, and survive turn changes and save/resume. A draw with no eligible card grants nothing. The previous hand is discarded at player turn end, while cards drawn during the enemy phase remain alongside the next four draws; discard reshuffles when the draw pile empties; Consumed cards are removed for the remainder of the battle. If a player-turn draw finds the hand, queue, draw pile, and discard empty, an Emergency Wish opens the normal Wish choices and the selected card enters the hand; this can recur whenever the piles are empty.
- **Block** — absorbs incoming damage first; halved (not cleared) at the start of the owner's next turn, after the opposing side had a chance to attack into it.
- **Haste** — extra turns skip the enemy phase; both blocks hold until a real attack window resolves, then halve once each.

### Companion Bond

Bond 0 preserves the baseline. Damage, healing, Gold, and Scarab Block gain +1 per Bond level. Wolf deals one randomly selected Bleed or Physical hit each turn, with its damage scaling by Bond. Fox deals one randomly selected Stun or Bleed hit each turn, with its damage scaling by Bond. Mana Moth and Library Owl retain their guaranteed baseline and gain a 25%/50%/75% chance of one extra Mana/card at Bond I/II/III. Will-o’-Wisp keeps cleansing one status and additionally heals 1/2/3 Health. Summon cards, the active Companion panel, and battle card inspection share the combat owner’s Companion-specific scaling, including Bond, Gear, Mana Crystal, and conditional damage bonuses. Collection descriptions retain their noncombat context.

- **Companion damage rewards** — Predator's Instinct doubles damage only strictly below 30% enemy Health, comparing against the unrounded threshold. Companion damage rewards use Health lost to its damage packets before enemy healing reactions; Second Wind cannot cancel those rewards, and utility actions cannot earn them through unrelated damage reactions.
- **Companion card perks** — Whistle and Hunter's Bond use the card's Companion keyword, including Pack Tactics. Whistle makes the active Companion act after all effects of the card finish, including a newly summoned Companion. Both rewards occur once per card play, including automatic plays, never again for repeated or scheduled effects. Both `getCardKeywords` and `cardHasKeyword` use the full content keywords, including utility effects.
- **Bonded** — Companion damage receives Forge exactly once for every damage type with Bonded, and spends Forge through normal attack decay. Without Bonded, existing damage-type Forge rules apply.
- **Pack Tactics** — makes the active Companion act twice, including utility actions. Without an active Companion, it opens a normal Wish whose options are restricted to Companion summon cards; the chosen card enters the hand. Ordinary Companion bonuses and reaction cutoffs apply, and card-play rewards occur once.

### Enemy abilities and traits

#### Repertoire and resolution

- **Native Traits** — every enemy has 1–3 unique native Traits; encounter modifiers are additional. Separately displayed Traits own their respective combat effects. Minor Holy/Freeze vulnerabilities remain 30%, distinct from double-damage vulnerabilities. Goblin’s Scavenged Shield uses the existing room-scaled starting-Block grant of 4.
- **Repertoire** — each enemy has three distinct canonical card IDs in `abilityIds`. `getEnemyAbilities` resolves the same card definitions used by heroes. The supported subset is validated recursively by `isEnemyAbilityCard`; unsupported card effects, Consume, and hero resource systems cannot silently fizzle on enemies.
- **Selection** — `processEnemyAbility` uniformly selects one available card using world RNG, excluding `lastEnemyAbilityId`. The opening choice uses all three. Haste and crowd-control skips do not select cards or advance history. Recheck enemy crowd control after status ticks so a Paralytic Venom Stun skips the upcoming action without ticking statuses twice. Inspection never consumes RNG and does not reveal an upcoming action.
- **Resolution** — `applyEnemyAbility` interprets self/opponent targets from the enemy's perspective without borrowing hero talents, Gear, mana, hand, or Gold. Room/difficulty scaling applies at resolution, keeping canonical card definitions immutable. Damage based on live Block or Forge skips a second room multiplier but still receives ability pressure and difficulty modifiers. Positive enemy ability damage has a minimum of 1 after room, progression, and difficulty scaling; zero-base effects retain their existing behavior, and defenses can still prevent all damage. Enemy benefits use enemy healing/mitigation owners; factor-based effects retain their authored factors. Multiplication feedback reports the added buildup, matching hero effects, and emits nothing when no buildup is added. A lethal counterattack stops remaining effects and follow-ups.
- **Ability stages** — `enemy-turn-attack.ts` selects cards and sequences effects, `enemy-ability-damage.ts` resolves damage and once-per-ability hit rewards, and `enemy-ability-followups.ts` runs trait follow-ups after the effect sequence. `enemy-ability-context.ts` creates and records the shared per-ability hit facts so multi-hit abilities pay matching rewards once and apply follow-ups once. Keep hit and follow-up order, RNG draws, and combat text order when changing these stages.
- **Enemy progression** — `game-constants/enemy-balance.ts` owns separate Health and ability-pressure curves by enemy type, with content-specific overrides. Elite ability pressure grows with diminishing returns at later depths. `battle-enemy-setup.ts` derives progression from the existing room multiplier; no hero identity, report tier, or additional saved field participates. Progression factors stop growing after depth 24 while ordinary room scaling continues. Health tuning applies only when creating a battle; saved Health, defenses, ability rosters, and action history remain intact. Block, Armor, healing, regeneration, and trait grants retain their existing scaling.

#### Enemy reactions

- **Resolved player actions** — Jealous gains its Physical damage bonus for each resolved Wish, including both Wishes from Faustian Bargain, Stargaze's immediate Wish, and triggered Wishes. Insatiable also reacts to cards consumed by Dance of Blades. Consume rewards require the hero to survive retaliation, including automatic plays; Death’s Door still counts as survival. The card remains consumed even if retaliation defeats the hero. The older Thorns trait and Holy Retribution check attempted damage in the resolved action, including chance branches and Exorcism, only while the enemy survives; a utility-only chance outcome does not retaliate. Repeated effects track their attempts separately and retain existing reaction limits.
- **Rooted** — gains Block once per played Nature card, using the same full keywords shown on the card, including nested effects and tags. Repeated effects and Companion actions do not count as another card play.
- **Attack traits** — an attack is a damaging ability. Positive incoming hits fully prevented by Block, Armor, flat damage reduction (including Aetherward), or resistance still land: they consume Bandit's Ambush, permit Banshee's Purge, and trigger remaining hero Thorns. Dodge prevents these landed-hit reactions. Absorbed damage does not grant Leech or rewards requiring Health damage. Brawler's penalty applies to all hits of its next damaging ability. Defensive abilities preserve these bonuses and do not trigger attack reactions.
- **Once-per-ability rewards** — Zealot, Cleric, Paladin, Seraph, and Stone Titan reward matching damage to hero Health once per ability. Fire Imp, Giant Spider, and Winter Wolf apply their follow-up once after an ability damages hero Health. Phoenix Feather healing does not cancel the Health damage that triggered it; fully prevented hits do not qualify. Banshee retains its landed-hit Purge, randomly selecting one active beneficial effect with world RNG; a purged Thorns stack does not retaliate that hit. Inquisitor doubles Holy hits against Burning heroes.
- **Blood traits** — Blood Frenzy adds 1 damage to a Bleed hit against a hero already Bleeding before that hit; it grants no Leech. Blood Scent adds one separate 1-Bleed hit when the hero is strictly below half Health at ability start; defensive abilities do not trigger it and the bonus has no inherent Leech. Native Bleed Leech carries its own buildup into `pendingEnemyBleedLeechHealing`, so unrelated or bonus Bleed cannot fund extra healing. Cleansing Bleed clears that pending Leech; partial removal caps it to the remaining buildup before fresh Bleed can arrive. Existing healing reductions still apply. Profane Blood damages Blood Countess only when the hero actually restores Health, never from overhealing or the Countess's own healing.
- **Enemy Thorns** — card-granted Thorns retaliate as Nature damage on a non-Dodged hero hit while the enemy survives, consuming the ordinary Thorns stacks. `legacyEnemyThornsReady` reserves one stack for the original encounter trait's distinct Physical, once-per-card retaliation while the enemy survives; new card stacks do not replace or disable that behavior.
- **Boss traits** — Forge Golem gains 1 Forge every other turn; Frostwarden gains 1 Freeze damage every other turn up to a bonus of 2 (larger existing saved bonuses are retained); Iron Bear gains 1 Armor every other turn. Seraph heals from Holy attacks and Stone Titan gains Armor from Stun attacks instead of emitting passive damage pulses.
- **Elemental traits** — Frost Elemental and Ice Wraith add 1 room-scaled Freeze damage to Freeze hits. Ice Wraith has no additional damage penalty from Freeze buildup. Pyromancy adds 1 room-scaled Burn damage to Pyromancer ability Burn hits through the original hit, without a separate packet or direct buildup grant. Cinder Skin deals 1 room-scaled Burn damage on the first actual enemy Health damage each turn while the enemy survives, including cards, Companions, triggered damage, and damage over time. Fully prevented and lethal hits do not spend the reaction. The Health-damage helper spends its once-per-turn flag and queues `pendingCinderSkinReaction`; action and tick resolvers drain it through the existing enemy damage path, clearing the pending flag before retaliation. Both flags persist through automatic actions; the once-per-turn flag resets at the next player turn.

### Damage, statuses, and survival

#### Dodge

- **Dodge** — both sides have a 5% chance to Dodge each opposing attack **damage packet** before Block and Armor, unless the target is actively Stunned or Frozen. A dodge deals 0, spends no Block/Armor, skips that packet's status riders and lifesteal, and shows Dodge combat text instead of damage. Status-only attacks, DoT ticks, and encounter/proc pulses cannot be dodged. Each damage packet rolls independently. Player Dodge adds gear, talent bonuses, and Finding Rhythm, capped at 75%. Torpor can additionally prevent enemy Dodge while Poisoned.
- **Dodge chance bonuses** — Last Gasp requires strictly less than half Health. Finding Rhythm adds its talent-defined bonus for each hostile damage instance that reaches Health after mitigation, before death prevention (including harmful status ticks and enemy pulses; excluding self-damage and Health costs). Its bonus persists across turns, has no separate stack cap, and clears on a hero Dodge or battle end.
- **Dodge rewards** — Unburdened cleanses player Stun and Freeze buildup on a Dodge; it does not add Dodge chance. On-Dodge gear, on-Dodge talents, and Dance of Blades fire only when the hero Dodges. Each successful hero Dodge earns 1 run Dodge XP; commit it with the resolved enemy turn, never with presentation callbacks. Clean Getaway subtracts its amount from each of Burn, Poison, and Bleed and triggers cleanse rewards once only if at least one status reaches zero. Matching numeric Dodge gear and talent rewards add together. Tailwind draws on each Dodge, including multiple Dodges within one enemy attack. Smoke Screen deals 2 triggered Burn damage when Dodging a Burning enemy.

#### Mitigation and crowd control

- **Player damage mitigation** — Aetherward reduces hostile hits, Burn/Poison/Bleed ticks, and typed self-damage by the number of filled Mana Crystals, before the remaining defenses. Temporary overflow Mana does not count, and multiple Aetherward copies do not stack; Health costs bypass it. Burn, Poison, and Bleed ticks retain their damage type through flat reductions and Gear resistance. Enemy attack buildup, ordinary enemy Leech (including Flesheater), and Armor decay use damage after all applicable mitigation, before death prevention; fully resisted damage grants none. Later hero healing cannot cancel earned Leech. Ravenous still limits Leech to actual Health lost.
- **Reinforce** — Reinforce divides absorbed Physical damage by its absorption multiplier to determine Block spent, rounded to nearest integer; exhausting the full absorption capacity spends all remaining Block. Extra enemy Block destruction applies to Block spent.
- **Elemental Armor** — Fireward lets Armor mitigate direct Burn hits as well as Burn ticks and typed self-damage; Thick Hide does the same for Bleed. Enemy hits spend Block before applying Armor. Health costs still bypass Armor.
- **Block status resistance** — while the hero has Block, Coagulate halves incoming Bleed damage and Detoxify halves incoming Poison damage. They mitigate damage rather than preventing buildup, and check Block before the incoming packet spends it; damage that breaks through Block still deals Health damage and matching status buildup.
- **Shield Slam** — Physical damage increases by half the player’s current Block. Rupture detonates Bleed only from a positive Critical Physical packet; a fully blocked or armored hit does not detonate it.
- **Crushing Force** — Earth Elemental checks the Block spent by the incoming hit. Replacing broken Block through a defensive reward does not cancel its follow-up; killing the enemy with retaliation does.
- **Damage vulnerabilities** — Shatter adds 1 damage to positive player/Companion packets against Frozen enemies, and Corrosive adds 1 against Poisoned enemies; Exploit Weakness doubles damage against Stunned enemies. A matching enemy trait never disables these Talents. Trait matching retains its established first-match order.
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/types/state-helpers.ts` (re-exported from `src/lib/battle/types.ts`); `braced` enemy trait halves incoming stun.
- **Crowd-control thresholds** — baseline Stun and Freeze trigger when buildup reaches at least half Health. Enemies use Health before the hit; heroes use maximum Health. Enemy current Health lets control become easier as a boss weakens, while checking before the hit prevents one damage packet from both adding buildup and lowering its own threshold. Threshold modifiers apply before the comparison.
- **Skipped player turns** — the committed turn resolver advances through Stun and Freeze skips until the hero can act or combat ends; skipped turns do not trigger Companion actions.
- **Crowd-control immunity** — neither side gains Stun or Freeze buildup while already Stunned, Frozen, or on the shared immunity cooldown. Typed damage still deals Health damage during immunity.

#### Health thresholds and defeat

- **Death's Door** — [Domain Glossary](./GLOSSARY.md#domain-glossary). Ordinary healing cannot revive a defeated hero. A lethal enemy attack or player status tick ends turn processing before regeneration, drawing, or companions; explicit death prevention remains available.
- **Card Health costs and self-damage** — Health loss bypasses damage reduction and resistance while retaining death prevention. Typed self-damage respects matching damage reductions and resistance and causes ordinary Armor decay from its mitigated amount; fully resisted damage adds no buildup or decay. Buildup follows Health lost before Phoenix Feather recovery, while Death’s Door can prevent that loss. Health costs do not decay Armor.
- **Talent Health cutoffs** — “below” is strict: Kill Shot requires less than 20% enemy Health and Desperate Wish less than half player Health. Desperate Guard triggers once per combat on the first surviving crossing from at or above half Health to below it, including status ticks, typed self-damage, and Health costs; lethal damage grants no defensive reward. Evaluate the crossing after incoming buildup but before Block-break healing. Other below-half talents recheck their condition for each applicable event.
- **Half-Health bonuses** — talents described as active below 50% Health require strictly less than half of the relevant maximum Health, including Armor, Forge, Physical/Bleed damage, and Leech bonuses. Exactly half Health does not qualify.
- **Fatal action cutoffs** — a fatal Health cost or retaliation stops subsequent card effects, including nested chance outcomes and queued effects. Death's Door and Phoenix Feather count as survival. Drain pending reactions from pre-card rewards before manual or automatic card effects begin. Fatal Cinder Skin during enemy status ticks stops the later ticks and the enemy ability, including when the enemy would otherwise skip its turn.
- **Lethality payouts** — a kill via any damage source (main hits, follow-up typed hits, stun/freeze procs, wish triggers, DoT ticks, bleed/poison detonation, mana-crystal burn) pays the same rewards exactly once per health transition: Bone Charm heal + gear kill rewards via `payKillPayouts` (`src/lib/battle/combat-text.ts`). Enemy DoT ticks and detonates share `applyEnemyDotDamage` in `src/lib/battle/dot-resolve.ts` so Divine Aegis and armor decay cannot skip a source. Documented exceptions stay source-specific (e.g. Lucky Clover gold is off freeze-proc kills).
- **Kill rewards** — Toxic Profit grants 3 Gold when defeating a Poisoned enemy through a hit, triggered damage, tick, or detonation, including a lethal hit that first inflicts Poison. The saved `killRewardsPaid` flag prevents nested damage reactions from paying the same enemy’s kill rewards twice.

#### Status ticks and detonation

- **DoT bonuses and Leech** — Frigid increases Burn, Poison, and Bleed ticks and each projected detonation tick while the enemy is Frozen, without increasing remaining stacks. Rotbloom's immediate Poison tick uses the same damage, decay, and riders as a natural Poison tick. Burn detonations include the same bonus against bleeding enemies as Burn ticks. Caustic removes enemy Armor equal to resolved Poison damage on direct hits, natural ticks, and detonations. Paralytic Venom rolls once per resolved Poison packet, including detonations, and deals matching Stun damage without recursively rolling from the derived Stun. Parasitic Bloom and Poison Leech heal from Health actually lost to Poison, excluding overkill from hits and ticks. Parasitic Bloom rolls on both direct Poison hits and natural Poison ticks, once per source, independently of Talent/Gear Poison Leech. Detonations pay queued Bleed Leech only when consuming Bleed, capped by both Bleed damage and actual Health loss; other statuses cannot fund or consume that healing.
- **Lethal status ticks** — resolve Burn, Poison, then Bleed, stopping when the enemy is defeated. Later ticks and enemy trait pulses cannot continue after either combatant is defeated. Phoenix Feather recovery does not erase Health lost to a Bleed tick for pending enemy Leech. Freeze's healing suppression includes pending Bleed Leech through the last Frozen turn.
- **Septic Shock** — while the enemy is Bleeding, Poison damage dealt to it is increased by 10% for ordinary hits, natural ticks, and each projected tick in a detonation. Apply the multiplier before resistance and rounding; it does not increase the remaining Poison stacks.

### Unique item interactions

[UNIQUE_ITEMS](./UNIQUE_ITEMS.md#combat-semantics) owns signatures, automatic-play
limits, repeated damage, Blackfletch detonation, and saved battle-local opportunities.

### Strategic card conditions

Shield Bash gains 2 Block, then deals Stun damage equal to half its live Block,
rounded to the nearest whole number; it does not spend Block. Mana payment and
its reactions finish first, and the Block gain precedes the hit, including Dodge
and reactive damage. Rejected plays spend neither resource. Maul deals one
randomly chosen 3 Bleed or Stun damage hit.
Ice Shot deals 2 Freeze, or 4 Freeze against an already Frozen target; it preserves
Frozen and its Archery tag but no longer grants free Archery. Existing free-Archery
preparations retain their normal consumption. Hawk Eye readies the next positive
player attack for a Crit after Freeze or Stun.

Fox, Maul, Pounce, Serrated Edge, and Smite use the seeded battle RNG to choose
their damage type before the hit; player, Companion, and enemy versions use the
same pool semantics. Forge, mitigation, buildup, and hit reactions use the
selected type. Recorded repeat packets retain the resolved amount/type and
cannot spend Block again; replaying the card's effects evaluates the random
choice again. Other card mechanics and enemy repertoires are unchanged.

Healing feedback shows the effective pre-cap amount, including overflow, after
all applicable modifiers and rounding. Actual restoration and overflow remain
separate for healing rewards and conversions; Clean Slate uses that same modified
healing calculation. Full-Health healing never fabricates actual restoration.

### Labyrinth exceptions

- **Labyrinth battle benefits** — battle-local `encounterBenefits` are captured at battle creation and saved with the battle. First Physical/Holy/Nature attack bonuses and the first Archery discount reset each player turn; automatic plays and Companion actions cannot spend them. Wishful expands only the first Wish each turn, including queued Wishes. Eager Pack gives two immediate Companion actions on summoning. Unbroken preserves player Block; White Heat and Ironclad prevent normal Forge/Armor decay, not explicit removal or spending. Eternal Flame preserves Burn ticks but does not prevent detonation; Venomous halves the Poison decay rate with the normal minimum of one, including remaining-damage detonations. Buildup bonuses respect Stun/Freeze immunity and enemy resistance. Blood Feast doubles player Leech across direct hits, status ticks, and Companion effects, never enemy healing. Restorative heals at player turn end before the enemy acts. Starting Phoenix Feather is battle-local; Dodge still uses its normal cap.
- **Labyrinth enemy rules** — Entrenched, Unbreakable, and Whitehot preserve only their corresponding enemy resource. Second Wind triggers once on a surviving downward half-Health crossing, including DoTs, detonations, crowd-control gear damage, and Profane Blood; it cannot revive an enemy. When Second Wind and Divine Aegis share a crossing, both use Health before either reaction; Second Wind healing cannot cancel Divine Aegis. Crowd-control gear and Thunderstone damage also trigger Divine Aegis on its half-Health crossing; Thunderstone respects Second Wind even when Stun comes from multiplying buildup. Thornhide/Briar Crown replenish their minimum Thorns at enemy turn start and retaliate with Nature damage on an undodged attack while the enemy survives; original saved Thorns traits retain their original reaction. Thick Hide reuses the existing enemy Physical resistance. Ravenous grants Leech to attack packets and queues Bleed healing from those attacks; blocked and Dodged damage cannot fund it.

### Engine invariants

Simulation-only instrumentation and measurement semantics live in [Balance simulation](./REFERENCE.md#balance-simulation).

- **Card classification** — `src/lib/battle/card-classification.ts` owns attack, damage-type, and keyword queries. Damage classification includes direct damage, Physical random damage, and cleanse-to-damage, including every type in a damage pool, both chance branches, and scheduled effects. Keyword queries use the same effect-derived keywords and tags shown on cards; tags alone do not make a card an attack. Effect execution, replay selection, and target selection retain their own semantics.
- **Damage outcomes** — enemy hit results distinguish attempted damage before defenses, resolved damage after defenses, actual Health loss after death prevention, Dodge, contact, and defeat. Contact is independent of defensive absorption. Player Health-hit results capture resolved damage, actual Health loss, and defeat before threshold healing or secondary reactions; DoT and Companion damage rewards use that captured Health loss. These results are execution-only and do not change saves.
- **Status ownership** — `addPlayerStatus` delegates assignment to `setPlayerStatus`, so both absolute updates and deltas cap pending enemy Bleed Leech when changing Bleed. Explicit Armor loss uses `removePlayerArmor` so Reactive Guard cannot be skipped. `spendPlayerForgeForAttack` records only attack spending; `restoreSpentPlayerForge` consumes that record once after the turn reset, bypasses gain bonuses, and owns recovery threshold rewards. Initialization and hydration retain raw state construction.
- **Damage module ownership** — `player-damage-base.ts` constructs player damage packets from base amounts, Forge, and flat typed bonuses. `player-damage-multipliers.ts` owns additive multipliers and first-Burn bonus flags. `damage-calc.ts` orders those stages, then applies pacing, critical strikes, mitigation, and final resolution. `player-defensive-reactions.ts` owns Block/Health-triggered defensive rewards; `enemy-attack-damage.ts` retains incoming-hit orchestration and reaction ordering.
- **Card and enemy hit stages** — capture pre-hit conditions and preserve each source’s explicit reaction order, Health-loss facts, Talent manifests, depth-first Archery hits, RNG, and combat text. Details: [Non-card reaction eligibility](#non-card-reaction-eligibility).
- **Typed hit resolution** — `typed-hit-resolution.ts` owns the shared Health → Armor decay → buildup → combat text → threshold → kill-payout order for player follow-up and talent hits. Card attack riders retain their distinct ordering, including recursive Archery hits and post-hit Forge consumption. `follow-up-hit-resolution.ts` declares recurring damage-conversion reactions in ordered data; changing that order changes RNG consumption. Talent manifest types derive from their current defaults; retired fields follow the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
- **State and arithmetic** — treat `BattleState` as immutable. Combat magnitudes use nearest-integer `Math.round()`, never `Math.floor()`; the battle-engine lint boundary enforces this convention.
- **Common damage modifiers** — `damage-modifiers.ts` owns the typed mapping from damage types to Talent and Gear flat bonuses, flat reductions, half-damage traits, and Gear resistances. Preserve their existing application stages and rounding; special conversion and reaction handlers keep their explicit order. Source manifests follow the current Talent and Gear contracts and the save baseline.
- **Turn presentation** — the accepted End Turn action resolves and commits before discard, enemy, draw, and Companion feedback plays. Companion turn-start effects resolve after the enemy and next-hand rules, before the next player action; delaying or cancelling their visual feedback cannot cancel their gameplay. Card and opening-hand results likewise commit before animation. Autoplay and automatic End Turn remain separate user preferences.
- **Battle RNG** — live combat draws the persisted `world` run stream (`withDraftWorldBattleRng` inside a command). Engine consumers use `getBattleRng(state)`, never direct `state.rng` access or `Math.random()`; RNG setup helpers own the execution-only callback seam; committed and saved `BattleSnapshot` values never contain it. Tests and the balance simulator use `createRunStreamRng` (same mixer as `nextRunRngValue`). `createBattleState` may pass explicit RNG in unit tests. All dice draw from `@/lib/rng` and stay in `[0, 1)`; out-of-range draws and empty ranges throw instead of biasing. Chance helpers share one probability core (`rollChance`; `rollPercent` is the 0–100 wrapper). Small math lives in `@/lib/math` (`clamp`, `clamp01`, `lerp`).
- **Fight pacing** — hidden combat scaler, not a player-facing status. Paces damage, block, forge, mana, and healing magnitudes; armor and gold grants bypass it at every site (pinned by `tests/lib/battle/fight-pacing.test.ts`). After the existing type target (7/12/20 turns), attack and triggered damage on both sides additionally multiply by `1 + (overrun / span)²`, using a span of 4 turns for normal/elite enemies and 3 for bosses. Healing and defensive/resource grants do not receive this extra multiplier. Derived hits and status ticks retain their existing inherited-damage rules rather than applying pacing again. [Domain Glossary](./GLOSSARY.md#domain-glossary). Balance simulator: `ALCHEMY_BALANCE_PACING=off` disables both pacing components but retains enemy progression scaling.

### Non-card reaction eligibility

- **Card and enemy hit stages** — `hit-resolution.ts` captures pre-purge conditions and resolves status reactions, Leech/Frozen reactions, depth-first Archery hits, typed rewards, then feedback/thresholds/payout. `enemy-attack-damage.ts` captures Health loss and Block spending before defensive reactions, then resolves crowd control, Leech, retaliation, and trait follow-ups. Captured hit outcomes never include later healing. These paths deliberately retain distinct ordering; RNG draws and combat-text order are behavior.

Resolution remains explicit and depth-first. Card and enemy hit handlers capture
pre-hit facts separately from the changing battle snapshot; an Archery extra hit
finishes before the outer hit pays its rewards. Do not replace this order with a
queued reaction pipeline.

| Origin                            | Card-only benefits                                                                       | Other reactions                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Played card                       | Eligible; consume first-use and next-card benefits normally                              | Resolve in the owning card/hit order                          |
| Companion                         | Ineligible through `action.source = "companion"`                                         | Companion bonuses and ordinary damage reactions still resolve |
| Unique repeat                     | Ineligible; `action.source = "repeat"` also disables potion scaling and repeat readiness | Keep the repeated effect's explicit source/context rules      |
| Delayed card, retaliation, reward | Ineligible through the corresponding action source                                       | Keep eligible status, healing and follow-up reactions         |

`action-context.ts` owns execution scope. `readCombatFlag` consults the central
eligibility policy in `combat-flags.ts`; `writeCombatFlag` prevents secondary
actions from spending or replacing protected card bonuses. The underlying flags
are never temporarily rewritten. A newly earned cost reduction keeps the greater
of its prior and granted values. Nested scopes inherit repeat suppression and restore only execution metadata.
`battleSnapshot` strips that metadata alongside RNG; saved flag names, including
the legacy `uniqueRepeatActive` field, remain readable.

`battle-sequence.ts` owns ordered step execution and defeat cutoffs for card
sequences, enemy abilities, status ticks, and Wish rewards. An explicit reaction
boundary selects settlement after each step or in the enclosing hit. Card Wishes
settle between Wishes; triggered Holy Wishes settle with their enclosing hit.
Pending Forge/Cinder Skin settlement remains in `enemy-attack-damage.ts`, using
the existing damage path. Hit-specific preconditions and depth-first ordering
remain unchanged.

---

## Corruption altars

- Pick one uncorrupted card, commit, and reveal the result. The existing intro, picker, and before/after result remain the entire interaction. Leaving before corruption restores the same destination choice; a completed result is saved and cannot be rerolled. A card can be corrupted once, including after transformation. Mana costs never mutate.
- Transformation has a 10% chance when another eligible library card exists. It replaces the selected card with a different card and one eligible mutation, preserving its deck-slot UID. Mixed Potions are not transformation destinations. Cards without numeric targets can receive a secondary effect; transformation is forced only if no local mutation exists.
- Other outcomes use `CORRUPTION_OUTCOME_WEIGHTS` from [Corruption tuning](../src/lib/game-constants/corruption.ts), renormalized after filtering for eligible families. Select the family first and then an equally likely compatible variant so large variant pools cannot crowd out other outcomes.
- Strengthening adds 50% (nearest integer, minimum one) to plain Physical/Holy/Nature damage, healing, or flat Block; weakening removes 25% with the same rounding. Other editable magnitudes change by one. Lower Health/Mana losses count as improvements. Numbers cannot go below zero or violate the effect schema’s stricter minimum, random-damage bounds cannot cross, and unchanged results are excluded. Repeated copies of an edited effect stay aligned with its description. Companion summon summaries are not numeric card-effect targets; upgrades such as Powerful Wish edit any added effect's own description.
- Secondary additions grant 2 Block, restore 2 Health, or deal 1 Poison/Burn damage, skipping already-present matching effects. Armor, Forge, or Thorns effects do not exclude an added Block effect. Add at most one effect-description line and only while fewer than four such lines exist; trailing keywords remain at the end. New numbers use the same saved highlight offsets as numerical mutations.
- Simple single-effect damage, healing, and flat-Block cards may double their magnitude for a 2 Health loss paid first, gain Draw 1 or Restore 1 Mana, or triple their magnitude and gain Consume. Existing resource generators, conditional/scaling attacks, and recursive effects cannot receive these bargains or jackpots. Unleeched simple damage cards may gain Leech. These changes never add a second corruption to the same card.
- Damage conversion is limited to simple damage descriptions and preserves identity and non-damage keywords. Scale its amount by the destination/source type baselines: Physical 6, Holy/Nature 4, Bleed/Freeze/Stun 3, Burn/Poison 2; round to nearest integer, minimum one. This avoids converting a large Physical hit into the same number of Poison or Burn stacks. Converted damage is highlighted even when the new type retains the same numeric amount.
- Consume removal requires one self-contained effect: healing up to 8, flat Block/Armor/Thorns up to 2, or simple damage no larger than its type baseline. Haste, Wishes, Mana generation, Companions, recursive effects, and conditional/scaling effects are excluded. Save an explicit `consume: false` override and remove the Consume line. Existing saved corruption results retain their shape; `delta` remains the numeric direction for numerical changes and is `1` for other outcomes.
- Labyrinth Corruption chambers play by the same altar rules at the same support-room rate. Leaving before corrupting returns to the maze with the chamber still open; walking past it skips it the same way. Each chamber rolls one green bonus: Steady Sigil, Pure Altar, Echoing Altar, Blood Rite, or Twin Offering (one visit, two gifts, still corrupted once).

## Content systems

### Saved runs and shared progression

Players keep one unfinished run. The main menu offers Continue when it exists,
otherwise Play opens the existing mode/hero setup. Continue restores the exact
activity, including pending battle results, rewards, events, shops, and drafts.
Menu and meta visits preserve that location. The existing red End Run menu action
ends the run immediately without confirmation and always shows the End Run screen;
Main Menu on that recap returns to the main menu. Earned progression is kept and
unclaimed choices are not granted. Normal defeat and victory retain their outcome screens. Drafting is part of the run, not setup
for a second run. Gold, Talents, Homestead progress, and equipment remain permanent
profile data. A current battle still protects its equipped items during meta visits.

### Run recap

Mode selection is titled **Start a Run**. Death and voluntary endings show **Journey’s End**;
victory keeps its own title. The ending recap preserves the run deck and Boons for
ordinary read-only inspection. Its resource row includes Gold earned during the run,
including committed combat and encounter rewards after multipliers, excluding starting
Gold and prior savings. Spending does not subtract from this earned total.

The recap omits the room progression trail. Existing menu upgrade highlights
continue to guide between-run progression.

Wildwood boss victories use the same boss Gold and enemy Material payout rules as
Campaign and Labyrinth while retaining Wildwood's reward choices and next-boss
flow. The existing Victory screen shows both currencies, and run-end summaries
include collected Materials and crafting currencies.

### Labyrinth exploration

Each Open Field floor contains twenty rooms in rows of 4 / 6 / 6 / 4: a 4×4
core with one extra room on each side of both middle rows. A completed entrance
starts in the top row; one boss occupies the bottom row, at least two columns
away. The encounter pool and Trait rules supply the other eighteen rooms.

An uncleared room is enterable when it shares a north/south/east/west edge with
any completed room on the current floor. Players can select any such frontier
room without manually walking through completed rooms. `currentNodeId` records
the last completed room; inspecting completed rooms does not move it or replay
encounters. Completing a pending reachable room marks it cleared and updates
that location atomically. Entering, inspecting, or leaving an unfinished room
does not extend discovery.

Discovery derives from completion: completed rooms, their cardinal neighbors,
and the boss are visible. Unknown room types, artwork, Traits, and interaction
themes remain concealed. The boss can be inspected from the start but requires
a completed adjacent room before fighting. Boss victory leaves the floor open
for exploration; Descend is available from its inspector without backtracking.
Descent advances once and generates the next floor only when needed;
already-generated next floors are reused. Prior floors cannot be entered.

Resume preserves geography, completion, and pending encounters. Invalid location
references fall back to the floor's completed entrance. Discovery is derived,
not separately saved. Map-version recovery follows the
[save migration history](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

### Labyrinth room modifiers

Red modifiers strengthen the enemy; green modifiers include battle benefits and
destination services. Normal Combat rolls one red and one green, Elites/Bosses
two compatible reds and one green, support rooms one matching green, and Entrance
none. Native enemy Traits participate in compatibility checks. Stronger red
modifiers are restricted to Elites/Bosses. Campaign and Wildwood ignore these
room rules. Combat-specific effects follow [Labyrinth exceptions](#labyrinth-exceptions).

Shielded Arrival gives the enemy 6 starting Block. Sundered Guard removes 2
additional Block before each landed attack resolves damage. Unbinding Strike
Purges one random beneficial player status after each landed attack. Ravenous
already grants attack Leech, and Thick Hide already halves Physical damage;
they remain the Labyrinth entries for those effects. Cinder Ward reuses the
native half-Burn rule. The other wards halve Poison, Bleed, Holy, Freeze,
Stun, or Nature damage. Nature is the damage type used by Thorns retaliation.
Wards combine with existing native defenses and follow the ordinary damage
pipeline, including its status-buildup behavior.

Arms, Armor, Ring, and Amulet Hoards make all Gear reward choices match the
named family and use normal Basic/Astral relative weights. Astral, Unique,
and Trinket Hoards make the entire reward choice set the named tier. Premium
Hoards only roll on depth-eligible nodes; if their tier or unowned pool is
unavailable at victory, the reward uses the ordinary roll. Gold and material
bonuses remain the existing Generous, Wealthy, Scavenger, and Herbalist rules.

Card Shop themes survive refreshes. Gear specialties constrain ordinary and
Unique offers and fallbacks. Shop displays and transactions share prices; free
services retain their visit limits. Strong Spirits doubles Potion amounts and
matching description numbers while preserving probabilities, cost, and Consume.
Purchases use the actual shelf card; modifications survive acquisition, mixing,
and restoration. Trinket themes require enough unowned matching content. The
current catalog has only two direct healing Trinkets and no Archery-specific
Trinkets, so neither theme rolls.

Mystery rooms select a compatible event and modify its displayed choices before
resolution. Resume reconstructs the same offers without reapplying rewards.
Corruption chambers reuse the Campaign altar rules and their green modifier
changes the corruption roll. Leaving before corrupting returns to the maze with
the chamber still reachable.

### Effect origins and flag lifetimes

`CardEffectResolutionContext.origin` distinguishes played cards, triggered cards,
and Companions. Card healing applies to the two card origins; first-play bonuses
apply only to played cards. The execution-only secondary action scope separately
protects next-card bonuses during repeats, retaliation, and delayed effects.

`combat-flags.ts` owns defaults, secondary-action eligibility, and lifetime for
every flag. Player-turn flags reset through `resetTurnFlags`; combat and
until-consumed flags survive that reset. Save field names and values are unchanged.

Attack packet ordering remains attempt bonuses, Dodge, contact-only flag
consumption, magnitude and mitigation, riders, follow-up hits, then settled
reactions. `consumeAttackBonuses` owns the action-local pool shared by successive
effects and play-twice; these attempt bonuses are spent even on a Dodge, while
next-hit flags are preserved. This ordering is separate from the detailed
hit-stage ordering above and must not reorder RNG or feedback.
