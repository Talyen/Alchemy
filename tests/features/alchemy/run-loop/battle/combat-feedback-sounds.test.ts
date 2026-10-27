import { describe, expect, it, vi, beforeEach } from "vitest";
import { playBattleEvent, playCardSound } from "@/lib/audio";
import { battleEventSounds } from "@/lib/audio/sound-registry";
import { playCombatTextSounds, playResolvedCombatSound } from "@/features/alchemy/run-loop/battle/controller-utils";
import { selectCombatSound } from "@/features/alchemy/run-loop/battle/combat-sound-selection";
import { mergeCombatText } from "@/lib/battle/combat-text-events";
import type { CombatTextEvent } from "@/lib/battle";

vi.mock("@/lib/audio", () => ({ playBattleEvent: vi.fn(), playCardSound: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(playBattleEvent).mockImplementation((event) => battleEventSounds[event] ?? undefined);
  vi.mocked(playCardSound).mockImplementation((card) => `${card}.ogg`);
});

describe("one sound selected from committed action results", () => {
  it("plays a typed critical once instead of layering a generic clash over a focal cue", () => {
    const events: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "burn", amount: 8, critical: true }];
    const sound = playResolvedCombatSound("fireball", events);
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
    const sound = playResolvedCombatSound("fireball", [{ ...critical, healthLost: 2 }], true);
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
    for (const packets of [
      [
        { target: "player", kind: "damage", stat: "block", amount: 3 },
        { target: "player", kind: "damage", stat: "block", amount: 1, absorbedDamage: 2 },
      ],
      [
        { target: "player", kind: "damage", stat: "block", amount: 1, absorbedDamage: 2 },
        { target: "player", kind: "damage", stat: "block", amount: 3 },
      ],
    ] satisfies CombatTextEvent[][]) {
      const combined: CombatTextEvent[] = [];
      for (const packet of packets) mergeCombatText(combined, packet);
      expect(combined).toEqual([{ target: "player", kind: "damage", stat: "block", amount: 4, absorbedDamage: 5 }]);
      expect(
        selectCombatSound([...combined, { target: "player", kind: "heal", stat: "health", amount: 4 }], false),
      ).toBe("blockAbsorb");
    }
  });

  it("retains authored action identity but chooses actual branches and companion turn outcomes", () => {
    const hit: CombatTextEvent = { target: "enemy", kind: "damage", stat: "physical", amount: 3 };
    expect(playResolvedCombatSound("slash", [hit])).toBe("slash.ogg");
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
    expect(playResolvedCombatSound("slash", [{ ...hit, critical: true }])).toBe(battleEventSounds.slashCritical);
    expect(playBattleEvent).toHaveBeenLastCalledWith("slashCritical");
    expect(playResolvedCombatSound("cinderbloom", [{ ...hit, stat: "poison" }])).toBe(battleEventSounds.hitPiercing);
    expect(playBattleEvent).toHaveBeenLastCalledWith("hitPiercing");
    expect(
      playResolvedCombatSound("molten-bulwark", [
        { ...hit, stat: "burn" },
        { target: "player", kind: "status", stat: "block", amount: 4 },
      ]),
    ).toBe(battleEventSounds.blockGain);
    expect(playBattleEvent).toHaveBeenLastCalledWith("blockGain");
    expect(playResolvedCombatSound("astral-arrow", [{ ...hit, stat: "freeze" }])).toBe(battleEventSounds.astralFreeze);
    expect(playBattleEvent).toHaveBeenLastCalledWith("astralFreeze");
    expect(playResolvedCombatSound("astral-arrow", [{ ...hit, stat: "poison", critical: true }])).toBe(
      battleEventSounds.astralPiercingCritical,
    );
    expect(playBattleEvent).toHaveBeenLastCalledWith("astralPiercingCritical");
    playResolvedCombatSound(undefined, [{ ...hit, stat: "bleed" }]);
    expect(playBattleEvent).toHaveBeenLastCalledWith("hitPiercing");
    expect(playCardSound).toHaveBeenCalledTimes(1);
  });
});

it("selects Shatter by stable reaction identity rather than its displayed wording", () => {
  expect(
    selectCombatSound(
      [
        {
          target: "enemy",
          kind: "notice",
          stat: "physical",
          text: "Zersplittern",
          signal: "reaction",
          reactionId: "shatter",
        },
      ],
      false,
    ),
  ).toBe("shatter");
  expect(
    selectCombatSound([{ target: "enemy", kind: "notice", stat: "physical", text: "Shatter" }], false),
  ).toBeUndefined();
});
