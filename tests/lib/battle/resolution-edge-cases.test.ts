import { expect, it, vi } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { resolveBattleStart } from "@/lib/battle/battle-start";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { upgradeWishCard } from "@/lib/battle/wish";
import { createEffectDescription, withCardDescription } from "@/lib/game-data";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

it("a skipped enemy turn stops Burn ticks after Counterplate defeats a Crimson Pulse enemy", () => {
  const state = regressionBattle({
    turn: 3,
    playerHealth: 20,
    playerMaxHealth: 30,
    playerStatuses: { armor: 1, burn: 5 },
    enemyHealth: 1,
    enemyMaxHealth: 30,
    enemyCC: { stunSkipTurns: 1 },
    currentEnemy: { traits: [{ id: "crimson-pulse", title: "Crimson Pulse", description: "" }] },
    gearEffects: { stunOnArmorLostToAttack: 2 },
  });
  const result = endPlayerTurn(state).state;
  expect(result.enemyHealth).toBe(0);
  expect(result.playerHealth).toBe(19);
  expect(result.playerStatuses.burn).toBe(5);
});

it("turn-start retaliation can defeat the enemy before any ability is performed", () => {
  const state = regressionBattle({
    turn: 3,
    playerHealth: 20,
    playerMaxHealth: 30,
    playerStatuses: { armor: 1 },
    enemyHealth: 1,
    enemyMaxHealth: 30,
    currentEnemy: { traits: [{ id: "crimson-pulse", title: "Crimson Pulse", description: "" }] },
    gearEffects: { stunOnArmorLostToAttack: 2 },
    lastEnemyAbilityId: "slash",
  });
  const result = endPlayerTurn(state);
  expect(result.state.enemyHealth).toBe(0);
  expect(result.enemyPerformedAbility).toBe(false);
  expect(result).not.toHaveProperty("afterAbilityState");
  expect(result.state.lastEnemyAbilityId).toBe("slash");
});

it("turn-start retaliation can Stun the enemy before it chooses an ability", () => {
  const state = regressionBattle({
    turn: 3,
    playerHealth: 20,
    playerMaxHealth: 30,
    playerStatuses: { armor: 1 },
    enemyHealth: 20,
    enemyMaxHealth: 30,
    enemyStatuses: { stun: 9 },
    currentEnemy: { traits: [{ id: "crimson-pulse", title: "Crimson Pulse", description: "" }] },
    gearEffects: { stunOnArmorLostToAttack: 2 },
    lastEnemyAbilityId: "slash",
  });
  const result = endPlayerTurn(state);
  expect(result.kind).toBe("skipped");
  expect(result.enemyPerformedAbility).toBe(false);
  expect(result).not.toHaveProperty("afterAbilityState");
  expect(result.state.lastEnemyAbilityId).toBe("slash");
  expect(result.state.enemyCC.stunSkipTurns).toBe(0);
  expect(result.state.enemyCC.cooldown).toBeGreaterThan(0);
});

it("does not discard or shuffle the hand after Restorative ends the battle", () => {
  const rng = vi.fn(() => 0.5);
  const hand = [makeTestCard({ id: "held-one" }), makeTestCard({ id: "held-two" })];
  const state = regressionBattle({
    rng,
    hand,
    deck: [],
    discard: [],
    playerHealth: 10,
    playerMaxHealth: 30,
    enemyHealth: 1,
    enemyMaxHealth: 30,
    encounterBenefits: ["restorative"],
    currentEnemy: { traits: [{ id: "blood-countess", title: "Blood Countess", description: "" }] },
  });
  const result = endPlayerTurn(state);
  expect(result.state.enemyHealth).toBe(0);
  expect(result.state.hand).toEqual(hand);
  expect(result.state.deck).toEqual([]);
  expect(result.enemyPerformedAbility).toBe(false);
  expect(rng).not.toHaveBeenCalled();
});

it("retains opening Purge feedback without a Companion", () => {
  const base = regressionBattle({ gearEffects: { turnStartPurgeChance: 100, holyOnPurge: 1 } });
  const opening = resolveBattleStart(
    {
      runDeck: [makeTestCard()],
      currentEnemy: {
        ...base.currentEnemy,
        traits: [{ id: "starting-block", title: "Starting Block", description: "" }],
      },
      gearEffects: base.gearEffects,
    },
    { rng: () => 0.5 },
  );
  expect(opening.companion).toBeNull();
  expect(opening.startingTexts).toContainEqual(expect.objectContaining({ signal: "purge", stat: "block" }));
  expect(opening.startingTexts).toContainEqual(expect.objectContaining({ kind: "damage", stat: "holy" }));
});

it("does not draw or announce a Companion after opening gear wins combat", () => {
  const base = regressionBattle({ gearEffects: { startFreeze: 10000 } });
  const deck = Array.from({ length: 5 }, (_, index) => makeTestCard({ id: `card-${index}` }));
  const opening = resolveBattleStart(
    {
      runDeck: deck,
      currentEnemy: { ...base.currentEnemy, traits: [] },
      gearEffects: base.gearEffects,
      difficultyModifiers: [{ kind: "start-companion", companionId: "wolf" }],
    },
    { rng: () => 0.5 },
  );
  expect(opening.outcome).toBe("victory");
  expect(opening.companion).toBeNull();
  expect(opening.state.hand).toEqual([]);
  expect(opening.state.deck).toHaveLength(deck.length);
});

it("a utility Chance branch preserves Brawler's pending attack penalty", () => {
  const card = makeTestCard({
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
        failureEffects: [{ kind: "player-status", status: "block", amount: 1 }],
      },
    ],
  });
  const state = regressionBattle({ flags: { enemyBrawlerDamagePenalty: true } });
  const result = applyEnemyAbility(state, card, []);
  expect(result.enemyMitigation.block).toBe(1);
  expect(result.flags.enemyBrawlerDamagePenalty).toBe(true);
});

it("Wish upgrades both bounds of a fixed random range atomically", () => {
  const effects = [{ kind: "random-damage" as const, minAmount: 1, maxAmount: 1 }];
  const card = withCardDescription(makeTestCard({ effects }), createEffectDescription(effects));
  expect(upgradeWishCard(card).effects).toEqual([{ kind: "random-damage", minAmount: 2, maxAmount: 2 }]);
});

it("an attack penalty earned during Brawler's multi-hit ability survives its later hits", () => {
  const state = regressionBattle({
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerStatuses: { armor: 1 },
    enemyStatuses: { stun: 49 },
    gearEffects: { stunOnArmorLostToAttack: 2 },
    flags: { enemyBrawlerDamagePenalty: true },
    currentEnemy: { traits: [{ id: "brawler", title: "Brawler", description: "" }] },
  });
  const hit = { kind: "damage" as const, damageType: "physical" as const, amount: 4 };
  const result = applyEnemyAbility(state, makeTestCard({ effects: [hit, hit] }), []);
  expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  expect(result.flags.enemyBrawlerDamagePenalty).toBe(true);
});
