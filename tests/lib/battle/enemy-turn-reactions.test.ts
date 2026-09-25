import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { cardById, enemyBestiary } from "@/lib/game-data";
import { describe, expect, it } from "vitest";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";

describe("applyEnemyAbility: reactions", () => {
  it("applies the Fire Imp follow-up once after a multi-hit ability", () => {
    const state = patchBattleState({
      currentEnemy: enemyBestiary.find((enemy) => enemy.id === "fire-imp")!,
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0 },
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "physical", amount: 2 },
        ],
      }),
      makeTexts(),
    );

    expect(result.playerHealth).toBeLessThan(state.playerHealth - 2);
    expect(result.playerStatuses.burn).toBe(1);
  });

  it("banshee purges a single random beneficial status", () => {
    const banshee = enemyBestiary.find((e) => e.id === "banshee")!;
    const stunHit = () => makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] });

    const onlyBlock = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 10 },
      rng: () => 0.99,
    });
    const blockTexts = makeTexts();
    const purgedBlock = applyEnemyAbility(onlyBlock, stunHit(), blockTexts);
    expect(purgedBlock.playerStatuses.block).toBe(0);
    expect(blockTexts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "block",
      text: "Purged",
      signal: "purge",
    });

    const crowded = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 2, thorns: 2, forge: 1, haste: 1, phoenixFeather: 1 },
      rng: () => 0.99,
    });
    const crowdedTexts = makeTexts();
    const purgedOne = applyEnemyAbility(crowded, stunHit(), crowdedTexts);
    const purgeNotices = crowdedTexts.filter((text) => text.kind === "notice" && text.text === "Purged");
    expect(purgeNotices).toHaveLength(1);
    const purgedStat = purgeNotices[0]!.stat;
    expect(["block", "armor", "thorns", "forge", "haste", "phoenixFeather"]).toContain(purgedStat);
    expect(purgedOne.playerStatuses[purgedStat as "block"]).toBe(0);
    // Thorns always ends at zero: purged, or consumed by retaliation.
    expect(purgedOne.playerStatuses.thorns).toBe(0);
    if (purgedStat === "block") {
      expect(purgedOne.playerStatuses.block).toBe(0);
    } else {
      // Unpurged Block still absorbs the hit.
      expect(purgedOne.playerStatuses.block).toBeGreaterThan(0);
      expect(purgedOne.playerStatuses.block).toBeLessThan(10);
    }
    for (const stat of ["armor", "forge", "haste", "phoenixFeather"] as const) {
      if (stat !== purgedStat) expect(purgedOne.playerStatuses[stat]).toBe(crowded.playerStatuses[stat]);
    }
  });

  it("does not show Purge feedback when the player has no beneficial status", () => {
    const state = patchBattleState({
      currentEnemy: enemyBestiary.find((enemy) => enemy.id === "banshee")!,
      playerHealth: 30,
      rng: () => 0.99,
    });
    const texts = makeTexts();
    applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      texts,
    );
    expect(texts.some((event) => event.kind === "notice" && event.signal === "purge")).toBe(false);
  });

  it("banshee purges thorns without retaliation and purges phoenix feather", () => {
    const banshee = enemyBestiary.find((e) => e.id === "banshee")!;
    const physicalHit = () => makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });

    const thorny = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      enemyHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      rng: () => 0.99,
    });
    const thornTexts = makeTexts();
    const purgedThorns = applyEnemyAbility(thorny, physicalHit(), thornTexts);
    expect(purgedThorns.playerStatuses.thorns).toBe(0);
    expect(purgedThorns.enemyHealth).toBe(30);
    expect(thornTexts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "thorns",
      text: "Purged",
      signal: "purge",
    });

    const feathered = patchBattleState({
      currentEnemy: banshee,
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, phoenixFeather: 1 },
      rng: () => 0.99,
    });
    const featherTexts = makeTexts();
    const purgedFeather = applyEnemyAbility(
      feathered,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 4 }] }),
      featherTexts,
    );
    expect(purgedFeather.playerStatuses.phoenixFeather).toBe(0);
    expect(featherTexts).toContainEqual({
      target: "player",
      kind: "notice",
      stat: "phoenixFeather",
      text: "Purged",
      signal: "purge",
    });
  });

  it("blood-countess damages itself only on actual hero healing", async () => {
    const { applyEnemyHealingWithCombatText } = await import("@/lib/battle/enemy-healing");
    const { applyHealingWithCombatText } = await import("@/lib/battle/player-rewards");
    const countessState = patchBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 10,
      enemyMaxHealth: 10,
    });
    const healed = applyHealingWithCombatText(countessState, 5, []);
    expect(healed.enemyHealth).toBe(9);
    expect(healed.playerHealth).toBe(25);

    const enemyHealState = patchBattleState({
      currentEnemy: enemyBestiary.find((e) => e.id === "blood-countess")!,
      playerHealth: 20,
      playerMaxHealth: 30,
      enemyHealth: 5,
      enemyMaxHealth: 10,
    });
    const enemyHealed = applyEnemyHealingWithCombatText(enemyHealState, 3, []);
    expect(enemyHealed.enemyHealth).toBe(8);
  });
});

describe("player Thorns", () => {
  it("fires held thorns back as nature damage when an attack lands and consumes the stack", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(25);
    expect(result.enemyHealth).toBe(27);
    expect(result.playerStatuses.thorns).toBe(0);
  });

  it("still fires when block absorbs the hit", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 10, armor: 0, thorns: 2 },
      enemyHealth: 30,
      rng: () => 0.99,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyHealth).toBe(28);
    expect(result.playerStatuses.thorns).toBe(0);
  });

  it("does not fire when the attack is dodged", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerStatuses: { block: 0, armor: 0, thorns: 3 },
      enemyHealth: 30,
      rng: () => 0.01,
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] }),
      makeTexts(),
    );
    expect(result.playerHealth).toBe(30);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.thorns).toBe(3);
  });

  it("reports Cold Snap Freeze buildup added by doubling, rather than the multiplier", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { freeze: 4 },
    });
    const texts = makeTexts();
    const result = applyEnemyAbility(state, cardById["cold-snap"]!, texts);
    expect(result.playerStatuses.freeze).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "multiply", stat: "freeze", amount: 5 });
  });
});
