import { describe, expect, it } from "vitest";
import {
  ANOMALY_METRICS,
  ANOMALY_THRESHOLD_BY_PRESET,
  createEmptyAnomalies,
  getAnomalyThreshold,
  sampleAnomalies,
} from "@/lib/balance/anomalies";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState } from "../../fixtures/battle";

describe("getAnomalyThreshold", () => {
  it("returns tiered thresholds", () => {
    expect(getAnomalyThreshold("early")).toBe(ANOMALY_THRESHOLD_BY_PRESET.early);
    expect(getAnomalyThreshold("mid")).toBe(200);
    expect(getAnomalyThreshold("late")).toBe(300);
  });
});

describe("createEmptyAnomalies", () => {
  it("zeros every registered anomaly metric", () => {
    const anomalies = createEmptyAnomalies();
    for (const { key } of ANOMALY_METRICS) {
      expect(anomalies[key]).toBe(0);
    }
  });
});

describe("sampleAnomalies", () => {
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
    });
  });
  it("records status peaks from battle state", () => {
    const anomalies = createEmptyAnomalies();
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 50 },
    });
    sampleAnomalies(state, [], anomalies);
    expect(anomalies.maxPlayerBurn).toBe(50);
  });

  it("never lowers an existing peak", () => {
    const anomalies = createEmptyAnomalies();
    anomalies.maxPlayerBurn = 50;
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 10 },
    });
    sampleAnomalies(state, [], anomalies);
    expect(anomalies.maxPlayerBurn).toBe(50);
  });

  it("records single-hit damage and heal from combat text", () => {
    const anomalies = createEmptyAnomalies();
    const state = makeTestBattleState();
    const texts: CombatTextEvent[] = [
      { target: "enemy", kind: "damage", stat: "physical", amount: 99 },
      { target: "player", kind: "heal", stat: "health", amount: 12 },
    ];
    sampleAnomalies(state, texts, anomalies, "bash");
    expect(anomalies.maxSingleHitDamageToEnemy).toBe(99);
    expect(anomalies.maxSingleHitDamageToEnemyStat).toBe("physical");
    expect(anomalies.maxSingleHitDamageToEnemyCardId).toBe("bash");
    expect(anomalies.maxSingleHeal).toBe(12);
  });

  it("records damage stat for the true peak hit to the enemy", () => {
    const anomalies = createEmptyAnomalies();
    const state = makeTestBattleState();
    sampleAnomalies(state, [{ target: "enemy", kind: "damage", stat: "burn", amount: 40 }], anomalies);
    sampleAnomalies(state, [{ target: "enemy", kind: "damage", stat: "physical", amount: 25 }], anomalies);
    expect(anomalies.maxSingleHitDamageToEnemy).toBe(40);
    expect(anomalies.maxSingleHitDamageToEnemyStat).toBe("burn");
  });

  it("ignores notice combat text", () => {
    const anomalies = createEmptyAnomalies();
    const state = makeTestBattleState();
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "notice", stat: "physical", text: "Immune" }];
    sampleAnomalies(state, texts, anomalies);
    expect(anomalies.maxSingleHitDamageToEnemy).toBe(0);
    expect(anomalies.maxSingleHeal).toBe(0);
  });

  it("monotonically increases peaks across multiple samples", () => {
    const anomalies = createEmptyAnomalies();
    sampleAnomalies(
      makeTestBattleState({
        enemyStatuses: { ...makeTestBattleState().enemyStatuses, poison: 4 },
      }),
      [{ target: "enemy", kind: "damage", stat: "physical", amount: 10 }],
      anomalies,
    );
    sampleAnomalies(
      makeTestBattleState({
        enemyStatuses: { ...makeTestBattleState().enemyStatuses, poison: 9 },
      }),
      [{ target: "enemy", kind: "damage", stat: "physical", amount: 25 }],
      anomalies,
    );
    expect(anomalies.maxEnemyPoison).toBe(9);
    expect(anomalies.maxSingleHitDamageToEnemy).toBe(25);
  });
});
