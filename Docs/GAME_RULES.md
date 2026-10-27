# Alchemy — Game rules

Canonical owner for game rules, content-system behavior, and shared domain terms. Coding rules: [AGENTS.md](../AGENTS.md). Run state: [ARCHITECTURE.md](./ARCHITECTURE.md). How-to checklists: [WORKFLOWS.md](./WORKFLOWS.md). Command catalog: [COMMANDS.md](./COMMANDS.md).

## Guide index

- [Every player action receives feedback](./UI.md#every-player-action-receives-feedback) governs gameplay presentation: communicate accepted, rejected, and ineffective actions while keeping resolution independent of animation and sound.
- [Combat rules](#battle-implementation-rules) and [engine invariants](#engine-invariants).
- [Shared healing](#healing-and-leech), [resource rewards](#armor-forge-and-gold), and [triggered hits](#triggered-and-copied-damage).
- [Talent rules](./TALENT_RULES.md): progression and talent-specific action/event eligibility.
- [Unique items](./UNIQUE_ITEMS.md): signature effects and combat exceptions.
- [Corruption altars](#corruption-altars).
- [Shops](#shops), [brewing and Transmutation](#brewing-and-transmutation), and [universal reactions](#universal-reactions).
- [Modes, saved runs, and Labyrinth exploration](#content-systems).
- [Terminology](./GLOSSARY.md#domain-glossary).

## Battle Implementation Rules

Operational rules for `src/lib/battle/` that deviate from typical CCG assumptions. Term definitions: [Domain Glossary](./GLOSSARY.md#domain-glossary). Tests: `tests/lib/battle/`.

Combat feedback retains displayed amounts separately from optional resolved
`healthLost` and `absorbedDamage` packet facts. Audio uses those facts for cue
strength; they do not feed combat calculations. Direct and periodic packets remain
separate when text events merge. Health costs and stripped Block are non-impact
feedback. See [audio selection](./AUDIO.md#battle-sound-focus).

### Direct player hit resolution

`player-hit-core.ts` names the source of each direct player-to-enemy hit. `hit-resolution.ts`
owns card, reflection, and purge sequencing. `card-hit-reactions.ts` owns intrinsic
card reactions, while `elemental-hit-reactions.ts` owns Holy and Nature rewards;
`follow-up-hit-resolution.ts` is the lower resolution tier, also used by Wish and
defensive reactions. That dependency direction
keeps shallow hits from importing their parent card/Wish orchestration. Calculation and
intrinsic statuses remain in their existing lower-level owners.

The table describes the current hit recipes. “Intrinsic” means
`applyDamageStatuses`, including its existing status-triggered reactions, not just
adding a status stack. Thresholds and once-only kill rewards use `applyHitEpilogue`.

| Source                            | Amount and mitigation                                                                                                                                        | Reactions and closing order                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card attack (including Companion) | Attack orchestration calculates bonuses, pacing, critical strikes, Block and Armor once before requesting the hit. Dodge precedes next-hit flag consumption. | Capture eligibility before purge; apply Health damage; preserve Forge; decay Armor; intrinsic/conversion reactions; Leech/frozen reactions; Archery reactions; Holy/Nature rewards; damage text; thresholds/kill rewards; frozen Physical Forge payout. |
| Player follow-up                  | Card-style numeric bonuses, pacing, critical strikes and mitigation, with no real card metadata.                                                             | Health; Armor decay; intrinsic statuses; damage text; thresholds/kill rewards; Nature Gold/mana refunds or Holy Faith Barrier/Brass Censer. No card conversion recipe or Forge spending.                                                                |
| Fixed talent hit                  | Pace its fixed amount, apply enemy multiplier and round, then Block and Physical/Stun Armor. No offensive card bonuses or critical strike.                   | Stop if no damage remains; otherwise Health, Armor decay, intrinsic statuses, text, thresholds/kill rewards, then Holy Leech/Faith Barrier/Block/Tithe, Nature refunds, or Burn Forge payout.                                                           |
| Derived talent hit                | Round its already-paced amount and apply only the enemy trait multiplier, then round and mitigate as above.                                                  | Same shallow talent recipe. Do not apply pacing or offensive bonuses again.                                                                                                                                                                             |
| Reflected Holy                    | Block lost × saved reflection percentage × Holy trait multiplier, rounded, then enemy Block.                                                                 | Health, Armor decay, damage text, intrinsic statuses, full Holy reactions including Wish, then thresholds/kill rewards using pre-damage statuses. No Forge spending.                                                                                    |
| Attack purge                      | Once per player turn, remove the first active Armor, Block, Forge, Thorns, Burn Bonus, or Freeze Bonus category.                                             | Emit a Purged notice with no damage or follow-up. The use is spent only when a benefit was removed.                                                                                                                                                     |

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
- **Companions** — invulnerable; act at player turn start; persist indefinitely. Summon cards leave the battle after playing without Consume, entering the battle-removed pile rather than discard. They grant no Consume XP, bonuses, rewards, or enemy Consume reactions. Non-summoning Companion cards retain their normal destinations.
- **Draw / deck** — Ecosystem tutors one Nature card before the ordinary opening draw. If combat remains active, battle initialization then commits the opening 4 plus other battle-start bonus draws before their animation; later turns draw 4. A terminal opening or turn-end effect does not start a new draw or discard phase. Max hand 7; ordinary and keyword draws reserve actual cards in an ordered battle-only queue when the hand is full, and Wishes queue chosen cards the same way. Queued cards enter the hand oldest first when space opens, before later draws, and survive turn changes and save/resume. A draw with no eligible card grants nothing. The previous hand is discarded at player turn end, while cards drawn during the enemy phase remain alongside the next four draws; discard reshuffles immediately when the draw pile empties, including after the final requested draw. Cards discarded while the draw pile is empty also refill it immediately. Overflow cards remain reserved and are never included in the shuffle. Consumed cards are removed for the remainder of the battle. If a player-turn draw finds the hand, queue, draw pile, and discard empty, an Emergency Wish opens the normal Wish choices and the selected card enters the hand; this can recur whenever the piles are empty.
- **Block** — absorbs incoming damage first; halved (not cleared) at the start of the owner's next turn, after the opposing side had a chance to attack into it.
- **Haste** — extra turns skip the enemy phase; both blocks hold until a real attack window resolves, then halve once each.

### Persistent Forge

Player and enemy Forge add 1 Physical/Stun damage per stack and survive attacks;
Purge removes the entire category. Overlapping Forge conversions take the
strongest applicable permission, never their sum. Read exact conversion values
in the Talent, Homestead and Unique catalogs.

Icebreaker, Emberforged, Sunder and Oathkeeper resolve once per eligible attack
action, not per packet; that action-local bookkeeping is not saved. Authored
per-turn limits, including Vanguard’s Crest and Obsidian Hammer, survive reload.
[Resource gains](#armor-forge-and-gold) own the nonrecursive Forge award recipe;
[Unique signatures](./UNIQUE_ITEMS.md#combat-semantics) own turn-specific grants.

### Companion Bond

Bond 0 preserves the baseline. Damage, healing, Gold, and Scarab Block gain +1 per Bond level. Wolf deals one randomly selected Bleed or Physical hit each turn, with its damage scaling by Bond. Fox deals one randomly selected Stun or Bleed hit each turn, with its damage scaling by Bond. Mana Moth and Library Owl retain their guaranteed baseline and gain a 25%/50%/75% chance of one extra Mana/card at Bond I/II/III. Will-o’-Wisp keeps cleansing one status and additionally heals 1/2/3 Health. Summon cards, the active Companion panel, and battle card inspection share the combat owner’s Companion-specific scaling, including Bond, Gear, Mana Crystal, and conditional damage bonuses. Collection descriptions retain their noncombat context.

- **Companion damage rewards** — Predator's Instinct doubles damage only strictly below 30% enemy Health, comparing against the unrounded threshold. Companion damage rewards use Health lost to its damage packets before enemy healing reactions; Second Wind cannot cancel those rewards, and utility actions cannot earn them through unrelated damage reactions.
- **Companion card perks** — Whistle and Hunter's Bond use the card's Companion keyword, including Pack Tactics. Whistle makes the active Companion act after all effects of the card finish, including a newly summoned Companion. Whistle occurs once per card play, including automatic plays, never again for repeated or scheduled effects. Hunter's Bond draws only for the first Companion card played each turn. Both `getCardKeywords` and `cardHasKeyword` use the full content keywords, including utility effects.
- **Companion Forge** — Companion attacks use ordinary damage-type Forge permissions and preserve player Forge.
- **Pack Tactics** — makes the active Companion act twice, including utility actions. Without an active Companion, it opens a normal Wish whose options are restricted to Companion summon cards; the chosen card enters the hand. It then grants 4 Block. Ordinary Companion bonuses and reaction cutoffs apply, and card-play rewards occur once.
- **Wishing Potion** — costs 1 Mana and Consumes to Wish twice from the ordinary card pool, excluding the originating card as usual. It has no additional draw. Both Wishes trigger normal Wish bonuses; chosen cards enter the hand or its pending queue. Mixing and distilling can increase the Wish count.

### Enemy abilities and traits

#### Repertoire and resolution

- **Native Traits** — every enemy has exactly one positive and one negative native Trait, in that order; encounter modifiers are additional. Damage vulnerabilities are 30%. Hollow Frame prevents player Leech and its rewards. Pilfer steals up to 1 existing player Block before each direct attack hit, including Dodged hits. Snap Shut grants 1 Block after each landed hit. Soul Harvest independently chooses Purge or Leech below half Health for each hit. Contagion heals for positive Poison packets against the hero, including blocked, resisted, periodic and typed self-damage packets, while combat continues. Native traits refresh from the current catalog on resume. Mimic doubles its victory Gold by enemy identity, outside its trait slots.
- **Repertoire** — each enemy has three distinct canonical card IDs in `abilityIds`. `getEnemyAbilities` resolves the same card definitions used by heroes. The supported subset is validated recursively by `isEnemyAbilityCard`; unsupported card effects, Consume, and hero resource systems cannot silently fizzle on enemies.
- **Selection** — `processEnemyAbility` uniformly selects one available card using world RNG, excluding `lastEnemyAbilityId`. The opening choice uses all three. Haste and crowd-control skips do not select cards or advance history. Recheck enemy crowd control after status ticks and turn-start traits, so Stun from either phase skips the upcoming ability without ticking statuses twice. If combat ends during a turn-start trait, no ability is selected or reported. Inspection never consumes RNG and does not reveal an upcoming action.
- **Skipped enemy turns** — Stun and Freeze skip ability selection while status ticks, scheduled native/difficulty growth, Overgrowth, and ordinary regeneration retain their existing order. Pending enemy Bleed Leech still settles once with its matching tick.
- **Resolution** — `applyEnemyAbility` interprets self/opponent targets from the enemy's perspective without borrowing hero talents, Gear, mana, hand, or Gold. Room/difficulty scaling applies at resolution, keeping canonical card definitions immutable. Damage based on live Block or Forge skips a second room multiplier but still receives ability pressure and difficulty modifiers. Positive enemy ability damage has a minimum of 1 after room, progression, and difficulty scaling; zero-base effects retain their existing behavior, and defenses can still prevent all damage. Enemy benefits use enemy healing/mitigation owners; factor-based effects retain their authored factors. Multiplication feedback reports the added buildup, matching hero effects, and emits nothing when no buildup is added. A lethal counterattack stops remaining effects and follow-ups.
- **Ability stages** — `enemy-turn-attack.ts` selects cards and sequences effects. `enemy-ability-damage.ts` resolves each direct hit and its native rewards; `enemy-ability-followups.ts` owns native hit follow-ups plus the separate ability epilogue for hero Thorns. Bonus packets and ongoing damage cannot recursively originate native attack traits.
- **Enemy Forge** — each stack adds 1 Physical and Stun damage and persists through attacks, including blocked hits, dodges, and Forge-based Burn. Burning Blade adds rounded half existing Forge to its base damage without generating or spending Forge. Whitehot grants exactly 1 starting Forge, without room scaling; loading a battle preserves its saved Forge without granting it again. Existing Forge grants and Purge retain their rules.
- **Enemy progression** — `game-constants/enemy-balance.ts` owns separate Health and ability-pressure curves by enemy type, with content-specific overrides. Normal and Elite ability pressure grow with diminishing returns at later depths. `battle-enemy-setup.ts` derives progression from the existing room multiplier; no hero identity, report tier, or additional saved field participates. Progression factors stop growing after depth 24 while ordinary room scaling continues. New bosses receive 10% less Health after progression and content scaling, without changing ability pressure. Health tuning applies only when creating a battle; saved Health, defenses, ability rosters, and action history remain intact. Block, Armor, healing, regeneration, and trait grants retain their existing scaling.

#### Enemy reactions

- **Resolved player actions** — Jealous gains its Physical damage bonus for each resolved Wish, including Faustian Bargain's Wish, Stargaze's immediate Wish, and triggered Wishes. Insatiable also reacts to cards consumed by Dance of Blades. Consume rewards require the hero to survive retaliation, including automatic plays; Death’s Door still counts as survival. The card remains consumed even if retaliation defeats the hero. The older Thorns trait and Holy Retribution check attempted damage in the resolved action, including chance branches and Exorcism, only while the enemy survives; a utility-only chance outcome does not retaliate. Repeated effects track their attempts separately and retain existing reaction limits.
- **Rooted** — gains Block once per played Nature card, using the same full keywords shown on the card, including nested effects and tags. Repeated effects and Companion actions do not count as another card play.
- **Attack traits** — fully prevented positive incoming hits still land, consuming Ambush and permitting native hit rewards; Dodge prevents those rewards. Leech still requires Health damage. Cowardly and Flickering/Loose Rubble reduce the next attack’s total damage by 1 across its hits. Utility abilities preserve pending reductions. Concussion weakens every direct hit of the next damaging hero card by 25%, preserving the penalty through utility cards and excluding Companion and ongoing damage. Brawler’s Seeing Stars halves its next damaging ability after Stun.
- **Hit traits** — Holy hits grant Zealot Forge and restore Cleric Health; Holy/Stun hits grant Paladin Block; Stun hits grant Stone Titan Armor. Each landed hit qualifies even when mitigation prevents Health loss. Fire Imp, Giant Spider and Winter Wolf add their riders to every landed hit. Dodge prevents hit rewards. Inquisitor adds 1 Holy damage against heroes below half Health. Self-Sacrifice costs 1 Health after every attempted hit; lethal recoil stops subsequent effects.
- **Blood traits** — Blood Frenzy adds 1 damage to a Bleed hit against a hero already Bleeding before that hit; it grants no Leech. Blood Scent adds one separate 1-Bleed hit when the hero is strictly below half Health before each hit; defensive abilities do not trigger it and the bonus has no inherent Leech. Native Bleed Leech carries its own buildup into `pendingEnemyBleedLeechHealing`, so unrelated or bonus Bleed cannot fund extra healing. Cleansing Bleed clears that pending Leech; partial removal caps it to the remaining buildup before fresh Bleed can arrive. Existing healing reductions still apply. Profane Blood damages Blood Countess only when the hero actually restores Health, never from overhealing or the Countess's own healing.
- **Enemy Thorns** — card-granted Thorns retaliate as Nature damage on a non-Dodged hero hit while the enemy survives, consuming the ordinary Thorns stacks. `legacyEnemyThornsReady` reserves one stack for the original encounter trait's distinct Physical, once-per-card retaliation while the enemy survives; new card stacks do not replace or disable that behavior.
- **Boss traits** — Forge Golem gains 1 Forge every other turn; Frostwarden adds 1 Freeze damage; Iron Bear gains 1 Armor every other turn. Blood Countess emits 1 Bleed and Seraph emits 1 Holy every other turn. Periodic effects follow scheduled turn cadence, including control skips, and stop when combat ends. Stone Titan gains 1 Armor on each Stun hit.
- **Elemental traits** — Frost Elemental adds 1 room-scaled Freeze damage to Freeze hits. Ice Wraith heals through Cold Embrace instead. Pyromancy adds 1 room-scaled Burn damage to Pyromancer ability Burn hits only while the hero has no Burn, through the original hit without a separate packet or direct buildup grant. Cinder Skin deals 1 room-scaled Burn damage on the first actual enemy Health damage on alternating player turns (1, 3, 5, and so on) while the enemy survives, including cards, Companions, triggered damage, and damage over time. Fully prevented and lethal hits do not spend the reaction. The Health-damage helper spends its once-per-turn flag and queues `pendingCinderSkinReaction`; action and tick resolvers drain it through the existing enemy damage path, clearing the pending flag before retaliation. Both flags persist through automatic actions; the once-per-turn flag resets at the next player turn.

### Damage, statuses, and survival

#### Dodge

- **Dodge** — both sides have a 5% chance to Dodge each opposing attack **damage packet** before Block and Armor, unless the target is actively Stunned or Frozen. A dodge deals 0, spends no Block/Armor, skips that packet's status riders and lifesteal, and shows Dodge combat text instead of damage. Status-only attacks, DoT ticks, and encounter/proc pulses cannot be dodged. Each damage packet rolls independently. Player Dodge adds gear, talent bonuses, and Finding Rhythm, capped at 75%. Torpor can additionally prevent enemy Dodge while Poisoned.
- **Dodge chance bonuses** — Last Gasp requires strictly less than half Health. Finding Rhythm adds its talent-defined bonus for each hostile damage instance that reaches Health after mitigation, before death prevention (including harmful status ticks and enemy pulses; excluding self-damage and Health costs). Its bonus persists across turns, has no separate stack cap, and clears on a hero Dodge or battle end.
- **Dodge rewards** — Unburdened cleanses player Stun and Freeze buildup on a Dodge; it does not add Dodge chance. On-Dodge gear, on-Dodge talents, and Dance of Blades fire only when the hero Dodges. Each successful hero Dodge earns 1 run Dodge XP; commit it with the resolved enemy turn, never with presentation callbacks. Clean Getaway subtracts its amount from each of Burn, Poison, and Bleed and triggers cleanse rewards once only if at least one status reaches zero. Matching numeric Dodge gear and talent rewards add together. Tailwind draws on each Dodge, including multiple Dodges within one enemy attack. Smoke Screen deals 2 triggered Burn damage when Dodging a Burning enemy.

#### Mitigation and crowd control

Crowd-control triggers require both combatants to survive the hit. A lethal Stun or Freeze hit does not control the defeated enemy or award crowd-control bonuses.

- **Player damage mitigation** — Aetherward reduces hostile hits, Burn/Poison/Bleed ticks, and typed self-damage by the number of filled Mana Crystals, before the remaining defenses. Temporary overflow Mana does not count, and multiple Aetherward copies do not stack; Health costs bypass it. Burn, Poison, and Bleed ticks retain their damage type through flat reductions and Gear resistance. Enemy attack buildup, ordinary enemy Leech (including Flesheater), and Armor decay use damage after all applicable mitigation, before death prevention; fully resisted damage grants none. Later hero healing cannot cancel earned Leech. Ravenous still limits Leech to actual Health lost.
- **Reinforce** — Reinforce divides absorbed Physical damage by its absorption multiplier to determine Block spent, rounded to nearest integer; exhausting the full absorption capacity spends all remaining Block. Extra enemy Block destruction applies to Block spent.
- **Elemental Armor** — Fireward lets Armor mitigate direct Burn hits as well as Burn ticks and typed self-damage; Thick Hide does the same for Bleed. Enemy hits spend Block before applying Armor. Health costs still bypass Armor.
- **Block status resistance** — while the hero has Block, Blood Ward halves incoming Bleed damage and Venom Ward halves incoming Poison damage. They mitigate damage rather than preventing buildup, and check Block before the incoming packet spends it; damage that breaks through Block still deals Health damage and matching status buildup.
- **Shield Slam** — Physical damage increases by half the player’s current Block. Rupture detonates Bleed only from a positive Critical Physical packet; a fully blocked or armored hit does not detonate it.
- **Crushing Force** — Earth Elemental checks the Block spent by the incoming hit. Replacing broken Block through a defensive reward does not cancel its follow-up; killing the enemy with retaliation does.
- **Damage vulnerabilities** — Brittle Ice adds 1 damage to positive player/Companion packets against Frozen enemies, and Corrosive adds 1 against Poisoned enemies, including Icy Heart, Thunderstone, and crowd-control Gear damage; Exploit Weakness doubles damage against Stunned enemies. A matching enemy trait never disables these Talents. Trait matching retains its established first-match order.
- **Sundering Charm** — Physical and Stun packets remove its stated Armor before Armor mitigation, including fixed/derived Talent hits and crowd-control Gear/Trinket damage. Fully blocked positive packets still remove Armor; zero-base effects grant no removal.
- **Enemy status** — stack changes go through `addEnemyStatus()` / `setEnemyStatus()` in `src/lib/battle/status-state.ts`; `braced` enemy trait halves incoming stun.
- **Crowd-control thresholds** — baseline Stun and Freeze trigger when buildup reaches at least half Health. Enemies use Health before the hit; heroes use maximum Health. Enemy current Health lets control become easier as a boss weakens, while checking before the hit prevents one damage packet from both adding buildup and lowering its own threshold. Threshold modifiers apply before the comparison.
- **Skipped player turns** — the committed turn resolver advances through Stun and Freeze skips until the hero can act or combat ends; skipped turns do not trigger Companion actions.
- **Crowd-control immunity** — neither side gains Stun or Freeze buildup while already Stunned, Frozen, or on the shared immunity cooldown. Typed damage still deals Health damage during immunity.

#### Health thresholds and defeat

`lib/battle/battle-outcome.ts` owns combat completion: `getBattleOutcome` returns
Victory, Defeat, or no outcome. Defeat takes precedence if both combatants are
defeated; active Death's Door counts as survival. Turn processing, command
eligibility, live settlement, headless playthroughs, and balance reports use this
same policy. Target-specific damage and earned reward reactions retain their
separate cutoffs.

- **Death's Door** — [Domain Glossary](./GLOSSARY.md#domain-glossary). Ordinary healing cannot revive a defeated hero. A lethal enemy attack or player status tick ends turn processing before regeneration, drawing, or companions; explicit death prevention remains available.
- **Card Health costs and self-damage** — Health loss bypasses damage reduction and resistance while retaining death prevention. Typed self-damage respects matching damage reductions and resistance and causes ordinary Armor decay from its mitigated amount; fully resisted damage adds no buildup or decay. Buildup follows Health lost before Phoenix Feather recovery, while Death’s Door can prevent that loss. Health costs do not decay Armor.
- **Talent Health cutoffs** — “below” is strict: Kill Shot requires less than 20% enemy Health and Desperate Wish less than half player Health. Desperate Guard triggers once per combat on the first surviving crossing from at or above half Health to below it, including status ticks, typed self-damage, and Health costs; lethal damage grants no defensive reward. Evaluate the crossing after incoming buildup but before Block-break healing. Other below-half talents recheck their condition for each applicable event.
- **Half-Health bonuses** — talents described as active below 50% Health require strictly less than half of the relevant maximum Health, including Armor, Forge, Physical/Bleed damage, and Leech bonuses. Exactly half Health does not qualify.
- **Fatal action cutoffs** — a fatal Health cost or retaliation stops subsequent card effects, including nested chance outcomes and queued effects. Death's Door and Phoenix Feather count as survival. Drain pending reactions from pre-card rewards before manual or automatic card effects begin. Fatal Cinder Skin during enemy status ticks stops the later ticks and the enemy ability, including when the enemy would otherwise skip its turn.
- **Lethality payouts** — a kill via any damage source (main hits, follow-up typed hits, stun/freeze procs, wish triggers, DoT ticks, bleed/poison detonation, mana-crystal burn) pays the same rewards exactly once per health transition: Bone Charm heal + gear kill rewards via `payKillPayouts` (`src/lib/battle/player-rewards.ts`). Enemy DoT ticks and detonates share `applyEnemyDotDamage` in `src/lib/battle/dot-resolve.ts` so Divine Aegis and armor decay cannot skip a source. Documented exceptions stay source-specific (e.g. Lucky Clover gold is off freeze-proc kills).
- **Kill rewards** — Toxic Profit has a 10% chance to steal 4 Gold when defeating a Poisoned enemy through a hit, triggered damage, tick, or detonation, including a lethal hit that first inflicts Poison. The saved `killRewardsPaid` flag prevents nested damage reactions from paying the same enemy’s kill rewards twice. Kill healing uses the base
  restore/cleanse path without restarting the full healing reaction chain.

#### Status ticks and detonation

- **DoT bonuses and Leech** — Frigid increases Burn, Poison, and Bleed ticks and each projected detonation tick while the enemy is Frozen, without increasing remaining stacks. Rotbloom's immediate Poison tick uses the same damage, decay, and riders as a natural Poison tick. Burn detonations include the same bonus against bleeding enemies as Burn ticks. Caustic removes enemy Armor equal to resolved Poison damage on direct hits, natural ticks, and detonations. Paralytic Venom rolls once per resolved Poison packet, including detonations, and deals matching Stun damage without recursively rolling from the derived Stun. Parasitic Bloom and Poison Leech heal from Health actually lost to Poison, excluding overkill from hits and ticks. Parasitic Bloom rolls on both direct Poison hits and natural Poison ticks, once per source, independently of Talent/Gear Poison Leech. Detonations pay queued Bleed Leech only when consuming Bleed, capped by both Bleed damage and actual Health loss; other statuses cannot fund or consume that healing.
- **Lethal status ticks** — resolve Burn, Poison, then Bleed, stopping when the enemy is defeated. Later ticks and enemy trait pulses cannot continue after either combatant is defeated. Phoenix Feather recovery does not erase Health lost to a Bleed tick for pending enemy Leech.
- **Septic Shock** — while the enemy is Bleeding, Poison damage dealt to it is increased by 10% for ordinary hits, natural ticks, and each projected tick in a detonation. Apply the multiplier before resistance and rounding; it does not increase the remaining Poison stacks.
- **Bleeding Out** — while the hero is strictly below half Health, natural Bleed ticks and each projected detonation tick receive its 25% damage bonus without increasing the remaining stacks. Bloodember Pendant also shares this conditional bonus with Burn ticks.

### Unique item interactions

[Talent-specific eligibility](./TALENT_RULES.md#selective-feedback-rewards) and
[shared resource rewards](#armor-forge-and-gold) own Holy/Nature payout bases,
including actual Health loss, overkill and lethal-hit eligibility.
[Unique items](./UNIQUE_ITEMS.md#combat-semantics) own signatures, automatic-play
limits, repeated damage, Blackfletch detonation and saved opportunities.

### Triggered and copied damage

- **Typed talent procs** — Entangle and Heavy Blows can create equal-to-packet Stun. Lacerate and Briar Patch can create derived Bleed hits; Toxic Pollen can create a derived Poison hit. Each scales from the triggering packet. Scorching Light and Hemotoxin retain their existing typed conversions. Derived hits round their base amount, apply target resistance, Block, and applicable Armor once, and do not reuse offensive bonuses, pacing, critical strikes, or reserved card bonuses. Secondary Talent hits cannot roll the same new chance recursively.
- **Critical and copied damage** — Rupture detonates Bleed only after a positive Critical Physical packet. Parting Cut still copies half the resolved Physical damage as Bleed. Damage-matching Stun procs from Physical/Burn/Nature/Poison hits or Companion damage still copy the full amount. These effects use the same derived-hit resolver; their input damage has already been scaled and cannot apply Forge, critical strikes, damage bonuses, or fight pacing a second time. Viper’s Courtesy retains its separately documented typed-bonus behavior in [Unique items](./UNIQUE_ITEMS.md#combat-semantics).
- **Triggered damage** — Burning Wish resolves its talent damage through the typed trigger path, including Burn buildup, mitigation, Armor decay, and kill rewards; Gear-only Wish pulses retain their existing behavior. Mana Flare uses the same fixed Talent hit path, respecting enemy Block before adding Burn buildup and decaying Armor from its resolved damage. Icy Heart checks enemy half-Health reactions before kill rewards. Crowd-control Gear/Trinket packets receive Brittle Ice and Corrosive before pacing and mitigation. Sundering Charm removes Armor before Physical/Stun mitigation on these packets and fixed/derived Talent hits. Scaled damage against an already defeated enemy does nothing, including its damage rewards and reaction callbacks.

### Healing and Leech

- **Cleansing rewards** — removing multiple harmful statuses with a cleanse grants Sin-Eater’s Lantern and Renewal healing once per status actually removed. Empty status slots grant nothing. Unburdened counts Stun and Freeze separately. Clean Getaway retains its single reward per Dodge.

- **Mending** — increases every battle Health grant once, including card healing, Leech, cleansing, Gear/Trinket healing, and the combined start-of-combat heal. Opening healing retains its unpaced amount, respects the Health cap, and triggers ordinary healing reactions. Apply its multiplier after source-specific healing bonuses; overheal rewards use the increased amount.
- **Deep Siphon** — adds 1 Health to each positive player Leech healing packet, including card, Companion, incidental, repeated/scheduled, and deferred Bleed Leech. Mixed card/incidental Bleed receives the bonus once per payout. Apply the flat bonus after Desperate/Gear scaling and before Blood Feast and Affliction Siphon. The saved `pendingCardBleedLeechHealing` subset still attributes explicit card Bleed for Clean Slate; Deep Siphon no longer depends on that attribution.
- **Sanguine** — Bleed hits roll their Leech chance when they add buildup. Successful hits queue healing for the resulting Bleed damage; ticks and detonations pay that queued credit rather than rolling a new Sanguine chance.
- **Healing and reaction sources** — Blood Debt rolls 10% on each positive Leech-healing event and grants Gold equal to actual Health restored. Mana Siphon and Siphoning Gear each roll once per positive player Leech healing event, even at full Health; damage-only Leech-hit rewards remain limited to hits. Sanguine Overflow requires actual Leech healing from below full to full Health and grants 1 Mana, refreshed rather than stacked within that event. Affliction Siphon increases Leech healing against Poisoned or Bleeding enemies once, including normal Bleed ticks and detonations. Clean Slate reacts only to overhealing from card healing effects or a card's explicit Leech, including Gear damage repeats and echoes, never healing awarded by cleansing, gear, or talents.
- **Enemy healing reduction** — Necrosis and Mortal Wound each halve every enemy Health grant while their matching status is present, including Leech, Regeneration, Overgrowth, and Second Wind. Apply each reduction once, before fight pacing, with nearest-integer rounding. Mortal Wound’s matching status is Bleed.

### Armor, Forge, and Gold

Counterplate also reacts to Armor explicitly stripped by Caustic, including when
its Poison damage is fully prevented. Capture the removal before Reactive Guard
or another reward replaces the Armor.

- **Opening resource gains** — starting Forge, Armor, and Block use ordinary gain bonuses and reactions without fight pacing. Grant Forge before Armor and Block so Tempered Guard sees opening Forge; apply flat Gear bonuses once. Last Stand, Desperate Forge, Ironwood Buckler, and Radiant Guard also apply to their matching opening gains. Resume does not replay these grants.
- **Armor rewards** — Armor earned during battle is unpaced and passes through Last Stand, Reinforced’s doubling roll and Purification’s one-status cleanse roll. Armored Surge rolls on playing a Block-keyword card to grant its catalog Armor amount, including automatic plays, never again for repeated effects or secondary Block gains; Iron Guard rolls 10% on positive resolved Physical Health damage and grants Armor equal to that damage. Armor Siphon removes only the stated amount from the enemy before applying hero gain bonuses.
- **Reactive Guard** — a surviving hero gains its Block reward whenever positive Armor falls to zero, including normal decay, Sunder, Caustic, and Banshee's purge. Partial removal and removal from zero grant nothing; Ironclad prevents decay but not explicit removal. Counterplate uses Armor actually removed by the attack before later defensive rewards. Caustic removes enemy Armor equal to each resolved Poison packet from direct Poison hits, natural ticks, and detonations.
- **Forge rewards** — Each positive Forge grant independently rolls Overheat while Burning, Intensify, and Desperate Forge strictly below half Health. Each success adds its catalog bonus to the same award; bonus Forge does not roll again. Smithguard grants Block once for that combined award. Forge gains are unpaced, including Vanguard’s Crest and Burn rewards. Golden Crucible rolls per positive combat Gold award through the same gain owner. Current Forge Talents have no threshold reactions or deferred reward queue. Emberforged eligibility follows the [Gear battle rules](./ARMORY.md#battle-integration). Sunder removes Armor equal to rounded half the pre-hit Forge after a positive Physical hit, once per attack action, preserving Forge.
- **Block depletion** — Second Wind and Resolute restore their combined Health amount, and Briarward grants Thorns when positive Block reaches zero. These rewards also apply to turn decay, Laughing Guard spending, and enemy purges. Forged Bulwark grants 1 Forge only when an enemy attack depletes positive Block, even if an earlier defensive reward refills it; non-attack removal grants none. Partial removal and removal from zero grant nothing; Winter’s Credit payment retains its explicit depletion-reward exception. Attack-only retaliation and Watchdog still require an enemy attack.
- **Sun-Struck Shield** — reflects 30% of the Block actually lost when an enemy attack depletes Block, including Block removed by Sundered Guard before absorption. Reflection respects enemy Holy resistance/weakness and Block, without attack bonuses, critical strikes, Forge spending, or a second pacing multiplier. Holy damage rewards still apply, but neither reflected damage nor secondary enemy reactions trigger another retaliation.
- **Gold rewards** — Seed Money rolls on positive resolved Nature damage, including Thunderstone, and pays from actual Health damage. Golden Wish rolls per Wish. Coinmail rolls on positive Armor gains and pays from actual Armor gained; victory payouts do not trigger it. Fetch adds its reward when a Companion is present at victory, including Wildwood. Exact chances and fixed payouts belong to the [Talent catalog](../src/lib/game-data/talents/talent-rows.ts).
- **Lucky Clover** — rolls on positive Nature Health loss and grants Gold equal to that loss, including Thorns retaliation, Thunderstone, and triggered Nature hits. Overkill and fully prevented damage grant no Gold; lethal hits retain their reward. Physical damage from Stun or Freeze Gear cannot grant its Gold.

### Card costs and payment

- **Card base costs** — every playable catalog card costs 1 Mana. Effects may make a card free; valid saved cost overrides remain supported. Richer cards trade output, timing, conditions, or Consume rather than a higher base cost.
- **Card payment** — `card-cost-rules.ts` calculates cost, affordability, Block payment, and all cost-only allowance changes (including Unique Gear) once against the original state. `card-play.ts` applies that payment result; Unique damage preparation must not independently consume cost-only allowances. Combined damage/free-card opportunities such as Wildheart remain damage-owned. A successful play consumes those flags, prepares unique effects, then pays resources before resolving effects. Preview checks are pure and never cache payment for a later play. Saved zero-cost cards do not spend first-card-free perks, the Labyrinth Quickdraw discount, The Knight’s Answer, or an armed cost reduction; an armed reduction survives when a first-card-free perk pays the cost.

### Strategic card conditions

Wildcard's six-pick starter draft in Campaign and Labyrinth offers a reusable
attack, a different reusable defensive or healing card, and one flexible card
on every pick. Offers exclude already drafted cards. Wildwood retains its
separate draft rules.

Card effects, costs, starting decks and repertoire IDs live in the
[card catalog](../src/lib/game-data/cards.ts) and
[character catalog](../src/lib/game-data/characters.ts). The following execution
rules supplement those definitions:

- Feint prepares one Dodge charge; repeated plays do not stack charges. It uses
  ordinary discard, draw and repeat rules. Damage over time and undodgeable
  reactions remain unaffected.
- Shield Bash grants Block before calculating its live-Block damage. Mana payment
  and retaliation settle first; rejected plays spend nothing. Existing Block is
  not spent by the hit.
- Random damage pools select the type before the hit for heroes, Companions and
  enemies. Forge, mitigation, buildup and reactions use that type. Recorded repeat
  packets retain their resolved amount/type; replaying effects draws a fresh type.
  Neither path can spend a card's Block payment again.
- Conditional Frozen damage preserves Freeze and normal Archery classification;
  existing free-card preparations retain their ordinary consumption rules.

Healing feedback shows the effective pre-cap amount, including overflow, after
all applicable modifiers and rounding. Actual restoration and overflow remain
separate for healing rewards and conversions; Clean Slate uses that same modified
healing calculation. Full-Health healing never fabricates actual restoration.

- **Delayed cards** — Prayer costs 1 Mana and Consumes after Wish and healing. Stargaze deals 1 Freeze damage and resolves Wish 1 immediately; Bread restores Health immediately and does not queue a future pulse. Other delayed effects retain their source card ID, Consume property, and tags so card-specific, Consume, and Archery bonuses still apply. They remain battle-local, survive save/resume, and do not execute after battle completion.
- **Delayed healing** — scheduled card healing retains card-healing reactions such as Clean Slate. Check that the battle remains active before each queued pulse and subsequent Gear regeneration, including after turn-start Trinket damage. Plague Doctor’s Mask damage preserves bonuses reserved for the next attack; its legitimate kill rewards still resolve. Its cleanse rewards require removing the last Poison stack. Hero Thorns retaliation also preserves next-card bonuses. Thorns damage rewards use Health lost to their own packet; Second Wind healing cannot cancel them.
- **Armor and Forge cards** — Stab deals 3 Physical damage while bypassing Armor reduction and preserving Block; it still respects Dodge and causes ordinary Armor decay on damage. Sunder follows the [Forge reward rule](#armor-forge-and-gold). Caustic Jab removes fixed Armor before its Poison hit. Acid Potion halves current enemy Armor before its Poison hit. Burning Blade deals base 1 Burn damage plus rounded half live Forge, without generating Forge or applying another Forge conversion. Player and enemy Forge survive the hit; see [enemy resolution](#repertoire-and-resolution).
- **Roll the Dice** — Consumes and draws the result of one fair six-sided die, subject to the ordinary hand limit and reshuffle rules; its fixed die faces do not change through numerical upgrades.

### Labyrinth exceptions

- **Labyrinth battle benefits** — battle-local `encounterBenefits` are captured at battle creation and saved with the battle. First Physical/Holy/Nature attack bonuses and the first Archery discount reset each player turn; automatic plays and Companion actions cannot spend them. Wishful expands only the first Wish each turn, including queued Wishes. Eager Pack gives two immediate Companion actions on summoning. Unbroken preserves player Block; White Heat grants 2 starting Forge; Ironclad prevents normal Armor decay, not explicit removal. Eternal Flame preserves Burn ticks but does not prevent detonation; Venomous halves the Poison decay rate with the normal minimum of one, including remaining-damage detonations. Buildup bonuses respect Stun/Freeze immunity and enemy resistance. Blood Feast doubles player Leech across direct hits, status ticks, and Companion effects, never enemy healing. Restorative heals at player turn end before the enemy acts. Starting Phoenix Feather is battle-local; Dodge still uses its normal cap.
- **Labyrinth enemy rules** — Entrenched, Unbreakable, and Whitehot preserve only their corresponding enemy resource. Second Wind triggers once on a surviving downward half-Health crossing, including DoTs, detonations, crowd-control gear damage, and Profane Blood; it cannot revive an enemy. When Second Wind and Divine Aegis share a crossing, both use Health before either reaction; Second Wind healing cannot cancel Divine Aegis. Crowd-control gear and Thunderstone damage also trigger Divine Aegis on its half-Health crossing; Thunderstone respects Second Wind even when Stun comes from multiplying buildup. Thornhide/Briar Crown replenish their minimum Thorns at enemy turn start and retaliate with Nature damage on an undodged attack while the enemy survives; original saved Thorns traits retain their original reaction. Thick Hide reuses the existing enemy Physical resistance. Ravenous grants Leech to attack packets and queues Bleed healing from those attacks; blocked and Dodged damage cannot fund it.

### Engine invariants

Simulation-only instrumentation and measurement semantics live in [Balance simulation](./SIMULATION.md#balance-simulation).

#### State, turns, and randomness

- **State and arithmetic** — treat `BattleState` as immutable. Combat magnitudes use nearest-integer `Math.round()`, never `Math.floor()`; the battle-engine lint boundary enforces this convention.
- **Turn presentation** — [committed playback](./RUN_STATE.md#committed-battle-playback) owns publication before animation. Companion turn-start effects resolve after the enemy and next-hand rules, before the next player action. Autoplay and automatic End Turn are separate preferences: autoplay ends when no safe card remains, while manual automatic End Turn leaves playable lethal cards for the player. Live defensive selection includes the active Companion’s immediate healing and Block from commanded actions. Immediate battle estimates exclude scheduled future pulses; stateless drafting estimates retain their total authored value.
- **Battle RNG** — live combat draws the persisted `world` run stream through `BattleResolutionContext` (see [run randomness](./RUN_STATE.md#run-randomness) for command wiring). Engine consumers use `getBattleRng(state)`, never direct `state.rng` access or `Math.random()`; RNG setup helpers own the execution-only callback seam; committed and saved `BattleSnapshot` values never contain it. Tests use `createRunStreamRng`; the balance simulator uses `createRunStateRng` over a local `RunRngState` (both use the same mixer as `stepRunRng`). Simulator card and Wish decisions use a separate seed-derived policy RNG and never advance combat counters. `createBattleState` may pass explicit RNG in unit tests. All dice draw from `@/lib/rng` and stay in `[0, 1)`; out-of-range draws and empty ranges throw instead of biasing. Chance helpers share one probability core (`rollChance`; `rollPercent` is the 0–100 wrapper). Small math lives in `@/lib/math` (`clamp`, `clamp01`, `lerp`).

#### Action admission

`resolveBattleAction` validates phase, defeat, pending Wishes, offered choice,
payment and optional turn budget before execution. Rejection preserves snapshot
identity and consumes no RNG; live XP, discovery and resource settlement follow
acceptance. Card previews reuse its validation. Pending Wishes can settle after
enemy defeat or while controlled; explicit Card options allow victory-grace plays.
Neither permits another enemy turn. Convenience resolvers delegate to this boundary
and return data-only results; low-level mechanics remain internal to the engine.

#### Card classification

- **Card classification** — `src/lib/battle/card-classification.ts` owns attack, damage-type, and keyword queries. Damage classification includes direct damage, random damage, and cleanse-to-damage, including every type in a damage pool, both chance branches, and scheduled effects. Random damage without an explicit pool includes all damage types, matching its runtime rolls. Keyword queries use the same effect-derived keywords and tags shown on cards; tags alone do not make a card an attack. Effect execution, replay selection, and target selection retain their own semantics.

#### Hit resolution and pacing

Classification queries use [Card classification](#card-classification).

- **Damage outcomes** — enemy hit results distinguish attempted damage before defenses, resolved damage after defenses, actual Health loss after death prevention, Dodge, contact, and defeat. Contact is independent of defensive absorption. Player Health-hit results capture resolved damage, actual Health loss, and defeat before threshold healing or secondary reactions; DoT and Companion damage rewards use that captured Health loss. These results are execution-only and do not change saves.
- **Status ownership** — `addPlayerStatus` delegates assignment to `setPlayerStatus`, so both absolute updates and deltas cap pending enemy Bleed Leech when changing Bleed. Explicit Armor loss uses `removePlayerArmor` so Reactive Guard cannot be skipped. Player Forge grants resolve authored amounts and independent +1 talent bonuses once, then Smithguard and Everkeen reactions; bonus Forge cannot recursively activate gain bonuses. Initialization and hydration retain raw state construction.
- **Damage module ownership** — `player-damage-base.ts` constructs player damage packets from base amounts, Forge, and flat typed bonuses. `player-damage-multipliers.ts` owns additive multipliers and first-Burn bonus flags. `damage-calc.ts` orders those stages, then applies pacing, critical strikes, mitigation, and final resolution. `player-defensive-reactions.ts` owns Block/Health-triggered defensive rewards; `enemy-attack-damage.ts` retains incoming-hit orchestration and reaction ordering.
- **Armor gain limits** — Layered adds its flat Armor bonus only to the first positive Armor grant each player turn, including opening grants and reactions. Ironroot grants Armor only for the first Nature card played each player turn, including automatic plays. Each limit has its own persisted combat flag and resets at the next player turn; save/resume cannot refresh either allowance.
- **Leech bonuses** — [Healing and Leech](#healing-and-leech) owns Deep Siphon’s payout order and card attribution.
- **Meteor** — its Mana-loss effect is additional to its card cost; it neither removes a Mana Crystal nor triggers Mana Flare. Its effects and magnitudes belong to the [card catalog](../src/lib/game-data/cards/library/core.ts).
- **Resource scaling** — Talent bonuses from Forge, Armor, and Block, including below-half-Health Armor gains, use percentage fields in the talent manifest. Retired boolean overrides are absent from defaults and ignored during load. Homestead and Gear retain their distinct permissions and never add the same Forge contribution twice.
- **Homestead** — Wheat Field restores purchased-tier Health after each combat, stacking with post-combat recovery and clamping to maximum Health in every mode. Orchard adds purchased-tier starting Thorns alongside gear/encounter grants; resume never repeats starting grants. Crystal Garden scales Freeze damage from current Mana, stacking with talents at normal damage-resolution timing; its tier magnitudes belong to the [Homestead catalog](../src/lib/homestead/data.ts). Homestead resource bonuses increase eligible reward quantities by 10 percentage points per node tier; they never grant per-room or run-end resources.
- **Typed hit resolution** — `typed-hit-resolution.ts` owns the shared Health → Armor decay → buildup → combat text → threshold → kill-payout order for player follow-up and talent hits. Card attack riders retain their distinct ordering, including recursive Archery hits and persistent Forge. `follow-up-hit-resolution.ts` declares recurring damage-conversion reactions in ordered data; changing that order changes RNG consumption. Talent manifest types derive from their current defaults; retired fields follow the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).
- **Common damage modifiers** — `damage-modifiers.ts` owns the typed mapping from damage types to Talent and Gear flat bonuses, flat reductions, half-damage traits, and Gear resistances. Preserve their existing application stages and rounding; special conversion and reaction handlers keep their explicit order. Source manifests follow the current Talent and Gear contracts and the save baseline.
- **Fight pacing** — hidden combat scaler for damage, Block, Mana and healing; player Forge, Armor and Gold bypass it. Attack and triggered damage also receive a capped quadratic ramp, configured by enemy type and side in [FIGHT_PACING](../src/lib/game-constants/combat-rules.ts) and applied by [fight-pacing.ts](../src/lib/battle/fight-pacing.ts). The boss ramp is symmetric. This ramp is separate from the resource clock and does not affect healing or defensive/resource grants; derived hits and status ticks retain inherited pacing without applying it twice. [Pacing tests](../tests/lib/battle/fight-pacing.test.ts) protect these permissions. In the balance simulation, `ALCHEMY_BALANCE_PACING=off` disables both pacing components while retaining enemy progression scaling.

### Non-card reaction eligibility

- **Card and enemy hit stages** — `hit-resolution.ts` captures pre-purge conditions and resolves status reactions, Leech/Frozen reactions, Archery reactions, typed rewards, then feedback/thresholds/payout. `enemy-attack-damage.ts` captures Health loss and Block spending before defensive reactions, then resolves crowd control, Leech, retaliation, and trait follow-ups. Captured hit outcomes never include later healing. These paths deliberately retain distinct ordering; RNG draws and combat-text order are behavior.

Resolution remains explicit and depth-first. Card and enemy hit handlers capture
pre-hit facts separately from the changing battle snapshot. Triggered damage
finishes before the outer hit pays its rewards. Do not replace this order with
a queued reaction pipeline.

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

`stun-leech-resolution.ts` owns Leech rewards; `damage-status-riders.ts` and
`elemental-hit-reactions.ts` own Poison, Nature, and Holy hit riders. Shared
Gold/Mana and crowd-control grants live in `bonus-effects.ts`. `battle-sequence.ts` owns ordered step
execution and defeat cutoffs for card sequences, enemy abilities, status ticks,
and Wish rewards. An explicit reaction boundary selects settlement after each
step or in the enclosing hit. Card Wishes settle between Wishes; triggered Holy
Wishes settle with their enclosing hit. `wish-rewards.ts` retains Wish eligibility
and reward ordering, and `companion-effects.ts` retains Companion action scope,
Bond scaling, captured damage facts, and fatal cutoffs.

Battle inspection replays production resolution with isolated inputs. Its
[execution and uncertainty contract](../src/lib/game-data/effects/BATTLE_HANDLERS.md#battle-inspection-ownership)
owns observation boundaries and projection limits; [battle inspection UI](./UI_BATTLE.md#damage-values-in-battle-inspection)
owns displayed values. Projections are transient: never execute or save them.

Pending Cinder Skin and Emberwake settlement remains in `enemy-attack-damage.ts`,
using the existing damage path. Hit-specific preconditions and depth-first ordering
remain unchanged.

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
reactions. `damage.ts` spends the action-local Coordinated Strike bonus on the
Companion's first attempted damage packet, including a Dodge; utility actions
retain it. Next-hit flags commit only after the packet passes Dodge. This
ordering is separate from the detailed
hit-stage ordering above and must not reorder RNG or feedback.

---

## Shops

`runShopTransaction` guards validation, payment, acquisition and visit writes.
Commands bind a session and take a shelf slot key (instance ID for equipment),
then derive item, price and Talent/Homestead effects from the live transaction.
Quotes read current progression; callers supply no cached manifests, allowance or
price override. SFX runs only after confirmed success. Kind `merchant` means Card Shop.

Slot identity helpers stay independent of command/audio modules.
Preserve the per-visit `firstPurchaseUsed` reset. Compose `mutateGearWithRunHealthSync` with
the open transaction; the dispatching Gear wrapper is for the outer boundary.
[Armory write paths](./ARMORY.md#write-paths) owns that composition.

Refreshes use `createShopRefreshAction` and a `shop-state-init.ts` sampler:

- Activity selects pricing and write target. Before RNG, validate remaining
  refreshes and affordability at the displayed price.
- Restock rolls only for affordable positive-price refreshes with its free refresh
  unused. A success waives payment but still spends a refresh slot.
- The sampler applies offering modifiers, including potency, before returning a
  typed shelf that preserves service/purchase flags. Only success clears purchased
  slots and consumes a refresh; rejection never samples.
- Avoid current offers when alternatives permit. Equipment compares bases across
  rarities and preserves room themes. Nearly exhausted pools still fill the shelf
  while maximizing novel offers.

## Corruption altars

- Pick one card that has neither Corruption nor Transmutation, commit, and reveal the result. The existing intro, picker, and before/after result remain the entire interaction. Leaving before corruption restores the same destination choice; a completed result is saved and cannot be rerolled. A card can be corrupted once; a transformed result is already corrupted and cannot be corrupted again. Mana costs never mutate.
- Transformation has a 10% chance when another eligible library card exists. It replaces the selected card with a different card and one eligible mutation, preserving its deck-slot UID. Mixed Potions are not transformation destinations. Cards without numeric targets can receive a secondary effect; transformation is forced only if no local mutation exists.
- Other outcomes use `CORRUPTION_OUTCOME_WEIGHTS` from [Corruption tuning](../src/lib/game-constants/corruption.ts), renormalized after filtering for eligible families. Select the family first and then an equally likely compatible variant so large variant pools cannot crowd out other outcomes.
- Strengthening adds 50% (nearest integer, minimum one) to plain Physical/Holy/Nature damage, healing, or flat Block; weakening removes 25% with the same rounding. Other editable magnitudes change by one. Lower Health/Mana losses count as improvements. Numbers cannot go below zero or violate the effect schema’s stricter minimum, random-damage bounds cannot cross, and unchanged results are excluded. Repeated copies of an edited effect stay aligned with its description. Companion summon summaries are not numeric card-effect targets; upgrades such as Powerful Wish edit any added effect's own description.
- Secondary additions grant 2 Block, restore 2 Health, or deal 1 Poison/Burn damage, skipping already-present matching effects. Armor, Forge, or Thorns effects do not exclude an added Block effect. Add at most one effect-description line and only while fewer than four such lines exist; trailing keywords remain at the end. New numbers carry the same saved magnitude marks as numerical mutations.
- Simple single-effect damage, healing, and flat-Block cards may double their magnitude for a 2 Health loss paid first, gain Draw 1 or Restore 1 Mana, or triple their magnitude and gain Consume. Existing resource generators, conditional/scaling attacks, and recursive effects cannot receive these bargains or jackpots. Unleeched simple damage cards may gain Leech. These changes never add a second corruption to the same card.
- Damage conversion is limited to simple damage descriptions and preserves identity and non-damage keywords. Scale its amount by the destination/source type baselines: Physical 6, Holy/Nature 4, Bleed/Freeze/Stun 3, Burn/Poison 2; round to nearest integer, minimum one. This avoids converting a large Physical hit into the same number of Poison or Burn stacks. Converted damage is highlighted even when the new type retains the same numeric amount.
- Consume removal requires one self-contained effect: healing up to 8, flat Block/Armor/Thorns up to 2, or simple damage no larger than its type baseline. Haste, Wishes, Mana generation, Companions, recursive effects, and conditional/scaling effects are excluded. Save an explicit `consume: false` override and remove the Consume line. Existing saved corruption results retain their shape; `delta` remains the numeric direction for numerical changes and is `1` for other outcomes.
- Labyrinth Corruption chambers play by the same altar rules at the same support-room rate. Leaving before corrupting returns to the maze with the chamber still open; walking past it skips it the same way. Each chamber rolls one green bonus: Steady Sigil, Pure Altar, Echoing Altar, Blood Rite, or Twin Offering (one visit, two gifts, still corrupted once). Blood Rite increases Leech gifts and favors Bleed within the conversion outcomes; other damage types remain possible.

Numeric corruption also updates matching delayed repeats of the changed effect, so the later turn agrees with the card description. A shared damage number, such as Serrated Edge's Physical-or-Bleed amount, updates both alternatives without consuming the numeric target for a separately described effect. Wishing Well's visible Gold number maps to its Gold branch while its unnumbered Wish remains fixed; Powerful Wish uses the same numeric mapping. Unrelated repeated effects retain their values.

## Content systems

### Saved runs and shared progression

Players keep one unfinished run. The main menu offers Continue when it exists,
otherwise Play opens the existing mode/hero setup. Continue restores the exact
activity, including pending battle results, rewards, events, shops, and drafts.
Menu and meta visits preserve that location. The existing red End Run menu action
ends the run immediately without confirmation and always shows Journey’s End.
Continue reveals newly unlocked heroes before Main Menu; when no hero was
unlocked, Main Menu returns directly (see [run recap UI](./UI_BROWSING.md#run-journey-recap)). Earned progression is kept and
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

The first claimed Campaign Act I boss reward tops up the resulting stockpile to
at least 4 Wood and 4 Stone when no Homestead upgrade or Companion Bond has
been purchased. Ordinary reward Materials count first. This one-time grant and
its receipt settle together; purchases also resolve eligibility, and Homestead
reset cannot renew it. The reward row previews the actual payout.
Campaign boss rewards mark the current act cleared. Boss destination labels
include the current act; ordinary destination headers say Choose Destination.
Final victory and demo completion keep their existing endings.

Wildwood boss victories use the same boss Gold and shared Material payout rules as
Campaign and Labyrinth while retaining Wildwood's reward choices and next-boss
flow. The existing Victory screen shows both currencies, and run-end summaries
include collected Materials and crafting currencies.

### Mystery visits

Mystery Boon choices prefer distinct unowned Boons across alternatives, but an unchosen alternative cannot exhaust the pool: reuse an available Boon across mutually exclusive choices before falling back to Astral Gear. Multiple grants within one choice remain distinct.

Before Astral Gear becomes eligible, Mystery selection excludes an entire event if any choice would need an Astral fallback: an owned or repeated named Boon, an authored Astral grant, or too few unowned Boons for its named and random grants. Random grants reserve the named Boons in their own choice, even when those named effects appear later. Already offered and saved visits keep their resolved rewards; this gate applies only when selecting a new event.

The committed `mysteryChosenChoice` records Material amounts actually awarded, including Homestead find bonuses, for the reward summary and save/resume. Keep the offered event's base amounts unchanged and apply bonuses only at the grant. `applyMysteryEffect` returns the actual Material award in `MysteryEffectResult`; navigation records that result without reconstructing it from inventory differences.

Save the complete resolved Mystery offer after Boon substitution and Labyrinth modifiers. Resume uses that offer directly, so an event-pool edit cannot change a choice the player already saw. The chosen choice remains a separate record of rewards actually granted.

Mystery choice commands accept only a choice object from the current resolved visit. Retained callbacks from an earlier visit, even one with the same event, cannot apply effects to the new visit. Resolve effects from the stored offer so the displayed choice and awarded outcome stay together. Choice and card-pick callbacks return whether the command was accepted; rejected actions keep the screen open, show a concise error, and suppress success feedback.

`removeCard` removes a random deck card immediately with no picker. The old player-choice removal picker and `mysteryPendingRemoval` are retired.

Live pool events are authored in `src/lib/mystery/pool.ts`; other `MysteryEffect` kinds stay on the union and handlers for authoring even when no live event uses them.

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
for exploration; activating the completed boss descends without backtracking
under the [map interaction contract](./UI_LABYRINTH.md#labyrinth-map).
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
additional Block before each landed ability attack resolves damage. Unbinding Strike
Purges one random beneficial player status after each landed ability attack.
Bonus hits and periodic pulses trigger neither modifier. Self-Sacrifice also
requires a landed hit, including fully Blocked hits; Dodged hits cost no Health.
Soul Harvest's Purge outcome preserves any Leech authored on the ability. Ravenous
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
resolution. Resume restores the saved resolved offer without rerolling choices or
reapplying rewards.
Corruption chambers reuse the Campaign altar rules and their green modifier
changes the corruption roll. Leaving before corrupting returns to the maze with
the chamber still reachable.

## Brewing and Transmutation

[Visit interaction](./UI_BROWSING.md#campfire-and-transmutation) owns layout,
selection, feedback and completion presentation.

Campfires offer Rest or Brew, including at full Health (where recovery is zero). When the deck contains
at least two eligible Potions, Brew combines two chosen instances; otherwise, it
grants one of three fixed standard Potion offers (at least one recovery/defense
option). The deck determines which brewing action is available. Rest and Brew
share one use per visit, with no resource cost for Brew. Potions remain in the run
deck after Consume. Rest-only room bonuses apply only to Rest.

The Alchemist shop sells ordinary Potions separately from its Potion Brewing menu.
Brew, Mix, and Distill each have one independent use per visit, each costing 40 Gold
before mixing discounts. Brew grants one of three fixed standard Potion offers
(including a recovery/defense option); Mix combines two chosen deck instances;
Distill strengthens one chosen instance. Only final confirmation charges Gold and
uses that service.
All seven standard Potions can be distilled. Mixed and previously strengthened
Potions remain eligible for brewing at later visits; refreshing or reloading does
not restore any of the current visit's spent services or reroll Brew offers.

Potion mixing scales amounts in every chance branch, preserving probabilities and
all alternative descriptions. Same-ID ingredients double only with matching effects;
different-potency copies retain both effect lists so ingredient order cannot change
potency.

Distill adds 1 to supported beneficial numerical magnitudes, including Wishes;
cost, Consume, probabilities, draw counts, durations, and percentage effects stay
unchanged. Panacea restores 2 Health alongside its full cleanse; each distillation
adds 1 Health. A full-cleanse Potion without healing gains Restore 1 Health when
distilled. The Distillation talent's combat potency bonus is separate from the
Distill service.

Transmutation offers one free alteration to an eligible card. Each visit rolls up to three class-independent keywords for each eligible card: one Damage, one Buffs/Restoration, and one Resources/Additions when that card supports all three groups. Health and Leech belong to Buffs/Restoration. An unavailable group is filled from the remaining useful keywords without duplicates; a card with fewer than three compatible keywords shows fewer choices. Other cards cannot crowd out its useful choices, so the saved visit can contain more than three distinct keywords across the deck. Offers and randomly selected source keywords are fixed for each card throughout the visit, including Back and reload.

Each new Labyrinth Transmutation node has one room modifier. Prismatic Crucible offers every compatible keyword for each card. A keyword Crucible guarantees its keyword within the normal three choices for each compatible card, preserving the other supported groups. Keyword Crucibles are eligible only when the deck can use that alteration as the floor is generated; later deck changes do not reroll the room or bypass card eligibility. All Crucibles retain one free alteration per visit and fixed saved previews. Campaign Transmutation keeps its normal offers.

Damage converts to another damage type; Block, Armor, Forge, and Thorns convert among themselves; positive Health restoration, Mana restoration, and Gold gains convert among themselves. Every occurrence of the randomly chosen compatible source keyword changes, including nested branches and repeats. Existing magnitudes, costs, probabilities, durations, and targeting remain unchanged. Conversions with unsupported conditions or scaling are excluded. Other keywords add their native mechanic: Wish 1, Leech on damage, Archery on attacks, Consume, Dodge the next attack, or one Companion action when the deck contains a summon. Added effect lines respect Corruption's four-effect-line limit. Existing destination keywords are excluded.

Transmute commits the exact saved preview once. Cards keep their identity and artwork, gain the keyword's title prefix, and can be altered only once. Transmutation and Corruption are mutually exclusive. Strengthened standard Potions remain eligible; Mixed Potions are excluded.

## Universal reactions

Shatter, Frostfire, Thunderclap, Wildfire, Consecration, Bloodboil, and Venomflash
reward earned preparation. Direct
card hits (including eligible automatic plays) and Companion attacks can release
payoffs. Secondary Gear/talent hits, retaliation, delayed pulses, secondary
repeats, and extra status ticks cannot initiate attack reactions, but successful crowd control from
any source can prepare a payoff. Reaction damage never removes Burn, shortens
crowd control, or spends another reaction's opportunity.

Successful enemy Freeze prepares independent Shatter and Frostfire bonuses;
successful Stun prepares Thunderclap. Each bonus is 50% of the actual Health
damage dealt by the packet causing that CC, rounded once, with a minimum of 2.
Non-damaging CC prepares the minimum of 2. The amount is fixed when CC begins, so a
small finishing hit or Companion receives the full reward. Each opportunity
expires when its CC ends. Haste, duration extensions, additional buildup, and
player-turn resets cannot replenish it; only a fresh successful CC can.

- **Shatter:** a positive Physical attack against a Frozen enemy destroys all
  Block and Armor before mitigation, then releases its stored Physical bonus.
  Dodge and zero-power attacks preserve readiness. Shatter does not guarantee a
  Critical; the underlying attack uses its ordinary Critical rules.
- **Frostfire:** an eligible Freeze hit that successfully Freezes an already
  Burning enemy releases its stored Burn bonus. Alternatively, a Burn hit dealing
  Health damage to an already Frozen enemy releases it. These routes share one
  opportunity per Freeze. Bonus damage adds no Burn stacks.
- **Thunderclap:** Nature damage against an enemy already Stunned before that hit
  releases its stored Nature bonus, once per Stun. The finishing hit must deal
  positive Health damage.
- **Wildfire:** two positive natural enemy-turn Burn ticks prepare bonus Burn
  damage equal to 50% of their combined actual Health damage, rounded once, minimum 2. Ticks
  of 8 and 4 prepare 6; ticks of 4 and 2 prepare 3. Only normal enemy-turn ticks
  count, including CC-skipped enemy turns; Haste, extra ticks, direct hits, and
  detonations do not. A Nature hit dealing positive Health damage releases all
  completed pairs without consuming Burn. Additional pairs accumulate while
  waiting; unmatched ticks carry forward, including across gaps between fires
  and after Burn reaches zero. Preparation resets between battles.

- **Consecration:** an eligible Holy hit dealing positive Health damage to an
  already Bleeding enemy consecrates its next natural Bleed tick. The tick releases
  Holy damage equal to 50% of its actual Health damage, rounded, minimum 2. More
  Holy hits do not stack marks. Capture and consume the mark when the tick begins;
  clearing or detonating Bleed cancels it. Preserved Bleed can be consecrated again
  for a later tick. Current-format resume preserves the mark without replaying it.
- **Bloodboil:** when Burn and Bleed both deal positive natural tick damage in the
  same enemy phase, release Burn damage equal to 50% of their combined actual
  Health damage, rounded once, minimum 2. A final Burn stack counts even if it
  expires before Bleed resolves. Separate phases, extra ticks, and detonations
  cannot combine. CC-skipped natural phases count. Bloodboil and Consecration
  resolve after the Bleed tick and its riders, Consecration first.
- **Venomflash:** an eligible Burn hit dealing positive Health damage newly ignites
  an already Poisoned enemy: Burn was zero before that packet and the packet adds
  Burn. Release Burn damage equal to 50% of the pre-hit Poison stacks, rounded,
  minimum 2. Existing fires cannot trigger it; extinguishing and igniting again
  can. Ordered effects in one card can establish Poison before ignition. Poison
  and Burn stacks remain intact from the bonus itself. Combustion's fresh
  ignition still qualifies when its own detonation consumes the new Burn.

Bonuses bypass Block and Armor, cannot Critical, and apply no second damage
scaling, status buildup, attack riders, or recursive reactions. Resolve them after
normal attack follow-ups and retaliation, only while both combatants survive.
Thunderclap resolves before Wildfire when both qualify; Venomflash follows other
qualifying attack reactions. Standard health-threshold
handling and once-only kill rewards still apply, including Archery attribution.

Persist reaction progress in battle snapshots; reload cannot refresh spent
opportunities or replay earned damage. Already-earned stored bonuses retain their
amounts across resume. Resolved reactions reuse existing battle audio. Each action
shows one central feedback group: its direct typed damage, then each reaction name
with its separately attributed typed bonus, using the same keyword shine on the
name and bonus number. The group shares one portrait anchor, flight and 1.6-second
lifetime; see [battle feedback](./UI_BATTLE.md#battle-feedback). Repeated packets
with the same reaction origin can total for display; direct damage and different
reactions remain distinct, preserving separate engine packets. Add no readiness UI, explanations,
tutorials, or card-description/keyword previews; see the
[authoring contract](./CONTENT_AUTHORING.md#add-a-new-card).
