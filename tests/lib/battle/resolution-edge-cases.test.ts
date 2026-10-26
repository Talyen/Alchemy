import { expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { upgradeWishCard } from "@/lib/battle/wish";
import { createEffectDescription, withCardDescription } from "@/lib/game-data";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

it("a skipped enemy turn stops Burn ticks after Counterplate defeats a Crimson Pulse enemy", () => {
  const state = regressionBattle({
    turn: 2,
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
