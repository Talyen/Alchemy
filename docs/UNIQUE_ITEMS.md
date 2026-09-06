# Unique items

Approved collection: one Unique for each of the 29 Gear base items. The eight original signatures remain unchanged; the 21 additions below complete the collection.

## Affix contract

Every Unique has exactly one exclusive fixed signature and three fixed standard affixes at the current standard Unique/Astral maximum. The affix catalog owns roll values; the Unique catalog owns selections. No item-generation RNG chooses or rolls a Unique's affixes.

Generation, inventory normalization, tooltips, and battle manifests use the same canonical affixes. Existing owned items receive the corrected standard rolls without changing identity, protection, ownership, or Collection discovery. A saved battle retains its captured manifest until normal live meta rebinding or a new battle.

Unique signature descriptions may use sentence punctuation for readability; standard affixes retain the existing period-free typography rule. New signatures remain at most 15 words.

## Approved descriptions

| Base item       | Unique               | Signature                                                                                   |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| double-axe      | The Unclosing Wound  | Enemy Bleed halves each turn instead of expiring.                                           |
| maul            | Kingbreaker          | Enemy Armor increases your Stun damage instead of reducing it.                              |
| greatsword      | Everkeen             | Gaining Forge makes your next Physical card strike twice.                                   |
| hatchet         | Red Harvest          | Each turn, return your first Physical card to hand. It costs 1 less Mana.                   |
| longsword       | Oathkeeper           | Forge also strengthens Holy damage. Holy damage never spends Forge.                         |
| shortsword      | The Patient Edge     | Recover Forge spent on attacks at the start of your next turn.                              |
| dagger          | Viper’s Courtesy     | After Dodging, your next Physical hit adds half its damage as Poison and Bleed.             |
| mace            | The Lingering Bell   | Stunning an enemy preserves a quarter of its Stun buildup.                                  |
| longbow         | Huntsmaster’s Call   | Your first Archery card each turn makes all Companions attack again.                        |
| shortbow        | Wrenflight           | Archery grants 10% Dodge until your next turn. Dodging draws an Archery card.               |
| recurve-bow     | The Returning Gale   | Archery cards repeat their damage at half strength next turn.                               |
| wand            | The Final Spark      | Spend your last Mana to repeat a Burn or Freeze card’s damage. Once per turn.               |
| leather-buckler | Laughing Guard       | Keep Block between turns. Dodging spends half your Block to deal that much Physical damage. |
| kite-shield     | The Knight’s Answer  | Blocking an attack makes your next Physical card free.                                      |
| quiver          | The Returning Flight | Each turn, recover your last Archery card. It costs 1 less Mana.                            |
| spellbook       | Threefold Grace      | Your first Burn, Freeze, and Holy card each turn costs no Mana.                             |
| ruby-amulet     | Bloodember Pendant   | Burn and Bleed share their damage bonuses.                                                  |
| sapphire-ring   | Winter’s Credit      | Spend 3 Block per missing Mana to play Freeze cards.                                        |
| emerald-ring    | Serpent’s Eye        | Attacks against Poisoned enemies ignore Armor and cannot be Dodged.                         |
| emerald-amulet  | Wildheart’s Favor    | Dodging makes your next Nature card free and guarantees its damage Critically Hits.         |
| topaz-amulet    | The Golden Crucible  | Gold gained in combat grants equal Forge. Forge also strengthens Holy damage.               |

## Combat semantics

Player-chosen card plays own card costs, first-card allowances, returns, and Unique damage repeats. Companion actions, automatic plays, and delayed effects cannot spend those allowances. Repeating damage does not play a second card, pay another cost, repeat utility effects, or schedule further Unique echoes.

Opportunities last until used or battle end unless the item says otherwise. Costs cannot fall below zero. Hand limits, seeded battle RNG, critical-hit rules, mitigation, and nearest-integer combat rounding remain in force. Battle-local readiness, spent allowances, card references, Forge recovery, and delayed arrows survive saves and pending enemy-turn continuations.

| Unique               | Mechanical rule                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Unclosing Wound  | Enemy Bleed uses the ordinary halving decay, including its final expiration. Blackfletch includes the remaining halved Bleed payments in its execution.                                                                                                              |
| Kingbreaker          | Add enemy Armor to Stun damage before Block absorption instead of subtracting Armor afterward. Other damage types retain their normal mitigation.                                                                                                                    |
| Everkeen             | Any positive Forge grant prepares one repeat of the next player-chosen Physical card's damage effects. Multiple grants do not accumulate repeats. Forge granted during a Unique damage repeat cannot prepare another repeat.                                         |
| Red Harvest          | After the first player-chosen Physical card each turn finishes, return its existing instance from discard to hand with a 1 Mana discount for the rest of that turn. Do not recover Consumed cards or exceed the hand limit.                                          |
| Oathkeeper           | Forge applies to Holy damage and Holy damage does not spend Forge.                                                                                                                                                                                                   |
| The Patient Edge     | Record Forge actually lost through attacks and restore that amount once at the next player turn's start. Do not record Forge removed by other means.                                                                                                                 |
| Viper’s Courtesy     | A hero Dodge prepares one successful Physical card hit to add Poison and Bleed follow-up hits, each based on half that hit's damage. Automatic plays do not spend the opportunity. Normal typed damage bonuses apply to the follow-up hits.                          |
| The Lingering Bell   | A successful Stun retains 25% of the buildup that caused it. Retained buildup does not bypass the normal active-control or cooldown restrictions.                                                                                                                    |
| Huntsmaster’s Call   | The first player-chosen Archery card each turn repeats active Companion damage effects, including ordinary damage-related riders but excluding utility effects. The current battle contract has one active Companion.                                                |
| Wrenflight           | A player-chosen Archery card grants a fixed additional 10% Dodge until the next player turn. Further Archery cards do not increase the bonus. Each hero Dodge draws an available Archery card, respecting the hand limit.                                            |
| The Returning Gale   | Each player-chosen Archery card queues its resolved damage effects for the next player turn. Repeats apply half damage through normal modifiers and defenses, exclude utility effects, and cannot queue more echoes.                                                 |
| The Final Spark      | Once per turn, a player-chosen Burn or Freeze card that spends positive Mana and empties the Mana pool repeats its damage effects. Block may cover a Mana shortfall through Winter’s Credit. Zero-cost cards do not qualify.                                         |
| Laughing Guard       | Block does not halve between turns. Each hero Dodge spends half the Block present before on-Dodge grants and deals that amount as a Physical follow-up hit, using normal damage modifiers.                                                                           |
| The Knight’s Answer  | An enemy attack must absorb positive damage with Block to prepare one free Physical card. The opportunity does not accumulate or increase mitigation. Spending Block on a card does not prepare it.                                                                  |
| The Returning Flight | Before the next turn's draw can reshuffle discard, recover the existing last Archery card played on the prior turn if it remains in discard. Its next play this turn receives a 1 Mana discount. Do not create cards or recover Consumed cards.                      |
| Threefold Grace      | Each player turn offers one free player-chosen card for each of Burn, Freeze, and Holy. A mixed-keyword card uses all matching allowances, even if another effect also makes it free.                                                                                |
| Bloodember Pendant   | Burn and Bleed each receive both types' flat and applicable conditional damage bonuses. Count shared bonuses once. Enemy resistances remain type-specific.                                                                                                           |
| Winter’s Credit      | Pay available Mana first, then 3 Block per missing Mana. Reject the whole play if either the normal cost or the combined payment cannot be covered. Payment does not activate enemy-attack or Block-depletion rewards.                                               |
| Serpent’s Eye        | Check for enemy Poison before each attack packet. Attacks against a Poisoned enemy bypass Armor and enemy Dodge, but retain Block and resistance checks.                                                                                                             |
| Wildheart’s Favor    | Each hero Dodge prepares one free Nature card whose damage hits all critically hit. Further Dodges do not accumulate uses; automatic plays do not spend it.                                                                                                          |
| The Golden Crucible  | Actual positive Gold gained inside battle grants an equal amount of Forge. This conversion does not rescale the amount through fight pacing. Forge also increases Holy damage and follows its normal depletion rule unless Oathkeeper is equipped. No Gold is spent. |

## Existing corrections

Keep original supporting-affix selections. Their standard maxima correct Dance of Blades starting Armor to 4, Rimeheart starting Block to 9, Blackfletch Archery damage to 5, Twin Casting Burn damage per Mana Crystal to 20%, Saintfall Block-depletion healing to 5, and Golden Verdict Gold on kill to 7.

The signature affix owns both instance text and the definition overview. Blackfletch's overview includes its below-30%-Health condition; Wardbreaker explicitly removes one beneficial effect per attack.

## Verification ownership

Catalog tests cover complete base-item coverage, exclusive signatures, four fixed maximum rolls, concise new descriptions, inventory repair, and independent generated instances. Battle tests cover every new signature, costs, damage repeats, delayed effects, resource preservation, Dodge, saves, and interactions. Save normalization defaults missing battle-local fields without a schema version bump.
