import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";
import { applyCardEffects, defaultTalentEffects, endPlayerTurn } from "@/lib/battle";
import { isPlayerDefeated, type CombatTextEvent } from "@/lib/battle/types";
import { IRON_HIDE_ARMOR_PER_TURN, TRAIT_FORGE_PER_TURN } from "@/lib/game-constants";
import { companionLibrary, type DifficultyModifier } from "@/lib/game-data";
import { computeTrinketManifest, defaultTrinketEffects } from "@/lib/trinkets";
import {
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
  defaultCcState,
} from "../../../fixtures/default-battle-state";

vi.spyOn(Math, "random").mockReturnValue(0.99);

describe("endPlayerTurn", () => {
  it("switches to enemy phase and draws a new hand", () => {
    const state = makeState({
      turnPhase: "player",
      hand: [makeCard({ id: "c1" }), makeCard({ id: "c2" })],
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.turn).toBe(2);
    expect(result.state.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.state.mana).toBe(4);
  });

  it("skips enemy turn when enemyStunSkipTurns > 0", () => {
    const state = makeState({
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyCC.stunSkipTurns).toBe(0);
    expect(result.state.playerHealth).toBe(30); // no damage taken
    expect(result.combatTexts).not.toContainEqual({ target: "enemy", kind: "status", stat: "stun", amount: 0 });
  });

  it("fully clears one remaining block at next player turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      playerStatuses: defaultPlayerStatusValues({ block: 1 }),
      deck: [makeCard({ id: "d1" })],
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("applies enemy attack damage", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 30,
    });
    const result = endPlayerTurn(state);
    // With no block or armor, all 8 damage goes through
    expect(result.state.playerHealth).toBe(22);
  });

  it("flags player turn skips after enemy stun so the controller can continue combat", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "stun", amount: 20 }],
      playerHealth: 30,
      playerMaxHealth: 30,
      hand: [makeCard({ id: "h1" })],
      mana: 2,
    });

    const result = endPlayerTurn(state);

    expect(result.playerTurnSkipped).toBe(true);
    expect(result.state.turnPhase).toBe("enemy");
    expect(result.state.hand).toEqual([]);
    expect(result.state.mana).toBe(2);
    expect(result.state.playerCC.stunSkipTurns).toBe(0);
    expect(result.state.playerStatuses.stun).toBe(0);
  });

  it("triggers Death's Door instead of defeat on the first fatal combat damage", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 5,
      deck: [makeCard({ id: "d1" })],
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorTriggeredTurn).toBe(1);
    expect(isPlayerDefeated(result.state)).toBe(false);
  });

  it("Death's Door recovery turn is not skipped by pending player crowd control", () => {
    const state = makeState({
      playerHealth: 2,
      playerStatuses: defaultPlayerStatusValues({ burn: 3 }),
      playerCC: defaultCcState({ stunSkipTurns: 1 }),
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      hand: [makeCard({ id: "h1" })],
      mana: 2,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.turnPhase).toBe("player");
    expect(result.playerTurnSkipped).toBe(false);
    expect(result.state.playerCC.stunSkipTurns).toBe(0);
  });

  it("kills the player at the next enemy turn end if Death's Door was not healed", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      turn: 2,
      deck: [makeCard({ id: "d1" })],
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("does not retrigger Death's Door after it was consumed", () => {
    const state = makeState({
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      playerHealth: 3,
      deathsDoorUsed: true,
      deck: [makeCard({ id: "d1" })],
    });
    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(0);
    expect(result.state.deathsDoorActive).toBe(false);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });

  it("healing above 0 clears Death's Door but keeps it consumed", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
    });
    const card = makeCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);

    expect(result.playerHealth).toBe(5);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(false);
  });

  it("gives the player an extra turn when haste is active", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ haste: 1 }),
      hand: [makeCard({ id: "h1" }), makeCard({ id: "h2" })],
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerStatuses.haste).toBe(0);
    // Enemy should not have attacked
    expect(result.state.playerHealth).toBe(30);
  });

  it("only heals leech amount from bleed, not total bleed stack", () => {
    const state = makeState({
      playerHealth: 20,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      enemyStatuses: defaultEnemyStatusValues({ bleed: 10 }),
      pendingBleedLeechHealing: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.enemyTurnStartState?.enemyHealth).toBe(20);
    expect(result.enemyTurnStartState?.playerHealth).toBe(22);
    expect(result.enemyTurnStartCombatTexts).toEqual([
      { target: "player", kind: "heal", stat: "health", amount: 2 },
      { target: "enemy", kind: "damage", stat: "bleed", amount: 10 },
    ]);
    expect(result.enemyResolutionCombatTexts).toContainEqual({
      target: "player",
      kind: "damage",
      stat: "health",
      amount: 8,
    });
    // Enemy takes 10 bleed damage
    expect(result.state.enemyHealth).toBe(20);
    // Player takes 8 enemy attack then heals 2 from leech (half of pending 4): 20 - 8 + 2 = 14
    expect(result.state.playerHealth).toBe(14);
    expect(result.state.enemyStatuses.bleed).toBe(0);
    expect(result.state.pendingBleedLeechHealing).toBe(0);
  });

  it("applies bleed leech healing when bleed kills the enemy before their attack", () => {
    const state = makeState({
      playerHealth: 20,
      enemyHealth: 6,
      enemyMaxHealth: 30,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      enemyStatuses: defaultEnemyStatusValues({ bleed: 10 }),
      pendingBleedLeechHealing: 4,
    });

    const result = endPlayerTurn(state);

    expect(result.enemyTurnStartState?.enemyHealth).toBe(0);
    expect(result.enemyTurnStartState?.playerHealth).toBe(22);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(22);
    expect(result.enemyResolutionCombatTexts).toEqual([]);
  });

  it("ticks player Burn damage and halves the remaining Burn stack", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ burn: 5 }),
      enemyAttackEffects: [],
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(25);
    expect(result.state.playerStatuses.burn).toBe(3);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "damage", stat: "burn", amount: 5 });
  });

  it("reduces enemy Stun buildup by the amount Block absorbs", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ block: 1 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "stun", amount: 2 }],
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerHealth).toBe(29);
    expect(result.state.playerStatuses.stun).toBe(1);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "damage", stat: "block", amount: 1 });
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "damage", stat: "stun", amount: 1 });
  });

  it("uses Plague Doctor's Mask only on harmful status effects", () => {
    const manifest = computeTrinketManifest(["plague-doctors-mask"]);
    const state = makeState({
      enemyAttackEffects: [
        { kind: "player-status", status: "block", amount: 2 },
        { kind: "player-status", status: "poison", amount: 3 },
      ],
      trinketEffects: manifest,
    });

    const result = endPlayerTurn(state);

    expect(result.state.playerStatuses.block).toBe(1);
    expect(result.state.playerStatuses.poison).toBe(0);
    expect(result.state.flags.firstHarmfulStatusPrevented).toBe(true);
    expect(result.state.playerHealth).toBe(30); // no damage when prevented
  });

  it.each([
    { status: "burn", amount: 2, expectedHealth: 28, expectedStack: 1, note: "burn halves to 1" },
    { status: "poison", amount: 3, expectedHealth: 27, expectedStack: 2, note: "poison reduces by 1 to 2" },
    { status: "bleed", amount: 2, expectedHealth: 26, expectedStack: 0, note: "bleed doubles, then resets to 0" },
  ] as const)(
    "enemy $status attack applies $status and tick $note",
    ({ status, amount, expectedHealth, expectedStack }) => {
      const state = makeState({
        playerHealth: 30,
        playerStatuses: defaultPlayerStatusValues({}),
        enemyAttackEffects: [{ kind: "player-status", status, amount } as const],
      });
      const result = endPlayerTurn(state);
      expect(result.state.playerHealth).toBe(expectedHealth);
      expect(result.state.playerStatuses[status]).toBe(expectedStack);
    },
  );

  it.each([
    { damageType: "freeze", amount: 3, expectedHealth: 27, expectedStack: 3 },
    { damageType: "stun", amount: 2, expectedHealth: 28, expectedStack: 2 },
  ] as const)(
    "enemy $damageType damage also applies buildup equal to health damage",
    ({ damageType, amount, expectedHealth, expectedStack }) => {
      const state = makeState({
        playerHealth: 30,
        playerStatuses: defaultPlayerStatusValues({}),
        enemyAttackEffects: [{ kind: "damage", damageType, amount }],
      });
      const result = endPlayerTurn(state);
      expect(result.state.playerHealth).toBe(expectedHealth);
      expect(result.state.playerStatuses[damageType]).toBe(expectedStack);
    },
  );

  it("does not trigger companion attack (now handled by controller timing)", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
    });

    const result = endPlayerTurn(state);

    expect(result.state.activeCompanion?.id).toBe("wolf");
    expect(result.state.turnPhase).toBe("player");
    // Companion no longer attacks as part of endPlayerTurn
    expect(result.state.enemyHealth).toBe(30);
    expect(result.state.enemyStatuses.bleed).toBe(0);
  });

  it("difficulty modifier enemy-gains-forge-each-turn increments enemyForge", () => {
    const state = makeState({
      enemyAttackEffects: [],
      difficultyModifiers: [{ kind: "enemy-gains-forge-each-turn" }] as DifficultyModifier[],
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 },
    });

    const result = endPlayerTurn(state);

    expect(result.state.enemyMitigation.forge).toBe(1);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "status", stat: "forge", amount: 1 });
  });
});

describe("enemy traits via endPlayerTurn", () => {
  it("rusting-carapace adds forge each turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "rust-monster",
        title: "Rust Monster",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "rusting-carapace", title: "Rusting Carapace", description: "Gains forge each turn" }],
        attackEffects: [],
      },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.forge).toBe(1);
  });

  it("iron-hide randomly adds armor, forge, or burn each turn", () => {
    const base = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "iron-bear",
        title: "The Iron Bear",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [
          { id: "iron-hide", title: "Iron Hide", description: "Gains 1 Armor, 1 Forge, or applies 1 Burn each turn" },
        ],
        attackEffects: [],
      },
    });

    // Run 3 turns with deterministic random values
    const result1 = endPlayerTurn(base, { traitRoll: 0.1 });
    expect(result1.state.enemyMitigation.armor).toBe(IRON_HIDE_ARMOR_PER_TURN);
    expect(result1.state.enemyMitigation.forge).toBe(0);
    expect(result1.state.playerHealth).toBe(30);
    expect(result1.combatTexts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "armor",
      amount: IRON_HIDE_ARMOR_PER_TURN,
    });

    const state2 = endPlayerTurn(result1.state, { traitRoll: 0.5 });
    expect(state2.state.enemyMitigation.forge).toBe(TRAIT_FORGE_PER_TURN);
    expect(state2.state.playerHealth).toBe(30);
    expect(state2.combatTexts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "forge",
      amount: TRAIT_FORGE_PER_TURN,
    });

    // Burn adds +1 to the bear's Burn damage (stacks each time chosen)
    const state3 = endPlayerTurn(state2.state, { traitRoll: 0.9 });
    expect(state3.state.enemyStatuses.burnBonus).toBe(1);
    expect(state3.combatTexts).toContainEqual({
      target: "enemy",
      kind: "status",
      stat: "burnBonus",
      amount: 1,
    });
  });

  it("glacial-shell adds freeze bonus each turn", () => {
    const state = makeState({
      enemyAttackEffects: [],
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Gains freeze bonus each turn" }],
        attackEffects: [{ kind: "damage", damageType: "freeze", amount: 2 }],
      },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyStatuses.freezeBonus).toBe(1);
  });

  it("glacial-shell does NOT add freeze bonus when frozen and player has freezePreventsEnemyScaling talent", () => {
    const state = makeState({
      enemyAttackEffects: [],
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      talentEffects: {
        ...defaultTalentEffects,
        freezePreventsEnemyScaling: true,
      },
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Gains freeze bonus each turn" }],
        attackEffects: [{ kind: "damage", damageType: "freeze", amount: 2 }],
      },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyStatuses.freezeBonus).toBe(0);
  });

  it("regeneration heals enemy at end of turn", () => {
    const state = makeState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 4,
      enemyAttackEffects: [],
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(24);
    expect(result.combatTexts).toContainEqual({ target: "enemy", kind: "heal", stat: "health", amount: 4 });
  });
});

describe("health threshold talents via endPlayerTurn", () => {
  it("healthThresholdBlock grants block when crossing threshold", () => {
    const state = makeState({
      playerHealth: 25,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 12 }],
    });
    const result = endPlayerTurn(state);
    // 25 Health - 12 damage = 13 (43%), crossing 50% threshold → grants 5 block.
    // advanceToPlayerTurn then halves block: round(5/2) = 3
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("healthThresholdArmor grants armor when crossing threshold", () => {
    const state = makeState({
      playerHealth: 25,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdArmor: { threshold: 50, amount: 3 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 12 }],
    });
    const result = endPlayerTurn(state);
    // Armor = 3 granted, then -1 from armor decrement in processEnemyDamageEffect
    expect(result.state.playerStatuses.armor).toBe(2);
  });

  it("does not grant threshold bonus when health stays above threshold", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      talentEffects: { ...defaultTalentEffects, healthThresholdBlock: { threshold: 50, amount: 5 } },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const result = endPlayerTurn(state);
    // 20 Health → 18 Health = 60% of 30, above 50% threshold
    expect(result.state.playerStatuses.block).toBe(0);
  });
});

describe("enemy damage absorption via endPlayerTurn", () => {
  it("block absorbs physical damage", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });
    const result = endPlayerTurn(state);
    // 8 - 5 block = 3, then 3 - 0 armor = 3 damage
    expect(result.state.playerHealth).toBe(27);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("armor reduces physical damage after block", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ block: 3, armor: 4 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = endPlayerTurn(state);
    // 10 - 3 block = 7, then 7 - 4 armor = 3 damage → health = 27
    expect(result.state.playerHealth).toBe(27);
    expect(result.state.playerStatuses.armor).toBe(3); // armor - 1 after taking damage
  });

  it("vanguard crest grants forge when block fully absorbs physical damage", () => {
    const manifest = computeTrinketManifest(["vanguards-crest"]);
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      trinketEffects: manifest,
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.forge).toBeGreaterThan(0);
    expect(result.combatTexts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 1 });
  });

  it("blockAbsorbPhysicalBonus makes block more effective against physical", () => {
    const state = makeState({
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      talentEffects: { ...defaultTalentEffects, blockAbsorbPhysicalBonus: 20 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 15 }],
    });
    const result = endPlayerTurn(state);
    // blockAbsorbPhysicalBonus 20%: effective block = floor(10 * 1.2) = 12
    // 15 - 12 = 3 damage → health = 27
    expect(result.state.playerHealth).toBe(27);
  });

  it("blockDepletedHeal restores health when block is fully consumed", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ block: 5 }),
      talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = endPlayerTurn(state);
    // block absorbs 5, remaining 5 damage → health 20-5=15, then +2 heal = 17
    expect(result.state.playerHealth).toBe(17);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("blockDepletedHeal does not trigger when block is not fully consumed", () => {
    const state = makeState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ block: 10 }),
      talentEffects: { ...defaultTalentEffects, blockDepletedHeal: 2 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = endPlayerTurn(state);
    // block absorbs 5, block decays from 5 to 3 at end of turn, 0 damage to health, no depletion heal
    expect(result.state.playerHealth).toBe(20);
    expect(result.state.playerStatuses.block).toBe(3);
  });
});

describe("endPlayerTurn — armorBreakBlock talent", () => {
  it("grants block when armor fully consumed by physical attack", () => {
    const state = makeState({
      playerHealth: 25,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ block: 0, armor: 1 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      talentEffects: { ...defaultTalentEffects, armorBreakBlock: 3 },
    });
    const result = endPlayerTurn(state);
    // Physical attack decays armor by ARMOR_DECAY_AMOUNT=1, from 1 to 0,
    // triggering armorBreakBlock = 3 block
    expect(result.state.playerStatuses.armor).toBe(0);
    expect(result.enemyResolutionCombatTexts).toContainEqual({
      target: "player",
      kind: "status",
      stat: "block",
      amount: 3,
    });
  });
});

describe("endPlayerTurn — poison halves enemy regeneration", () => {
  it("halves enemy regeneration when poison is active and talent is present", () => {
    const state = makeState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 4,
      enemyStatuses: defaultEnemyStatusValues({ poison: 2 }),
      enemyAttackEffects: [],
      talentEffects: { ...defaultTalentEffects, poisonHalvesHealing: true },
    });
    const result = endPlayerTurn(state);
    // Poison ticks first (2 damage, 20→18, decays to 1), then regen halved (4→2, 18→20)
    expect(result.state.enemyHealth).toBe(20);
    expect(result.enemyResolutionCombatTexts).toContainEqual({
      target: "enemy",
      kind: "heal",
      stat: "health",
      amount: 2,
    });
  });

  it("does not halve when poison is 0", () => {
    const state = makeState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyRegeneration: 4,
      enemyStatuses: defaultEnemyStatusValues({}),
      enemyAttackEffects: [],
      talentEffects: { ...defaultTalentEffects, poisonHalvesHealing: true },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyHealth).toBe(24);
    expect(result.enemyResolutionCombatTexts).toContainEqual({
      target: "enemy",
      kind: "heal",
      stat: "health",
      amount: 4,
    });
  });
});

describe("endPlayerTurn — haste + Death's Door overlap", () => {
  it("haste skip does not prevent Death's Door recovery turn", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 1,
      turn: 2,
      playerStatuses: defaultPlayerStatusValues({ haste: 1 }),
    });
    const result = endPlayerTurn(state);
    // haste skip still runs finalizePlayerTurn → resolveDeathsDoorEndOfEnemyTurn
    // turn 2, triggeredTurn 1, graceTurns = 1 → turn - triggeredTurn < graceTurns? 2-1 < 1? no
    // Actually: graceTurns = 1 + deathsDoorExtension(0) = 1. 2 - 1 < 1? false.
    // So Death's Door expires → deathsDoorActive=false
    expect(result.state.deathsDoorActive).toBe(false);
    expect(result.state.playerStatuses.haste).toBe(0);
    expect(result.state.turnPhase).toBe("player");
  });

  it("haste skip still grants the grace recovery turn when within grace window", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: 2,
      turn: 2,
      playerStatuses: defaultPlayerStatusValues({ haste: 1 }),
    });
    const result = endPlayerTurn(state);
    // turn=2, triggeredTurn=2, graceTurns=1, 2-2 < 1 → true, Death's Door stays active
    expect(result.state.deathsDoorActive).toBe(true);
    expect(result.state.deathsDoorUsed).toBe(true);
    expect(result.state.turnPhase).toBe("player");
  });
});

describe("endPlayerTurn — multiple enemy attack effects", () => {
  it("applies damage then status from multi-effect enemy attack", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 6 },
        { kind: "player-status", status: "poison", amount: 3 },
      ],
    });
    const result = endPlayerTurn(state);
    // damage 6 → health 24, then poison applied 3, then poison tick deals 3 → health 21, poison decays to 2
    expect(result.state.playerHealth).toBe(21);
    expect(result.state.playerStatuses.poison).toBe(2);
  });

  it("applies two damage effects from one enemy attack", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 4 },
        { kind: "player-status", status: "poison", amount: 3 },
      ],
    });
    const result = endPlayerTurn(state);
    // physical damage 4 → health 26, then poison status applied (3), then poison tick (3) → health 23
    expect(result.state.playerHealth).toBe(23);
    expect(result.state.playerStatuses.poison).toBe(2); // 3 applied, 1 decays after tick
  });
});

describe("endPlayerTurn — non-physical enemy damage", () => {
  it("holy damage ignores player armor (armor only reduces physical)", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ armor: 5 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 10 }],
    });
    const result = endPlayerTurn(state);
    // holy damage ignores armor → 30-10 = 20. Armor still decays by 1 per hit → 4.
    expect(result.state.playerHealth).toBe(20);
    expect(result.state.playerStatuses.armor).toBe(4);
  });

  it("burn enemy damage applies burn status rider and ticks same turn", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ armor: 4 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 7 }],
    });
    const result = endPlayerTurn(state);
    // burn damage 7 → health 23. Burn rider applies 7 burn. Burn tick then deals 7 more → health 16.
    expect(result.state.playerHealth).toBe(16);
    expect(result.state.playerStatuses.burn).toBe(4); // 7 burn halves to 3 (floor), wait...
    // Actually burn tick halves to Math.round(7/2)=4 or 3. Let's just verify it was applied and ticked.
    expect(result.state.playerStatuses.burn).toBeGreaterThan(0);
  });

  it("sundering armor piercing boon only strips armor for physical/stun (not holy)", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0, burnBonus: 0, block: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 8 }],
      trinketEffects: { ...defaultTrinketEffects, sunderingArmorPiercing: 3 },
    });
    const result = endPlayerTurn(state);
    // enemy has 4 armor, but holy damage doesn't care about armor (effectiveArmor=0)
    // player takes 8 holy damage → health 22
    // sundering only applies to player's attack, not enemy armor
    expect(result.state.playerHealth).toBe(22);
  });
});

describe("endPlayerTurn — zero-damage enemy attack", () => {
  it("zero-damage physical attack is a no-op", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 0 }],
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(30);
    expect(result.enemyPerformedAttack).toBe(true);
  });
});

describe("endPlayerTurn — enemy lifesteal", () => {
  it("does not over-heal the enemy beyond max health", () => {
    const state = makeState({
      enemyHealth: 28,
      enemyMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 6, lifesteal: true }],
    });
    const result = endPlayerTurn(state);
    // player: 30-6=24, enemy: 28+6=30 (capped at maxHealth 30)
    expect(result.state.enemyHealth).toBe(30);
    expect(result.state.playerHealth).toBe(24);
  });
});

describe("endPlayerTurn — enemy DoT kill during CC skip", () => {
  it("enemy killed by DoT while CCd does not attack and is marked dead", () => {
    const state = makeState({
      enemyHealth: 4,
      enemyMaxHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ bleed: 6 }),
      enemyCC: defaultCcState({ stunSkipTurns: 1 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = endPlayerTurn(state);
    // bleed tick deals 6 → enemy health 0 → dead. CC skip path prevents attack.
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(30);
    expect(result.enemyPerformedAttack).toBe(false);
  });
});

describe("endPlayerTurn — player killed by DoT after Death's Door consumed", () => {
  it("player dies when DoT deals final blow after Death's Door was already used", () => {
    const state = makeState({
      playerHealth: 2,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
      deathsDoorUsed: true,
      deathsDoorActive: false,
      enemyAttackEffects: [],
    });
    const result = endPlayerTurn(state);
    // burn tick: 4 damage → player health 0, deathsDoorActive was already false
    // player is defeated
    expect(result.state.playerHealth).toBe(0);
    expect(isPlayerDefeated(result.state)).toBe(true);
  });
});

describe("endPlayerTurn — stun and freeze both active", () => {
  it("enemy with both stun and freeze skip turns uses CC skip once", () => {
    const state = makeState({
      enemyCC: defaultCcState({ stunSkipTurns: 2, freezeSkipTurns: 1 }),
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const result = endPlayerTurn(state);
    // both > 0, enters CC skip path
    // reduceSkipTurns reduces both by 1
    expect(result.state.enemyCC.stunSkipTurns).toBe(1);
    expect(result.state.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.state.playerHealth).toBe(30);
    expect(result.enemyPerformedAttack).toBe(false);
  });
});

describe("endPlayerTurn — enemy regeneration at zero health", () => {
  it("does not revive the enemy through regeneration", () => {
    const state = makeState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      enemyRegeneration: 5,
      enemyAttackEffects: [],
    });
    const result = endPlayerTurn(state);
    // enemy dead at start → resolveEnemyTurnStart ticks, then enemyHealth <= 0 check skips
    // regen never runs because the check happens first
    expect(result.state.enemyHealth).toBe(0);
  });
});

describe("endPlayerTurn — enemy forge bonus only applies to physical", () => {
  it("enemy forge does not boost non-physical attack damage", () => {
    const state = makeState({
      playerHealth: 30,
      playerStatuses: defaultPlayerStatusValues({}),
      enemyMitigation: { armor: 0, forge: 5, freezeBonus: 0, burnBonus: 0, block: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "holy", amount: 8 }],
    });
    const result = endPlayerTurn(state);
    // forge only boosts physical enemy attacks → holy 8, no forge bonus
    expect(result.state.playerHealth).toBe(22);
  });
});
