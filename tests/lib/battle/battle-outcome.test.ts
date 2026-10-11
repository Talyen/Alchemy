import { describe, expect, it, vi } from "vitest";
import { getBattleOutcome } from "@/lib/battle/battle-outcome";
import { resolveBattleTurn } from "@/lib/battle/enemy-turn";
import { resolveBattleSequence } from "@/lib/battle/battle-sequence";
import { makeTestBattleState } from "../../fixtures/battle";

describe("battle completion boundaries", () => {
  it.each([
    { playerHealth: 10, enemyHealth: 0, deathsDoorActive: false, outcome: "victory" },
    { playerHealth: 0, enemyHealth: 10, deathsDoorActive: false, outcome: "defeat" },
    { playerHealth: 0, enemyHealth: 0, deathsDoorActive: false, outcome: "defeat" },
    { playerHealth: 0, enemyHealth: 0, deathsDoorActive: true, outcome: "victory" },
  ] as const)(
    "does not advance $outcome or consume RNG at hero $playerHealth / enemy $enemyHealth, Death's Door $deathsDoorActive",
    ({ outcome, ...health }) => {
      const state = makeTestBattleState(health);
      const rng = vi.fn(() => {
        throw new Error("Completed combat must not draw RNG");
      });
      const result = resolveBattleTurn(state, { rng });
      expect(getBattleOutcome(result.state)).toBe(outcome);
      expect(result.frames).toEqual([]);
      expect(result.state.turn).toBe(state.turn);
      expect(rng).not.toHaveBeenCalled();
    },
  );

  it("keeps victory rewards inside an action while stopping subsequent turn steps", () => {
    const state = makeTestBattleState({ enemyHealth: 1, gold: 0 });
    const steps = ["kill", "reward"] as const;
    const resolve = (current: typeof state, step: (typeof steps)[number]) =>
      step === "kill" ? { ...current, enemyHealth: 0 } : { ...current, gold: current.gold + 5 };
    const action = resolveBattleSequence(state, steps, [], resolve, { kind: "enclosing-action" });
    const turn = resolveBattleSequence(state, steps, [], resolve, { kind: "enclosing-action" }, "either-defeated");
    expect(action).toMatchObject({ enemyHealth: 0, gold: 5 });
    expect(turn).toMatchObject({ enemyHealth: 0, gold: 0 });
  });
});
