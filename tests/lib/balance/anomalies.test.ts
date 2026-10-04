import { describe, expect, it } from "vitest";
import { createEmptyAnomalies, sampleAnomalies } from "@/lib/balance/anomalies";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";

describe("battle anomaly collection", () => {
  it("separates enemy healing and defense grants from hero Health damage", () => {
    const anomalies = createEmptyAnomalies();
    sampleAnomalies(
      makeTestBattleState(),
      [
        { target: "enemy", kind: "heal", stat: "health", amount: 3 },
        { target: "player", kind: "heal", stat: "health", amount: 9 },
        { target: "enemy", kind: "status", stat: "block", amount: 5 },
        { target: "enemy", kind: "status", stat: "armor", amount: 2 },
        { target: "player", kind: "damage", stat: "block", amount: 4 },
        { target: "player", kind: "damage", stat: "bleed", amount: 2 },
      ],
      anomalies,
    );
    expect(anomalies).toMatchObject({
      enemyHealing: 3,
      heroHealthDamage: 2,
      enemyBlockGranted: 5,
      enemyArmorGranted: 2,
      maxSingleHeal: 9,
    });
  });

  it("retains status peaks across samples and reads enemy defenses from mitigation", () => {
    const anomalies = createEmptyAnomalies();
    sampleAnomalies(
      patchBattleState({ playerStatuses: { burn: 50, thorns: 15, forge: 8 }, enemyStatuses: { thorns: 20 } }),
      [],
      anomalies,
    );
    sampleAnomalies(
      patchBattleState({ playerStatuses: { burn: 10 }, enemyMitigation: { armor: 30, block: 40 } }),
      [],
      anomalies,
    );
    expect(anomalies).toMatchObject({
      maxPlayerBurn: 50,
      maxPlayerThorns: 15,
      maxPlayerForge: 8,
      maxEnemyThorns: 20,
      maxEnemyArmor: 30,
      maxEnemyBlock: 40,
    });
  });

  it("keeps each side's true peak and its source together through lower hits, ties and notices", () => {
    const anomalies = createEmptyAnomalies();
    const state = makeTestBattleState();
    sampleAnomalies(state, [{ target: "enemy", kind: "damage", stat: "burn", amount: 40 }], anomalies, "fireball");
    sampleAnomalies(state, [{ target: "player", kind: "damage", stat: "physical", amount: 25 }], anomalies, "bash");
    sampleAnomalies(
      state,
      [
        { target: "enemy", kind: "damage", stat: "physical", amount: 25 },
        { target: "player", kind: "damage", stat: "burn", amount: 25 },
        { target: "enemy", kind: "notice", stat: "physical", text: "Immune" },
      ],
      anomalies,
      "later-card",
    );
    expect(anomalies).toMatchObject({
      maxSingleHitDamageToEnemy: 40,
      maxSingleHitDamageToEnemyStat: "burn",
      maxSingleHitDamageToEnemyCardId: "fireball",
      maxSingleHitDamageToPlayer: 25,
      maxSingleHitDamageToPlayerStat: "physical",
      maxSingleHitDamageToPlayerCardId: "bash",
      maxSingleHeal: 0,
    });
  });
});
