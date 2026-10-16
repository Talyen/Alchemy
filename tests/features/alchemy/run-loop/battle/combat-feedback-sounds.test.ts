import { describe, expect, it, vi, beforeEach } from "vitest";
import { playBattleEvent, playCardSound } from "@/lib/audio";
import {
  playCombatTextSounds,
  playResolvedCardSound,
  playCompanionSound,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import { mergeCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent } from "@/lib/battle";

vi.mock("@/lib/audio", () => ({ playBattleEvent: vi.fn(), playCardSound: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(playBattleEvent).mockImplementation((event) => `${event}.ogg`);
  vi.mocked(playCardSound).mockImplementation((card) => `${card}.ogg`);
});

describe("one sound selected from committed action results", () => {
  it("plays a typed critical once instead of layering a generic clash over a focal cue", () => {
    const events: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "burn", amount: 8, critical: true }];
    const sound = playResolvedCardSound("fireball", events);
    playCombatTextSounds(events, sound);
    expect(playBattleEvent).toHaveBeenCalledExactlyOnceWith("hitBurnCritical");
    expect(playCardSound).not.toHaveBeenCalled();
    const block: CombatTextEvent = { target: "player", kind: "status", stat: "block", amount: 20 };
    expect(selectCombatSound([...events, block], false)).toBe("blockGain");
    expect(selectCombatSound([...events, block], true)).toBeUndefined();
  });

  it("gives actual control priority while ignoring prepared, removed, immune and prevented outcomes", () => {
    const events: CombatTextEvent[] = [
      { target: "enemy", kind: "damage", stat: "physical", amount: 3, critical: true },
      { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
    ];
    expect(selectCombatSound(events, true)).toBe("freezeProc");
    expect(selectCombatSound([...events].reverse(), true)).toBe("freezeProc");
    expect(
      selectCombatSound(
        [
          { target: "player", kind: "notice", stat: "freeze", signal: "cleanse", text: "" },
          { target: "player", kind: "notice", stat: "stun", signal: "prepared", text: "" },
          { target: "enemy", kind: "notice", stat: "freeze", signal: "immune", text: "" },
          { target: "enemy", kind: "damage", stat: "physical", amount: 0, critical: true },
          { target: "enemy", kind: "damage", stat: "physical", amount: 9, critical: true, impact: false },
        ],
        true,
      ),
    ).toBeUndefined();
  });

  it("compares summed damage, actual healing and Block without counting resource units or stripping", () => {
    const events: CombatTextEvent[] = [
      { target: "enemy", kind: "damage", stat: "poison", amount: 3, periodic: true },
      { target: "enemy", kind: "damage", stat: "poison", amount: 2, periodic: true },
      { target: "player", kind: "status", stat: "mana", amount: 99 },
      { target: "player", kind: "heal", stat: "health", amount: 4 },
      { target: "enemy", kind: "damage", stat: "armor", amount: 300, impact: false },
    ];
    expect(selectCombatSound(events, false)).toBe("poisonTick");
    expect(selectCombatSound([...events, { target: "player", kind: "heal", stat: "health", amount: 2 }], false)).toBe(
      "playerHeal",
    );
    expect(selectCombatSound([...events, { target: "player", kind: "status", stat: "block", amount: 6 }], false)).toBe(
      "blockGain",
    );
    expect(selectCombatSound(events.slice(2), true)).toBeUndefined();
    const gain: CombatTextEvent = { target: "player", kind: "status", stat: "armor", amount: 3 };
    const strip: CombatTextEvent = { target: "enemy", kind: "damage", stat: "armor", amount: 1, impact: false };
    expect(selectCombatSound([strip], false)).toBeUndefined();
    expect(selectCombatSound([gain, strip], false)).toBe("armorGain");
  });

  it("uses resolved packet facts instead of overkill, blocked criticals, costs or stripped Block", () => {
    const heal: CombatTextEvent = { target: "player", kind: "heal", stat: "health", amount: 3 };
    const critical: CombatTextEvent = {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: 99,
      healthLost: 0,
      critical: true,
    };
    expect(selectCombatSound([critical, heal], false)).toBe("playerHeal");
    expect(selectCombatSound([{ ...critical, healthLost: 2 }, heal], false)).toBe("playerHeal");
    expect(
      selectCombatSound(
        [
          { target: "player", kind: "damage", stat: "block", amount: 1, absorbedDamage: 5 },
          { target: "player", kind: "damage", stat: "block", amount: 100, impact: false },
          heal,
        ],
        false,
      ),
    ).toBe("blockAbsorb");
    expect(
      selectCombatSound([{ target: "player", kind: "damage", stat: "health", amount: 40, impact: false }, heal], false),
    ).toBe("playerHeal");
    const sound = playResolvedCardSound("fireball", [{ ...critical, healthLost: 2 }], true);
    playCombatTextSounds([critical], sound);
    expect(playBattleEvent).toHaveBeenCalledExactlyOnceWith("deathsDoor");
  });

  it("preserves resolved totals while keeping actual periodic ticks separate from direct hits", () => {
    const events: CombatTextEvent[] = [];
    mergeCombatText(events, { target: "enemy", kind: "damage", stat: "poison", amount: 90, healthLost: 2 });
    mergeCombatText(events, {
      target: "enemy",
      kind: "damage",
      stat: "poison",
      amount: 1,
      healthLost: 1,
      critical: true,
    });
    mergeCombatText(events, { target: "enemy", kind: "damage", stat: "poison", amount: 1, periodic: true });
    expect(events).toHaveLength(2);
    expect(selectCombatSound(events, false)).toBe("hitPiercingCritical");
    expect(selectCombatSound([...events, { target: "player", kind: "heal", stat: "health", amount: 4 }], false)).toBe(
      "playerHeal",
    );
  });

  it("retains authored action identity but chooses actual branches and companion turn outcomes", () => {
    const hit: CombatTextEvent = { target: "enemy", kind: "damage", stat: "physical", amount: 3 };
    expect(playResolvedCardSound("slash", [hit])).toBe("slash.ogg");
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
    expect(playResolvedCardSound("slash", [{ ...hit, critical: true }])).toBe("slashCritical.ogg");
    expect(playResolvedCardSound("cinderbloom", [{ ...hit, stat: "poison" }])).toBe("hitPiercing.ogg");
    expect(
      playResolvedCardSound("molten-bulwark", [
        { ...hit, stat: "burn" },
        { target: "player", kind: "status", stat: "block", amount: 4 },
      ]),
    ).toBe("blockGain.ogg");
    expect(playResolvedCardSound("astral-arrow", [{ ...hit, stat: "freeze" }])).toBe("astralFreeze.ogg");
    expect(playResolvedCardSound("astral-arrow", [{ ...hit, stat: "poison", critical: true }])).toBe(
      "astralPiercingCritical.ogg",
    );
    playCompanionSound("wolf", [{ ...hit, stat: "bleed" }]);
    expect(playBattleEvent).toHaveBeenLastCalledWith("hitPiercing");
    expect(playCardSound).toHaveBeenCalledTimes(1);
  });
});
