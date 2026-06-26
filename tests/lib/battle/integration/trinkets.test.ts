import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";
import {
  applyCardEffects,
  createBattleState,
  defaultTalentEffects,
  endPlayerTurn,
  processCompanionTurnStart,
} from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { type CombatTextEvent } from "@/lib/battle/types";
import { companionLibrary, enemyBestiary } from "@/lib/game-data";
import { computeTrinketManifest } from "@/lib/trinkets";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultEnemyMitigation,
  defaultCombatFlags,
} from "../../../fixtures/default-battle-state";

vi.spyOn(Math, "random").mockReturnValue(0.99);

describe("Boon â€” Brass Censer (first Holy damage doubled)", () => {
  it("doubles the first holy damage", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 base * 2 boon = 10 damage (no crit due to mock returning 0.99 > 5%)
    expect(result.state.enemyHealth).toBe(20);
    expect(result.state.flags.firstHolyDamageBonusUsed).toBe(true);
  });

  it("does NOT double the second holy attack", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const card2 = makeCard({ id: "holy2", effects: [{ kind: "damage", damageType: "holy", amount: 5 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest, hand: [card] });
    const first = playBattleCardResolved(state, card.id, 0);
    const second = playBattleCardResolved({ ...first.state, hand: [card2] }, card2.id, 0);
    // First: 10 damage. Second: 5 damage. Total: 15 damage = 15 remaining
    expect(second.state.enemyHealth).toBe(15);
  });
});

describe("Boon â€” Tattered Pages (extra draw at battle start)", () => {
  it("deals 5 cards in opening hand instead of 4", () => {
    const deck = [makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard(), makeCard()];
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    const state = createBattleState({
      runDeck: deck,
      currentEnemy: skeleton,
      playerHealth: 30,
      talentEffects: defaultTalentEffects,
      maxHealth: 30,
      trinketIds: ["tattered-pages"],
    });
    expect(state.hand).toHaveLength(5);
  });
});

describe("Boon â€” Sundering Charm (ignore 2 enemy armor)", () => {
  it("physical attack ignores 2 enemy armor", () => {
    const manifest = computeTrinketManifest(["sundering-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0, block: 0 }),
      trinketEffects: manifest,
      hand: [card],
    });
    const result = playBattleCardResolved(state, card.id, 0);
    // 5 armor - 2 piercing = 3 effective armor. 10 - 3 = 7 damage
    expect(result.state.enemyHealth).toBe(23);
  });
});

describe("Boon â€” Runic Quill (draw 1 on consume)", () => {
  it("draws a card when consuming a card", () => {
    const manifest = computeTrinketManifest(["runic-quill"]);
    const card = makeCard({
      id: "consumable",
      consume: true,
      effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const deckCard = makeCard({ id: "deck-card" });
    const state = makeState({ mana: 10, hand: [card], deck: [deckCard], trinketEffects: manifest });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.exhausted).toHaveLength(1);
    expect(result.state.hand).toHaveLength(1); // drew deck-card
    expect(result.state.hand[0].id).toBe("deck-card");
  });
});

describe("Boon â€” Mortar and Pestle (first potion free)", () => {
  it("makes the first potion cost 0", () => {
    const manifest = computeTrinketManifest(["mortar-and-pestle"]);
    const card = makeCard({ id: "health-potion", cost: 2, effects: [] });
    const state = makeState({ mana: 2, hand: [card], trinketEffects: manifest });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(2); // no mana spent
    expect(result.state.flags.firstPotionFreeUsed).toBe(true);
  });

  it("second potion costs normal mana", () => {
    const manifest = computeTrinketManifest(["mortar-and-pestle"]);
    const card = makeCard({ id: "health-potion", cost: 2, effects: [] });
    const state = makeState({
      mana: 10,
      hand: [card],
      trinketEffects: manifest,
      flags: defaultCombatFlags({
        firstPhysicalCardFreeUsed: false,
        firstHolyCardFreeUsed: false,
        firstBurnCardDoubledUsed: false,
        firstArmorCardDoubledUsed: false,
        firstPoisonCardFreeUsed: false,
        firstBleedCardFreeUsed: false,
        nextCardCostReduction: 0,
        goldOnFirstPoisonThisCombat: false,
        firstHolyDamageBonusUsed: false,
        firstBurnTrinketDoubledUsed: false,
        firstHarmfulStatusPrevented: false,
        firstPotionFreeUsed: true,
        resonantChimeUsedThisTurn: false,
      }),
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(8); // spent 2 mana
  });
});

describe("Boon â€” Parasitic Bloom (10% chance to leech poison damage)", () => {
  it("heals for poison damage when the 10% leech procs", () => {
    vi.mocked(Math.random).mockReturnValueOnce(0.05); // 5% < 10% = proc
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 }),
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    // poison damage = 3, leech heals for half (2)
    expect(result.state.playerHealth).toBe(22);
  });

  it("does not heal when the 10% leech fails", () => {
    vi.mocked(Math.random).mockReturnValueOnce(0.15); // 15% > 10% = no proc
    const manifest = computeTrinketManifest(["parasitic-bloom"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 }),
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(20);
  });
});

describe("Boon â€” Ironwood Buckler (6+ block â†’ 1 armor)", () => {
  it("gains armor when block is >= 6 at end of turn", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({
        block: 8,
        armor: 0,
        forge: 0,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.armor).toBe(1);
  });

  it("does NOT gain armor when block is below 6", () => {
    const manifest = computeTrinketManifest(["ironwood-buckler"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({
        block: 5,
        armor: 0,
        forge: 0,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerStatuses.armor).toBe(0);
  });
});

describe("Boon â€” Sin-Eater's Lantern (heal on harmful status removal)", () => {
  it("gains 6 health when removing a harmful status", () => {
    const manifest = computeTrinketManifest(["sin-eaters-lantern"]);
    const card = makeCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const state = makeState({
      mana: 10,
      playerHealth: 20,
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 0,
        haste: 0,
        burn: 2,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      trinketEffects: manifest,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(26);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 6 });
  });
});

describe("Boon â€” Cutpurse Knife (gold on bleed application)", () => {
  it("gains 1 gold when applying bleed", () => {
    const manifest = computeTrinketManifest(["cutpurse-knife"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 3 }] });
    const state = makeState({ mana: 10, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(1);
  });
});

describe("Boon â€” Wishing Well Coin (gold on wish)", () => {
  it("gains 3 extra gold when wishing", () => {
    const manifest = computeTrinketManifest(["wishing-well-coin"]);
    const card = makeCard({ effects: [{ kind: "wish", amount: 1 }] });
    const state = makeState({ mana: 10, gold: 2, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.gold).toBe(5);
  });
});

describe("Boon â€” Bone Charm (heal on enemy defeat)", () => {
  it("heals 3 Health when enemy is killed by an attack", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 40 }] });
    const state = makeState({ mana: 10, playerHealth: 15, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(18);
  });

  it("does not heal when enemy dies from status ticks (not player defeat)", () => {
    const manifest = computeTrinketManifest(["bone-charm"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      playerHealth: 15,
      enemyHealth: 1,
      enemyMaxHealth: 1,
      enemyStatuses: defaultEnemyStatusValues({ burn: 0, poison: 3, bleed: 0, freeze: 0, stun: 0 }),
      enemyAttackEffects: [],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const result = endPlayerTurn(state);
    // enemy dies from poison tick (3 damage), bone charm does NOT trigger
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(15);
  });
});

describe("Boon â€” Companion's Collar (+1 companion damage)", () => {
  it("Wolf companion deals 1 bleed + 1 collar = 2 bleed damage, doubled to 4 by BLEED_STATUS_MULTIPLIER", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["wolf"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(4); // (1 base + 1 collar) * 2 multiplier
  });

  it("stacks with companionDamage talent", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["wolf"],
      trinketEffects: manifest,
      talentEffects: { ...defaultTalentEffects, companionDamage: 2 },
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.bleed).toBe(8); // (1 base + 1 collar + 2 talent) * 2 multiplier
  });

  it("Lizard Scout companion also benefits from collar", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["lizard-scout"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.poison).toBe(2); // 1 base + 1 collar
  });

  it("Imp companion also benefits from collar", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({
      mana: 4,
      maxMana: 4,
      enemyHealth: 30,
      activeCompanion: companionLibrary["imp"],
      trinketEffects: manifest,
      deck: [makeCard(), makeCard(), makeCard(), makeCard()],
    });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result.enemyStatuses.burn).toBe(2); // 1 base + 1 collar
  });

  it("does nothing when no companion is active", () => {
    const manifest = computeTrinketManifest(["companions-collar"]);
    const state = makeState({ trinketEffects: manifest, activeCompanion: null });
    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);
    expect(result).toBe(state);
  });
});

describe("Boon â€” Polar Pendant (freeze lasts 1 turn longer)", () => {
  it("extends freeze skip turns by 1 when freeze triggers", () => {
    const manifest = computeTrinketManifest(["frozen-pocketwatch"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyCC.freezeSkipTurns).toBe(2); // 1 base + 1 extension
  });

  it("without pendant, freeze skip turns is 1", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
  });

  it("does not trigger freeze when threshold not met", () => {
    const manifest = computeTrinketManifest(["frozen-pocketwatch"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 7 }] });
    const state = makeState({ mana: 10, enemyHealth: 30, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});

describe("Boon â€” Thunderstone (6 nature damage on stun)", () => {
  it("deals 6 nature damage when stun threshold is crossed", () => {
    const manifest = computeTrinketManifest(["thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44); // 100 - 50 (stun) - 6 (thunderstone)
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 6 });
  });

  it("does NOT deal thunderstone damage when stun does not trigger", () => {
    const manifest = computeTrinketManifest(["thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 10 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(90); // 100 - 10, no thunderstone
  });

  it("without boon, no extra damage on stun", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(50); // 100 - 50, no thunderstone
  });

  it("fires from Obsidian Hammer forge-based stun rider", () => {
    const manifest = computeTrinketManifest(["obsidian-hammer", "thunderstone"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({
      mana: 10,
      enemyHealth: 3,
      enemyMaxHealth: 3,
      enemyMitigation: defaultEnemyMitigation({ armor: 3, forge: 0, block: 0 }),
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 4,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      trinketEffects: manifest,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    // forge(4) + card(1) = 5, armor(3) â†’ 2 damage â†’ health = 1
    // forge rider adds 1 stun â†’ 1 > 1*0.5 â†’ stun triggers â†’ thunderstone(6) â†’ health = 0
    expect(result.enemyHealth).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 6 });
  });
});

describe("Boon â€” Thunderstone + Lucky Clover chaining", () => {
  it("Lucky Clover can proc gold from Thunderstone nature damage", () => {
    const manifest = computeTrinketManifest(["thunderstone", "lucky-clover"]);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.99) // crit check â†’ no crit
      .mockReturnValueOnce(0.05); // Lucky Clover â†’ 5 < 10 = proc
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44);
    expect(result.gold).toBe(6); // gold = thunderstone damage
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
  });

  it("does not grant gold when Lucky Clover does not proc", () => {
    const manifest = computeTrinketManifest(["thunderstone", "lucky-clover"]);
    // Math.random returns 0.99 (default mock) â†’ Lucky Clover fails
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 50 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(44);
    expect(result.gold).toBe(0);
  });
});

describe("Boon â€” Lucky Clover (10% nature damage â†’ gold)", () => {
  it("grants gold equal to nature damage dealt when proc triggers", () => {
    const manifest = computeTrinketManifest(["lucky-clover"]);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.99) // crit check â†’ no crit
      .mockReturnValueOnce(0.05); // Lucky Clover â†’ 5 < 10 = proc
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92); // 100 - 8
    expect(result.gold).toBe(8); // gold = damage dealt
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("does not grant gold when proc does not trigger (90% fail)", () => {
    const manifest = computeTrinketManifest(["lucky-clover"]);
    // Math.random returns 0.99 (default mock) â†’ Lucky Clover fails
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0, trinketEffects: manifest });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92);
    expect(result.gold).toBe(0);
  });

  it("does nothing without the boon", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "nature", amount: 8 }] });
    const state = makeState({ mana: 10, enemyHealth: 100, enemyMaxHealth: 100, gold: 0 });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(92);
    expect(result.gold).toBe(0);
  });
});

describe("Resonant Chime boon", () => {
  it("grants bonus mana after playing enough cards", () => {
    const manifest = computeTrinketManifest(["resonant-chimes"]);
    const card = makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({
      mana: 5,
      maxMana: 5,
      hand: [card],
      cardsPlayedThisTurn: 2,
      trinketEffects: manifest,
      flags: defaultCombatFlags({
        firstPhysicalCardFreeUsed: false,
        firstHolyCardFreeUsed: false,
        firstBurnCardDoubledUsed: false,
        firstArmorCardDoubledUsed: false,
        firstPoisonCardFreeUsed: false,
        firstBleedCardFreeUsed: false,
        nextCardCostReduction: 0,
        goldOnFirstPoisonThisCombat: false,
        firstHolyDamageBonusUsed: false,
        firstBurnTrinketDoubledUsed: false,
        firstHarmfulStatusPrevented: false,
        firstPotionFreeUsed: false,
        resonantChimeUsedThisTurn: false,
      }),
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(6);
    expect(result.state.flags.resonantChimeUsedThisTurn).toBe(true);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });

  it("only triggers once per turn", () => {
    const manifest = computeTrinketManifest(["resonant-chimes"]);
    const card1 = makeCard({ id: "c1", cost: 0, effects: [] });
    const card2 = makeCard({ id: "c2", cost: 0, effects: [] });
    const state = makeState({
      mana: 5,
      maxMana: 5,
      hand: [card1, card2],
      cardsPlayedThisTurn: 2,
      trinketEffects: manifest,
      flags: defaultCombatFlags({
        firstPhysicalCardFreeUsed: false,
        firstHolyCardFreeUsed: false,
        firstBurnCardDoubledUsed: false,
        firstArmorCardDoubledUsed: false,
        firstPoisonCardFreeUsed: false,
        firstBleedCardFreeUsed: false,
        nextCardCostReduction: 0,
        goldOnFirstPoisonThisCombat: false,
        firstHolyDamageBonusUsed: false,
        firstBurnTrinketDoubledUsed: false,
        firstHarmfulStatusPrevented: false,
        firstPotionFreeUsed: false,
        resonantChimeUsedThisTurn: false,
      }),
    });
    const first = playBattleCardResolved(state, card1.id, 0);
    expect(first.state.flags.resonantChimeUsedThisTurn).toBe(true);

    const second = playBattleCardResolved(first.state, card2.id, 0);
    expect(second.state.flags.resonantChimeUsedThisTurn).toBe(true);
    expect(second.state.mana).toBe(first.state.mana);
  });
});
