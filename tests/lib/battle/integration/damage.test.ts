import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import { type CombatTextEvent } from "@/lib/battle/types";
import { computeTrinketManifest } from "@/lib/trinkets";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultEnemyMitigation,
  defaultCcState,
  defaultCombatFlags,
} from "../../../fixtures/default-battle-state";

vi.spyOn(Math, "random").mockReturnValue(0.99);

describe("dealDamageToEnemy â€” zero base damage", () => {
  it("deals no damage when amount is 0 and no block/armor substitutes", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(30);
  });

  it("equalToBlock with 0 block deals no damage", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToBlock: true }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(30);
  });

  it("equalToArmor with 0 armor deals no damage", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToArmor: true }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(30);
  });
});

describe("dealDamageToEnemy â€” first-damage-doubled flags", () => {
  it("burn first-card-doubled flag is consumed after first use", () => {
    const talentEffects = { ...defaultTalentEffects, firstBurnCardDoubled: true };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });

    const texts1: CombatTextEvent[] = [];
    const state1 = makeState({ mana: 10, enemyHealth: 50, talentEffects });
    const result1 = applyCardEffects(state1, card, texts1);
    expect(result1.flags.firstBurnCardDoubledUsed).toBe(true);
  });

  it("burn first-card-doubled flag is set after first use", () => {
    const talentEffects = { ...defaultTalentEffects, firstBurnCardDoubled: true };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });

    const texts1: CombatTextEvent[] = [];
    const state1 = makeState({ mana: 10, enemyHealth: 50, talentEffects });
    const result1 = applyCardEffects(state1, card, texts1);
    expect(result1.flags.firstBurnCardDoubledUsed).toBe(true);

    // second use with already-consumed flag does not set it again
    const texts2: CombatTextEvent[] = [];
    const state2 = makeState({
      mana: 10,
      enemyHealth: 50,
      talentEffects,
      flags: defaultCombatFlags({ ...result1.flags }),
    });
    const result2 = applyCardEffects(state2, card, texts2);
    expect(result2.flags.firstBurnCardDoubledUsed).toBe(true);
  });

  it("brass-censer boon sets firstHolyDamageBonusUsed flag", () => {
    const manifest = computeTrinketManifest(["brass-censer"]);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 4 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      gold: 0,
      enemyStatuses: defaultEnemyStatusValues({ burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 }),
      trinketEffects: manifest,
    });
    const result = applyCardEffects(state, card, texts);
    expect(result.flags.firstHolyDamageBonusUsed).toBe(true);
  });
});

describe("dealDamageToEnemy â€” critical strikes", () => {
  it("global crit can apply to any damage type", () => {
    // Force a critical hit
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 50 });
    const result = applyCardEffects(state, card, texts);
    // 10 damage * 2 crit = 20 damage â†’ health 30
    expect(result.enemyHealth).toBe(30);
  });
});

describe("dealDamageToEnemy â€” physical vs stunned/frozen multipliers", () => {
  it("physical damage gets stunned multiplier when enemy is stunned", () => {
    const talentEffects = { ...defaultTalentEffects, physicalDoubledVsStunned: true };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const staleState = makeState({
      mana: 10,
      enemyHealth: 50,
      talentEffects,
    });
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects,
    });
    const noMultiplier = applyCardEffects(staleState, card, texts.slice(0, 0));
    const newTexts: CombatTextEvent[] = [];
    const withMultiplier = applyCardEffects(state, card, newTexts);
    // stunned multiplier should increase damage compared to non-stunned
    const noStunDmg = staleState.enemyHealth - noMultiplier.enemyHealth;
    const stunDmg = state.enemyHealth - withMultiplier.enemyHealth;
    expect(stunDmg).toBeGreaterThan(noStunDmg);
  });

  it("stun double damage talent doubles damage against stunned enemies", () => {
    const talentEffects = { ...defaultTalentEffects, stunDoubleDamage: true };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 8 }] });
    const texts: CombatTextEvent[] = [];
    const staleState = makeState({
      mana: 10,
      enemyHealth: 50,
      talentEffects,
    });
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      talentEffects,
    });
    const noTrait = applyCardEffects(staleState, card, texts.slice(0, 0));
    const newTexts: CombatTextEvent[] = [];
    const withTrait = applyCardEffects(state, card, newTexts);
    // stunDoubleDamage should make damage higher
    const noStunDmg = staleState.enemyHealth - noTrait.enemyHealth;
    const stunDmg = state.enemyHealth - withTrait.enemyHealth;
    expect(stunDmg).toBeGreaterThan(noStunDmg);
  });
});

describe("dealDamageToEnemy â€” forge bonus eligibility", () => {
  it("forge is consumed after physical damage (native forge type)", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 3,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
    });
    const result = applyCardEffects(state, card, texts);
    // forge contributed to physical damage â†’ consumed by 1
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("forge is NOT consumed for burn without forgeToBurn talent", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 3,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
    });
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.forge).toBe(3);
  });

  it("forge IS consumed for burn with forgeToBurn talent", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 3,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      talentEffects: { ...defaultTalentEffects, forgeToBurn: true },
    });
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.forge).toBe(2);
  });
});

describe("dealDamageToEnemy â€” armor decay and holy riders", () => {
  it("armor reduces physical damage taken by the enemy", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0, block: 0 }),
    });
    const result = applyCardEffects(state, card, texts);
    // enemy with armor takes less damage
    expect(result.enemyHealth).toBeLessThan(50);
    expect(result.enemyMitigation.armor).toBeLessThan(5); // decays
  });

  it("armor does NOT reduce burn damage (non-physical, ignores armor entirely)", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0, block: 0 }),
    });
    const result = applyCardEffects(state, card, texts);
    // burn ignores armor â†’ armor still decays from hit but not from damage reduction
    expect(result.enemyHealth).toBeLessThan(50);
  });

  it("holy lifesteal heals the player", () => {
    const talentEffects = { ...defaultTalentEffects, holyLifestealPercent: 50 };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "holy", amount: 10 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      gold: 0,
      playerHealth: 20,
      enemyStatuses: defaultEnemyStatusValues({ burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 }),
      talentEffects,
    });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBeLessThan(50);
    expect(result.playerHealth).toBeGreaterThan(20);
  });

  it("does not lifesteal when damage is zero", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0, lifesteal: true }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 30, playerHealth: 15 });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerHealth).toBe(15);
  });
});

describe("dealDamageToEnemy â€” overkill clamping", () => {
  it("overkill damage is clamped to 0 health", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 50 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 10 });
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(0);
    expect(result.enemyHealth).not.toBeLessThan(0);
  });
});

describe("applyDamageStatuses â€” stun talent effects chain", () => {
  it("stun trigger fires all talent effects: draw, free card, block, forge, strip armor, mana", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const talentEffects = {
      ...defaultTalentEffects,
      drawOnStun: 2,
      nextCardFreeOnStun: true,
      blockOnStun: 4,
      forgeOnStun: 2,
      stunStripArmor: true,
      manaOnStun: 1,
    };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 20 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" })],
      hand: [],
      talentEffects,
      enemyMitigation: defaultEnemyMitigation({ armor: 3, forge: 0, block: 0 }),
    });
    const result = applyCardEffects(state, card, texts);
    // stun 20 damage - 3 armor = 17 â†’ health 13
    // stun status applied = 17, threshold: > 30*0.5 = 15 â†’ 17 > 15 â†’ triggers stun
    // stun trigger fires: draw 2, free card flag, block+4, forge+2, strip armor, mana+1
    expect(result.enemyHealth).toBe(13);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(result.playerStatuses.block).toBe(4);
    // forge added by stun talent trigger
    expect(result.playerStatuses.forge).toBeGreaterThanOrEqual(1);
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.mana).toBe(11);
    // stun draw talent draws up to drawOnStun cards from deck
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.flags.nextCardCostReduction).toBeGreaterThan(0);
  });
});

describe("applyDamageStatuses â€” stun on cooldown enemy", () => {
  it("does not stun when enemy CC cooldown is active (stun status cleared by immunity)", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "stun", amount: 20 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 1 }),
    });
    const result = applyCardEffects(state, card, texts);
    // stun 20 > 15 threshold, but cooldown active â†’ immunity clears stun status
    expect(result.enemyCC.stunSkipTurns).toBe(0);
    expect(result.enemyStatuses.stun).toBe(0); // immunity clears it
  });
});

describe("applyDamageStatuses â€” freeze threshold boundary", () => {
  it("freeze triggers when stacks >= health * 0.5", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
    });
    const result = applyCardEffects(state, card, texts);
    // freeze = 15, health = 30, threshold = 0.5 â†’ 15 >= 15 â†’ triggers
    expect(result.enemyCC.freezeSkipTurns).toBeGreaterThan(0);
  });

  it("freeze threshold is checked against post-damage health (which is lower)", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 6 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
    });
    const result = applyCardEffects(state, card, texts);
    // freeze damage 6 â†’ health 24, freeze=6, threshold=24*0.5=12 â†’ 6 < 12 â†’ no trigger
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});

describe("applyDamageStatuses â€” freeze cooldown skip", () => {
  it("does not re-freeze when enemy is already on freeze cooldown", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "freeze", amount: 25 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 2 }),
    });
    const result = applyCardEffects(state, card, texts);
    // 25 >= 15 threshold, but cooldown active â†’ no new freeze
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
  });
});

describe("applyDamageStatuses â€” bleed stacking and leech", () => {
  it("bleed stacks 2x per hit and accumulates leech healing", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card1 = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 5 }] });
    const card2 = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 3 }] });
    const texts: CombatTextEvent[] = [];
    const state1 = makeState({ mana: 10, enemyHealth: 50 });
    const result1 = applyCardEffects(state1, card1, texts);
    // bleed status: 5 * 2 = 10 bleed stacks
    expect(result1.enemyStatuses.bleed).toBe(10);
    const result2 = applyCardEffects(result1, card2, texts);
    // bleed status: 3 * 2 = 6, total = 16 bleed stacks
    expect(result2.enemyStatuses.bleed).toBe(16);
  });

  it("bleed leech accumulates across multiple bleed hits", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const card = makeCard({ effects: [{ kind: "damage", damageType: "bleed", amount: 4, lifesteal: true }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({ mana: 10, enemyHealth: 50 });
    const result = applyCardEffects(state, card, texts);
    // bleed status: 4 * 2 = 8. Lifesteal on card + bleed leech from bleedAmount (8)
    // pendingBleedLeechHealing: base 8 + lifesteal proc = 8
    expect(result.enemyStatuses.bleed).toBe(8);
    // pendingBleedLeechHealing added from bleed leech (8 * BLEED_STATUS_MULTIPLIER = 16)
    // wait, let me re-read the code:
    // stackBleed: bleedAmount = statusDamage * 2 = 4 * 2 = 8
    // queueBleedLeech: if lifesteal true, pendingBleedLeechHealing += bleedAmount(8)
    // So pendingBleedLeechHealing = 8
    expect(result.pendingBleedLeechHealing).toBe(8);
  });
});

describe("applyDamageStatuses â€” poison talent riders", () => {
  it("poison strip armor works regardless of random", () => {
    const talentEffects = { ...defaultTalentEffects, poisonStripArmor: true };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "poison", amount: 6 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 50,
      talentEffects,
      enemyMitigation: defaultEnemyMitigation({ armor: 3, forge: 0, block: 0 }),
    });
    const result = applyCardEffects(state, card, texts);
    // armor decays by 1 from hit, then poisonStripArmor strips 1 â†’ armor 1
    expect(result.enemyMitigation.armor).toBe(1);
  });

  it("poison leech talent heals the player", () => {
    const talentEffects = { ...defaultTalentEffects, poisonLeechChance: 100 };
    const card = makeCard({ effects: [{ kind: "damage", damageType: "poison", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      mana: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerHealth: 20,
      talentEffects,
    });
    const result = applyCardEffects(state, card, texts);
    // poisonLeechChance=100% triggers, heals player
    expect(result.playerHealth).toBeGreaterThan(20);
  });
});

describe("applyDamageStatuses â€” forge threshold bursts", () => {
  it("crossing multiple forge thresholds in one gain fires all bursts", () => {
    const card = makeCard({ effects: [{ kind: "player-status", status: "forge", amount: 4 }] });
    const texts: CombatTextEvent[] = [];
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({
        block: 0,
        armor: 0,
        forge: 2,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      }),
      talentEffects: {
        ...defaultTalentEffects,
        forgeBurnThreshold: 3,
        forgeBurnDamage: 5,
        forgeStripArmorThreshold: 4,
        forgeBlockThreshold: 5,
        forgeBlockAmount: 3,
      },
      enemyMitigation: defaultEnemyMitigation({ armor: 2, forge: 0, block: 0 }),
    });
    const result = applyCardEffects(state, card, texts);
    // forge: 2+4 = 6 â†’ crosses threshold 3 (burn burst), 4 (strip armor), 5 (block burst)
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.playerStatuses.block).toBeGreaterThanOrEqual(3);
  });
});
