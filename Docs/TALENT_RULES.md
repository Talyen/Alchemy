# Talent Rules

Talent progression and talent-specific action/event eligibility live here.
[Game rules](./GAME_RULES.md) own shared hit, resource, healing and card semantics;
the ordered Talent catalog owns exact chances and magnitudes.

## Talent manifests and progression

Each keyword earns talent points independently. The first point costs 10 XP and the second costs another 30 XP. Later point costs remain 60, 80, 100 XP, and so on; point `n` unlocks at `10 × n × (n + 1) − 10 × min(n, 2)` total keyword XP (10, 40, 100, 180, 280, …).

Talent tuning follows repeatability, not merely whether a condition exists. Frequent rewards stay small; once-per-combat opening grants and bounded opening/finishing windows can remain larger. Brittle Ice adds 1 damage to positive player/Companion packets against Frozen enemies, and Corrosive does the same against Poisoned enemies; Exploit Weakness retains double damage. Active Stun/Freeze blocks further crowd control, and recovery starts their shared three-turn immunity. Do not balance around simultaneous Stun and Freeze as an ordinarily reachable state. Health threshold rewards can retrigger after returning across their threshold unless explicitly limited to once per combat.

Current scaling talents use numeric percentage fields. Run restoration rebuilds derived manifests from purchased talent IDs and Homestead effects without replaying opening rewards. Preserve valid current combat flags and progression; retire obsolete manifest fields and incompatible development snapshots under the [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

The [ordered Talent catalog](../src/lib/game-data/talents/talent-rows.ts) owns
proc chances, payout magnitudes and descriptions. This guide owns eligibility,
ordering and interactions; read exact tuning at that catalog. Nature riders use the resolved packet amount and
roll independently. Tempered Guard applies once per positive Block grant,
including triggered rewards and Overflow. Overlapping Homestead, Talent and Gear
conversions use the strongest applicable percentage without adding Forge twice;
Burn/Bleed sharing follows that rule. Below-half conditions are strict. Round
fractional magnitudes normally, including zero results. Forge awards follow
[their gain recipe](./GAME_RULES.md#armor-forge-and-gold).

Homestead Buildings, Farms and Research have four tiers; Companion Bonds have
three. The [Homestead catalog](../src/lib/homestead/data.ts) owns tier magnitudes.
Crystal Garden scales Freeze damage from current Mana. Leyline can waive Mana
payment on an otherwise affordable play. It rolls only on a committed
positive-Mana-cost play, preserves unused cost discounts on success, and never
refunds Mana or previews a random free cost. A waived payment also spends no
Block through Winter’s Credit. Unaffordable attempts cannot roll.
Culinary adds flat healing to existing positive healing, including campfire rest;
Mycology adds flat Leech healing without granting Leech. Alchemy Lab adds flat
Potion damage/healing, without increasing draw counts or Mana restoration.
Blacksmith’s Burn contribution uses the strongest Forge percentage across
Homestead and talents, never their sum. Shop removal
and Potion mixing apply Homestead discounts in both the price and transaction.
Detect Magic can convert eligible Basic equipment outcomes to Astral
after ordinary progression weighting; it preserves total equipment probability,
Unique outcomes, and Astral eligibility. Existing generated items are unchanged.

Homestead battle keys in `HOMESTEAD_BATTLE_*_KEYS` are **added** onto talent values at battle start (`mergeIntoManifest`). Keep identity defaults (`potionPotency: 1`, `healMultiplier: 1`) off those key lists; homestead defaults are zero-based bonuses. Shop, campfire, victory, and collection UI do **not** receive the battle merge — if they need homestead, pass both ports or merge at that consumer. Do not assume `useTalentEffects()` includes homestead.

Incoming `receiveHalf*` resist talents use `scaleReceivedPlayerDamage` in `src/lib/battle/damage-modifiers.ts`. Enemy attacks scale once in `computeMitigatedDamage`; player DoTs scale once in `status-ticks.ts`. Do not also scale in `applyPlayerCombatDamage`.

Run-end keyword cards intentionally show level + XP bar only; the Talents screens own the unspent-point indicator. Dodge earns 1 XP per successful hero Dodge through `awardBattleDodgeXP`, using the battle counter delta in the same command that persists the resolved enemy turn. Ordinary card keyword XP and run-end multipliers still apply. Random damage grants the Physical keyword; a damage-type pool grants every possible type rather than its placeholder type. Never count combat text or award XP again while resuming a pending transition.

## Reset Homestead

Reset Homestead is a session-bound meta intent command. One transaction sums
current catalog costs for purchased Building, Farm, Research, and Companion tiers,
refunds the stockpile, clears those levels to defaults, and recomputes/rebinds live
meta effects. Empty resets reject without a revision or refund. Refunds bypass
find bonuses and run-earned/recap tallies. Discoveries, Gold, RNG, and resolved
combat grants remain intact; existing maximum-Health rebinding clamps Health.

## Talent action rewards

### Wishes and Mana

- **Divine Intervention** — positive Holy damage can proc one Wish for that resolved damage packet. Derived Talent damage cannot recursively roll the same Wish chance; existing Wish choice and queue rules remain unchanged.
- **Wish choices** — Discovery reserves one eligible undiscovered card when available and fills remaining unique choices normally. Generous Wish can make a Wish card play fully twice. Powerful Wish upgrades both the immediate and matching scheduled effects when one description number covers multiple turns. It preserves Health/Mana costs and typed self-damage; shared Deal/Receive magnitudes remain unchanged so an upgrade cannot increase its penalty. Roads Not Taken rolls after a valid selection and randomly grants one declined card from that offer. Chosen and bonus cards wait in the ordered hand queue when the hand is full, including queued Wishes.
- **Mana restoration and rewards** — Wellspring checks Mana when the player ends their turn; enemy-phase gains or spending cannot change eligibility. Mana Moth then grants 1 extra Mana without increasing Mana Crystals. Ordinary restoration preserves existing overflow but cannot add beyond the cap. A Mana Crystal loss at the minimum of one crystal changes neither the cap nor current Mana; an actual crystal loss still clamps current Mana to the new cap. Arcane Mending restores 1 Health per Mana actually gained, including gains while nonzero; restoration at the cap grants no healing. Sanguine Overflow grants 1 Mana when Leech fills Health from below full.
- **Mana from Heaven** — Wish-keyword cards refund the Mana actually paid after their effects and card-action retaliation, if the hero survives. Normal capped restoration and Mana-gain healing apply without pacing the refund. Free and automatic plays refund zero; repeated effects and multiple Wishes do not multiply refunds. Paying with Block does not create a Mana refund. Gear Wish Mana retains its separate per-Wish eligibility rule.

### Card plays and costs

[Card costs and payment](./GAME_RULES.md#card-costs-and-payment) own admission,
resource spending and discount priority; the rules below add talent reactions.

Covering checks the hero's Block and Eagle Eye checks enemy Stun before payment
reactions can change them. Payment retaliation settles before card-play rewards;
a defeated hero cannot open a healing Emergency Wish from Quickfletched.

- **Card play rewards** — Thermal Vent rolls for Forge on each Burn card play, before its effects; successful Forge uses ordinary gain bonuses. Automatically played cards qualify; repeats and scheduled effects do not roll the play reward again. Faith Barrier is a Holy-damage reward, not a card-play reward. Sacred Shield remains a separate 10%-of-Block Holy damage bonus.
- **Automatic card rewards and discounts** — Dance of Blades grants Whistle's Companion action after summoning or buffing, and Mortar and Pestle damage after a Potion. These use the ordinary play reward paths. Mortar and Pestle also triggers for each duplicated Potion use. First-card allowances retain their established priority. After those allowances, Unique free-card effects and flat encounter/returned-card discounts apply before spending armed next-card discounts; a card already reduced to zero preserves Divine Favor and other armed next-card discounts.
- **Play rewards** — Iron Guard rolls on each positive resolved Physical Health-damage packet and grants Armor equal to that damage. Thornskin, Bramblegrowth, and Photosynthesis roll independently on positive Nature damage and grant Armor, Thorns, or Health equal to the resolved packet. Briar Patch and Toxic Pollen roll independently to apply a derived Bleed or Poison hit for a fraction of that packet (see [Typed talent procs](./GAME_RULES.md#triggered-and-copied-damage)), resolved through normal mitigation.
- **Shop and opening grants** — Apothecary Membership discounts standard Potion purchases. Ecosystem's Nature draw precedes the ordinary opening hand.
- **Remaining resources and Block** — Armor Siphon steals only Armor remaining when its reward resolves, including after earlier play rewards deplete Armor. Skirmisher adds 1 generic damage to Archery cards while the player has no Block.
- **Card sequences** — Follow-through counts normal Archery card plays during the player turn and adds 1 damage to every original damage effect on the second Archery card. Repeated effects copy the resolved bonus; Companion actions, scheduled pulses, and damage echoes do not requalify. The next player turn clears the sequence.
- **Repeatable rewards** — Genuine Consume independently rolls Second Helping for a draw, Last Supper for Forge, Combustible for Burn detonation and Leftovers for Gold; Aftertaste restores Health. Last Supper has no hand-size condition. Second Helping uses normal drawing, including Emergency Wish on an eligible empty draw. Summon cards leave battle without Consume and therefore need no reward exceptions. A repeated card still Consumes only once.
- **Repeated resolution** — Overgrowth, Flash Fire, Winter’s Grasp, Venom Strike, Jarring Blow, and Generous Wish contribute to one capped repeat decision for matching card keywords; a success resolves the whole card twice, pays Mana and Consume once, grants play rewards once, and does not roll again for the repeat.
- **Consume cutoff** — Settle retaliation from each Consume reward before later rewards; a defeated hero gains no further rewards.
- **Free Follow-up** — Stun from any source, including Companions and delayed effects, readies the next card discount. It survives turn changes and is spent only when it reduces a card payment.
- **Consume reactions** — resolving a card twice still Consumes one card and grants Insatiable one bonus. Consuming Gear adds its rolled amount to existing Burn damage packets on cards with Consume. Rotgut adds 2 to Poison damage packets on Potions. Neither adds a separate hit or grants damage to a utility card. Both use normal card damage scaling and defenses. Feast doubles the healing effects of Apple and Bread only; their cleansing and other effects remain unchanged.
- **Talent progression** — Row eligibility requires every talent in prior rows. Purchased talents retain their IDs and progress when rows are reordered; see [save baseline](../src/features/alchemy/shared/storage/MIGRATIONS.md#supported-baseline).

### Attack bonuses

- **Cull the Weak** — damage effects of Leech-keyword cards gain an additive 25% damage bonus when enemy Health immediately before that effect is strictly below half maximum. Recheck each hit; use normal scaling, rounding, mitigation, and Leech healing. Companion attacks, unrelated talent hits, and status ticks do not receive this card bonus.
- **Attack bonuses** — Coordinated Strike accumulates for the Companion's next attempted damage packet; utility actions retain it. Equal-to-resource attacks also receive Opening and other Dodge-earned Physical bonuses.
- **Opening / Open Flank** — the armed Physical bonus applies to the next undodged attack of any damage type. Physical attacks include it in their main hit; other damaging attacks add a separate Physical hit through normal modifiers and defenses. Enemy Dodge preserves this bonus, and Companion actions do not spend it.
- **Hit rewards** — First Blood checks for no Bleed before the hit. Finish Him doubles Physical damage against an enemy strictly below 25% Health.
- **Prepared criticals** — Hawk Eye arms a single refreshable Crit readiness after a successful Freeze or Stun; the next positive player attack packet consumes it, while Dodge and fully blocked hits retain it and Companion/derived hits cannot consume it. Riposte arms a Physical-only guaranteed Crit after Dodge and preserves it through non-Physical, Dodged, and fully mitigated attempts.
- **Conditional hit rewards** — Snow Pack adds 1 generic damage to each Companion packet against an already Frozen enemy. Icebreaker rolls for Forge after a positive Physical hit against a Frozen enemy, once per attack action; player Forge is preserved. Desperate Siphon doubles Leech below half Health using the pre-healing Health check. Companion Bond rolls for Mana on each positive Companion damage packet.
- **Trophy Shot** — an Archery attack grants its kill Gold once after its complete damage packet, including secondary hits, Parting Cut, and detonations. Repeated hits cannot pay again for an already defeated enemy.
- **Pyric Gear** — adds its advertised percentage per Mana Crystal to the additive Burn damage multiplier, before rounding, pacing, critical hits, and defenses. It is not a flat fraction of the crystal count. Bloodember Pendant shares this bonus with Bleed.
- **Nature damage gear** — Bloomwoven rolls for each positive Nature damage packet that lands, including Companion attacks; Dodge, fully mitigated hits, and unselected chance branches cannot restore Mana.

## Talent event rules

### Selective feedback rewards

- **Eligibility and feedback** — evaluate resource and Health conditions before the triggering event's reward chain, with matching Talent/Gear amounts added together. An earlier reward cannot disable its matching counterpart or enable a different conditional reward in that event. Do not hide earned combat text; matching target/kind/stat events still merge normally. Each independent proc uses seeded world RNG, only when its source and basic target requirements exist.
- **Dodge payouts** — Feint rolls for Forge and Lucky Foot independently rolls for Gold. Pack Reflexes can activate the Companion; Bladedance can draw and play a random card. Perfect Timing and Wardplate require no Armor, Nimble requires no Block, and Winded requires below half Health. Dodge counterattacks preserve bonuses reserved for the next card. Riposting can proc its Physical hit; Fleeting requires the attacker to be Bleeding before Dodge rewards. Catch Breath, Footwork, and other unrelated Dodge rewards retain their existing behavior.
- **Stun payouts** — Riled Up/Forged, Guarded Counter/Steadfast, and Stun Surge/Arcane require respectively zero Forge, Block, and Mana. Matching Talent and Gear rewards add together against that single eligibility check.
- **Holy and healing payouts** — Blessed Leech requires below half Health and restores standard Leech healing from positive Holy card hits, including Companions. Hits with explicit Leech receive one healing packet, retaining their card Leech bonuses. Fixed/derived Talent hits and reflected Holy damage retain their documented Leech recipe; ordinary Holy follow-ups such as Saintfall do not gain Blessed Leech. Faith Barrier rolls to grant Block equal to enemy Health lost to that Holy hit, including Saintfall and other follow-up hits. Tithe uses the same Health-loss basis for its Gold on eligible Holy hits. Overkill and fully prevented damage grant neither reward; lethal hits retain their rewards. Radiant Guard rolls on each positive Block gain to draw a Holy card using the normal deck/discard draw path. Sun-Struck Shield reflects only attacks that deplete positive Block, using Block lost before defensive rewards refill it. Overflow converts only direct card healing's excess to Block, excluding Leech and incidental healing; Clean Slate retains its separate Leech eligibility.
- **Armor payout** — Coinmail rolls on each positive Armor gain and grants Gold equal to the actual Armor gained.
- **Leech cleansing** — Bloodletting rolls on positive player Leech healing, including attempted healing at full Health, to cleanse one existing harmful status; Health loss does not trigger it.
- **Block break** — Watchdog invokes the active Companion once when an enemy attack depletes positive Block while the hero is below half Health. Capture both conditions immediately after the hit, before defensive rewards refill Block or heal the hero.
- **Wish rewards** — Desperate Wish and Wishborn require below half Health and Wishwoven zero Mana at the start of each Wish; Wishfire requires an enemy already Burning before that Wish’s rewards. Wishful independently rolls for Gold; Wishful Trinket rolls to grant a reward, then uses its existing Forge/Armor selection. Jealous follows the [enemy reaction rule](./GAME_RULES.md#enemy-reactions). Resolve pending retaliation after each Wish’s rewards before beginning the next Wish’s rewards; a defeated hero earns no subsequent rewards. Talent-only Wish rewards retain their other conditions.

### Turn rewards

- **Turn rewards** — Dark Recovery records zero Mana at player turn end and grants its extra Mana at the next player turn, allowing overflow and normal Mana-gain healing. Enemy-phase Mana changes cannot alter that recorded reward. Bloodrush rolls once for each positive Bleed damage event, including player hits, Companion/talent hits, natural ticks, and detonations; a success draws one normal card. Thaw Dividend draws when surviving enemy Freeze naturally expires; immunity and enemy death grant nothing.
- **Bleeding Out** — the below-half-Health bonus applies to Bleed hits, natural ticks, and each projected detonation tick, with normal rounding and unchanged stacks. Bloodember Pendant shares it with Burn ticks as well as Burn hits.

## Potion potency

Distillation increases consumed Potion potency; Brewmaster adds its bonus for consumed Mixed Potions. Both use their [catalog magnitudes](../src/lib/game-data/talents/talent-rows.ts), stack additively and use normal nearest-integer rounding and hand limits. Feast doubles only Apple and Bread healing effects; their other effects are unchanged.
