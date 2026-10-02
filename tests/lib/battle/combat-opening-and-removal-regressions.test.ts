import { describe, expect, it } from "vitest";
import { createBattleStartState } from "@/lib/battle/battle-setup";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, computeTalentEffects, enemyBestiary } from "@/lib/game-data";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "../../fixtures/battle";

describe("opening resource gains", () => {
  const skeleton = enemyBestiary.find((enemy) => enemy.id === "skeleton")!;

  it("Last Stand strengthens opening Bulwark and Plated Armor", () => {
    const state = createBattleStartState({
      runDeck: [],
      currentEnemy: skeleton,
      playerHealth: 10,
      maxHealth: 40,
      talentEffects: computeTalentEffects({ armor: ["armor-start-combat", "armor-desperate-double"] }),
      gearEffects: { ...defaultGearEffects, startArmor: 2, flatArmorGained: 1 },
      rng: () => 0.99,
    });
    expect(state.playerStatuses.armor).toBe(6);
  });

  it("Desperate Forge strengthens opening Forge Mastery and Tempered Forge", () => {
    const state = createBattleStartState({
      runDeck: [],
      currentEnemy: skeleton,
      playerHealth: 10,
      maxHealth: 40,
      talentEffects: computeTalentEffects({ forge: ["forge-strength-1", "forge-strength-5"] }),
      gearEffects: { ...defaultGearEffects, startForge: 2, forgeReadiesPhysicalRepeat: 1 },
      rng: () => 0.99,
    });
    expect(state.playerStatuses.forge).toBe(4);
    expect(state.uniqueGear.everkeenReady).toBe(true);
  });

  it("Tempered Guard and Ironwood Buckler reward Bastioned opening Block", () => {
    const state = createBattleStartState({
      runDeck: [],
      currentEnemy: skeleton,
      talentEffects: computeTalentEffects({ forge: ["forge-to-block"] }),
      trinketIds: ["ironwood-buckler"],
      gearEffects: { ...defaultGearEffects, startForge: 4, startBlock: 4, flatBlockGained: 1 },
      rng: () => 0.99,
    });
    expect(state.playerStatuses.block).toBe(7);
    expect(state.playerStatuses.thorns).toBe(1);
  });
});

describe("enemy attack resource removal", () => {
  it("Crushing Force follows an attack whose Sundered Guard removes all Block", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 40,
      playerStatuses: { block: 2 },
      currentEnemy: {
        traits: [
          { id: "earth-elemental", title: "Crushing Force", description: "" },
          { id: "sundered-guard", title: "Sundered Guard", description: "" },
        ],
      },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, cardById["slash"]!, []);
    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Counterplate retaliates for Caustic Jab's explicit Armor removal", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 2 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      gearEffects: { stunOnArmorLostToAttack: 3 },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, cardById["caustic-jab"]!, []);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.enemyHealth).toBe(97);
    expect(result.enemyStatuses.stun).toBe(3);
  });

  it.each(["banshee", "unbinding-strike"])("Counterplate also retaliates when %s purges Armor", (trait) => {
    const state = patchBattleState({
      playerStatuses: { armor: 4 },
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: trait, title: trait, description: "" }] },
      gearEffects: { stunOnArmorLostToAttack: 3 },
      talentEffects: computeTalentEffects({ armor: ["armor-break-block"] }),
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(state, cardById["slash"]!, []);
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(3);
    expect(result.enemyHealth).toBe(97);
  });

  it("Lastlight retaliation settles before Distilled and Arcane Mending can rescue the hero", () => {
    const card = cardById["haste"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 1,
      playerMaxHealth: 40,
      deathsDoorUsed: true,
      mana: card.cost,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      gearEffects: { holyOnConsumeWithoutMana: 1, manaOnPaidConsume: 1 },
      talentEffects: computeTalentEffects({ mana: ["mana-arcane-mending"] }),
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.exhausted).toContain(card);
    expect(result.playerHealth).toBe(0);
    expect(result.mana).toBe(0);
  });

  it("Smelling Salts cannot waste Mana when neither targeted buildup is present", () => {
    const card = cardById["smelling-salts"]!;
    const state = patchBattleState({ hand: [card], playerStatuses: { burn: 2 } });
    expect(canPlayCard(state, card, 0)).toBe(false);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(canPlayCard({ ...state, playerStatuses: { ...state.playerStatuses, stun: 1 } }, card, 0)).toBe(true);
  });
});
