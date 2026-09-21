# Glossary

Canonical detail linked from [GAME_RULES.md](./GAME_RULES.md).

## Domain Glossary

Definitions of common terms used in the Alchemy codebase.

### Mode terminology

- **Content System** — `campaign`, `labyrinth`, or `wildwood`; owns map generation and encounter rules. Implementations live under `src/lib/content-systems/`.
  - **Labyrinth** — infinite exploration content system; twenty-room floors in rows of 4 / 6 / 6 / 4 with a safe top-row entrance, a visible bottom-row boss, and discoverable/enterable rooms beside any completed chamber. HP carries between rooms; dying ends the run.

### Shared battle and progression terms

- **Armor** — Each stack normally reduces Physical and Stun damage taken by 1; taking damage removes 1 Armor. See [mitigation exceptions](./GAME_RULES.md#mitigation-and-crowd-control).
- **Forge** — Each stack normally adds 1 Physical and Stun damage; dealing damage spends 1 Forge. Gear and talent exceptions follow [Armor, Forge, and Gold](./TALENT_RULES.md#armor-forge-and-gold).
- **Poison** — DoT status; deals its buildup as damage each tick, then normally loses 20% of its stacks, with a minimum decay of 1.
- **Stun** — Damage type whose buildup can make the target skip turns once its Health-based threshold is met. See [crowd-control immunity](./GAME_RULES.md#mitigation-and-crowd-control).
- **Freeze** — Damage type whose buildup can make the target skip turns once its Health-based threshold is met. Threshold modifiers and [crowd-control immunity](./GAME_RULES.md#mitigation-and-crowd-control) apply.
- **Consume** — Removes the played card for the remainder of the battle; the run Deck retains it.
- **Leech** — Restores half the damage dealt as Health before applicable modifiers. Source-specific limits and reactions follow [Healing and Leech](./TALENT_RULES.md#healing-and-leech).
- **Bleed** — DoT status; deals damage once on hit, then deals the same amount next turn.
- **Block** — Damage absorption on player/enemy; halves at the start of the owner's next turn after one opposing attack window.
- **Burn** — DoT status; deals its stack as damage, then normally decays by half.
- **Dodge** — 5% chance for either side to avoid an opposing attack damage packet before Block and Armor. See [Battle Implementation Rules](./GAME_RULES.md#battle-implementation-rules).
- **Death's Door** — Prevents fatal damage once per battle, leaving the player at 1 HP with 2 grace turns (extendable). Healing does not end the window. While active, lethal hits floor at 1 HP (multi-hit and DoT ticks included). The enemy phase that spends the last grace still floors; damage becomes lethal on a later hit.
- **Fight pacing** — Hidden combat scaler (not a player-facing rule). Live default on; `ALCHEMY_BALANCE_PACING=off` measures raw kit.
- **Homestead** — Between-run hub; spend **Materials** on permanent upgrades.
- **Mana** — Resource to play cards; resets to `maxMana` each turn (unspent lost unless Wellspring).
- **Materials** — Meta currency for homestead upgrades.
- **Screen** — Route union (`menu`, `battle`, `rewards`, …) on `navigation.screen` — not a map node.
- **Companion Bond** — Per-companion Homestead upgrade; improves its turn-start effects above the unbonded baseline. Progression follows [Companion Bond](./GAME_RULES.md#companion-bond).
- **Corruption** — Altar event that mutates or transforms a card once. Leaving before corruption returns to the same destination picker in Campaign or the map in Labyrinth, keeping the destination available. See [Corruption altars](./GAME_RULES.md#corruption-altars).
- **Damage type** — `physical`, `stun`, `holy`, `burn`, `poison`, `bleed`, `freeze`, `nature` — enemies may resist or be vulnerable per type.
- **Potion** — Consumable with temporary effect from the Alchemist shop.
- **Regen / Regeneration** — Enemy trait: heal each turn at end of enemy phase.
- **Reward route** — Internal post-rewards destination (`REWARD_ROUTES`), not a `Screen` — see **Screen** above. Combat and content-system reward kinds are selected by the current reward rules in `src/lib/game-constants/run-rewards.ts`.
- **Run materials earned** — Materials collected during the current run and included in the run-end summary. See [WORKFLOWS § Grant materials](./RUN_WORKFLOWS.md#grant-materials-during-a-run).
- **Status** — Temporary player/enemy effect with tick/expiry (Burn, Freeze, Poison, Stun, …).
- **Summon** — Brings a companion into battle.
- **Gear** — Permanent generated items stored in the Armory and equipped per character. Rarity is basic, astral, or unique. Unique items are named, fixed-affix definitions; uniqueness is inventory-scoped (salvage returns them to the drop pool). Collection discovery of a unique survives salvage. Gear effects are snapshotted when battle begins and refreshed by live meta mutations. See [ARMORY](./ARMORY.md).
- **Trinket** — Permanent unique Armory collectible stored by definition ID and equipped in the dedicated Trinket slot. It has no rarity, affixes, duplicates, crafting, or salvage.
- **Boon** — Run-scoped form of a Trinket definition. It shares the name, art, effect, and Collection discovery, but does not enter the Armory or occupy a slot. A matching equipped Trinket and Boon apply once.
- **Wish** — Offers cards from the eligible offer pool, excluding the source card; the chosen card is added to the hand. Choice bonuses and queued offerings follow [Wishes and Mana](./TALENT_RULES.md#wishes-and-mana).
