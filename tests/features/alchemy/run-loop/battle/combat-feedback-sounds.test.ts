import { describe, expect, it, vi, beforeEach } from "vitest";
import { playBattleEvent } from "@/lib/audio";
import { playCombatTextSounds } from "@/features/alchemy/run-loop/battle/controller-utils";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import type { CombatTextEvent } from "@/lib/battle";

vi.mock("@/lib/audio", () => ({ playBattleEvent: vi.fn(), playCardSound: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("one focal cue and one resolved accent", () => {
  it("suppresses routine damage, healing, Gold and statuses after an authored cue", () => {
    playCombatTextSounds(
      [
        { target: "enemy", kind: "damage", stat: "physical", amount: 8 },
        { target: "player", kind: "heal", stat: "health", amount: 3 },
        { target: "player", kind: "status", stat: "gold", amount: 4 },
        { target: "player", kind: "status", stat: "armor", amount: 5 },
      ],
      "focal.ogg",
    );
    expect(playBattleEvent).not.toHaveBeenCalled();
    playCombatTextSounds(
      [
        { target: "enemy", kind: "damage", stat: "physical", amount: 8, critical: true },
        { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
        { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" },
      ],
      "focal.ogg",
    );
    expect(playBattleEvent).toHaveBeenCalledExactlyOnceWith("critHit", { excludeSound: "focal.ogg" });
  });

  it("uses fixed accent priority independently of text order, ignoring prepared and removed controls", () => {
    const events: CombatTextEvent[] = [
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" },
      { target: "enemy", kind: "notice", stat: "dodge", text: "Dodged" },
      { target: "enemy", kind: "damage", stat: "physical", amount: 3, critical: true },
      { target: "enemy", kind: "notice", stat: "burn", text: "Wildfire" },
      { target: "enemy", kind: "notice", stat: "physical", text: "Shatter · Critical" },
    ];
    for (const expected of ["shatter", "wildfire", "critHit", "dodge", "freezeProc", "stunProc"]) {
      expect(selectCombatSound(events, true)).toBe(expected);
      expect(selectCombatSound([...events].reverse(), true)).toBe(expected);
      events.pop();
    }
    expect(
      selectCombatSound(
        [
          { target: "player", kind: "notice", stat: "freeze", signal: "cleanse", text: "" },
          { target: "player", kind: "notice", stat: "stun", signal: "prepared", text: "" },
          { target: "enemy", kind: "damage", stat: "physical", amount: 0, critical: true },
          { target: "enemy", kind: "damage", stat: "physical", amount: 9, critical: true, impact: false },
        ],
        true,
      ),
    ).toBeUndefined();
  });

  it("compares only damage magnitudes, uses periodic Poison, and keeps resource units separate", () => {
    const events: CombatTextEvent[] = [
      { target: "enemy", kind: "damage", stat: "burn", amount: 3, periodic: true },
      { target: "enemy", kind: "damage", stat: "poison", amount: 5, periodic: true },
      { target: "player", kind: "status", stat: "mana", amount: 99 },
      { target: "player", kind: "heal", stat: "health", amount: 100 },
      { target: "enemy", kind: "damage", stat: "armor", amount: 300, impact: false },
    ];
    expect(selectCombatSound(events, false)).toBe("poisonTick");
    events[0] = { target: "enemy", kind: "damage", stat: "burn", amount: 5, periodic: true };
    expect(selectCombatSound([...events].reverse(), false)).toBe("burnTick");
    expect(selectCombatSound(events.slice(2), false)).toBe("playerHeal");
    expect(selectCombatSound(events.slice(2), true)).toBeUndefined();

    const gain: CombatTextEvent = { target: "player", kind: "status", stat: "armor", amount: 3 };
    const strip: CombatTextEvent = { target: "enemy", kind: "damage", stat: "armor", amount: 1, impact: false };
    expect(selectCombatSound([gain], false)).toBe("armorGain");
    expect(selectCombatSound([strip], false)).toBeUndefined();
    // Silent stripping must not swallow the standalone gain cue during Armor theft.
    expect(selectCombatSound([gain, strip], false)).toBe("armorGain");
    expect(selectCombatSound([strip, gain], false)).toBe("armorGain");
    expect(selectCombatSound([gain, strip], true)).toBeUndefined();
  });
});
