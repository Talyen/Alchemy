import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import { beforeEach, expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readBattle, readActiveRun } from "@/features/alchemy/shared/stores/session/run-reads";
import { resetRunDomainStore } from "../../../../../helpers/run-domain-store-test";
import { makeActiveRunData } from "../session/active-run-data-fixture";
import { defaultBattleState } from "@/lib/battle";
import { cardById, enemyById, createEffectDescription, withCardDescription } from "@/lib/game-data";
import { parseActiveRun } from "@/lib/validation/parse-active-run";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";

beforeEach(resetRunDomainStore);

function savedBattle(legacy = true) {
  const source = cardById.slash!;
  const effects = [...source.effects, { kind: "dodge-next-attack" as const }];
  const card = legacy
    ? withCardDescription({ ...source, effects, transmuted: "dodge" }, createEffectDescription(effects))
    : getTransmutationVariants(source, "dodge", [source])[0]!.result;
  const battle = defaultBattleState();
  return makeActiveRunData({
    runDeck: [card, cardById.block!, cardById.bash!, cardById.heal!, cardById["plate-mail"]!],
    runPlayerHealth: 23,
    roomsEncountered: 6,
    currentAct: 2,
    destinationIndexInAct: 3,
    completedDestinations: ["Campfire"],
    encounteredRunEnemyIds: ["goblin"],
    runTalentXP: { dodge: 2 },
    runGoldEarned: 7,
    activity: {
      kind: "battle",
      data: {
        battleState: {
          ...battle,
          turn: 8,
          playerHealth: 10,
          enemyHealth: 2,
          currentEnemy: enemyById.goblin!,
          difficultyModifiers: [{ kind: "increase-enemy-damage", amount: 2 }],
          hand: [{ ...card, uid: 3 }],
          flags: { ...battle.flags, dodgeNextAttack: true },
        },
      },
    },
  });
}

it("restarts only the ambiguous legacy encounter once without advancing run progression", () => {
  const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const saved = savedBattle();
    saved.rng.counters.world = 13;
    const parsed = parseActiveRun(JSON.parse(JSON.stringify(saved)))!;
    restoreRun(parsed, {}, {}, defaultGameSession);
    const battle = readBattle(defaultGameSession).battleState!;
    expect(battle.currentEnemy.id).toBe("goblin");
    expect(battle.difficultyModifiers).toEqual([{ kind: "increase-enemy-damage", amount: 2 }]);
    expect(battle.turn).toBe(1);
    expect(battle.roomScalingMultiplier).toBe(1.35);
    expect(battle.playerHealth).toBe(23);
    expect(battle.flags).toMatchObject({ dodgeNextAttack: false, dodgeNextAttackChance: 0 });
    const run = readActiveRun(defaultGameSession);
    expect(run).toMatchObject({
      roomsEncountered: 6,
      currentAct: 2,
      destinationIndexInAct: 3,
      completedDestinations: ["Campfire"],
      encounteredRunEnemyIds: ["goblin"],
      runTalentXP: { dodge: 2 },
      runGoldEarned: 7,
    });
    expect(run.rng.counters.world).toBeGreaterThan(13);
    expect(run.runDeck[0]!.effects.at(-1)).toEqual({ kind: "dodge-next-attack", probability: 0.5 });
    expect(diagnostic).toHaveBeenCalledTimes(1);
    const next = snapshotRun(defaultGameSession);
    restoreRun(parseActiveRun(JSON.parse(JSON.stringify(next))), {}, {}, defaultGameSession);
    expect(readBattle(defaultGameSession).battleState).toEqual(battle);
    expect(readActiveRun(defaultGameSession).rng).toEqual(next.rng);
    expect(diagnostic).toHaveBeenCalledTimes(1);
  } finally {
    diagnostic.mockRestore();
  }
});

it.each([false, true])("current chance/native guarantees resume without restart (Elusive=%s)", (elusive) => {
  const saved = savedBattle(false);
  if (saved.activity.kind !== "battle") throw new Error("Expected battle fixture");
  if (elusive) saved.activity.data.battleState.flags.dodgeNextAttackChance = 50;
  else {
    saved.activity.data.battleState.hand = [cardById.feint!];
    saved.runDeck = [cardById.feint!];
  }
  const parsed = parseActiveRun(JSON.parse(JSON.stringify(saved)))!;
  restoreRun(parsed, {}, {}, defaultGameSession);
  const battle = readBattle(defaultGameSession).battleState!;
  expect(battle.turn).toBe(8);
  expect(battle.enemyHealth).toBe(2);
  expect(battle.playerHealth).toBe(10);
  expect(battle.flags).toMatchObject({ dodgeNextAttack: true, dodgeNextAttackChance: elusive ? 50 : 0 });
  expect(readActiveRun(defaultGameSession).rng).toEqual(saved.rng);
});
