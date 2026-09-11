import { describe, expect, it, vi } from "vitest";
import { playBattleEvent } from "@/lib/audio";
import { playCombatTextSounds } from "@/features/alchemy/run-loop/battle/controller-utils";

vi.mock("@/lib/audio", () => ({ playBattleEvent: vi.fn(), playCardSound: vi.fn() }));

describe("action sound consolidation", () => {
  it("requests each sound family once per action and plays a fresh hit for the next action", () => {
    playCombatTextSounds([
      { target: "enemy", kind: "damage", stat: "physical", amount: 4 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 3 },
      { target: "player", kind: "damage", stat: "physical", amount: 1 },
      { target: "player", kind: "damage", stat: "poison", amount: 2 },
      { target: "player", kind: "damage", stat: "block", amount: 2 },
      { target: "player", kind: "heal", stat: "health", amount: 3 },
      { target: "player", kind: "heal", stat: "health", amount: 4 },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" },
    ]);
    expect(vi.mocked(playBattleEvent).mock.calls.map(([event]) => event)).toEqual([
      "enemyHit",
      "playerHit",
      "blockAbsorb",
      "playerHeal",
      "stunProc",
      "freezeProc",
    ]);
    playCombatTextSounds([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
    expect(playBattleEvent).toHaveBeenCalledTimes(7);
    expect(playBattleEvent).toHaveBeenLastCalledWith("enemyHit");
  });
});
