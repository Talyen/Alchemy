import { describe, expect, it } from "vitest";
import type { CombatTextEvent } from "@/lib/battle";
import type { CombatTextBurst } from "@/features/alchemy/shared/types";
import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { consolidateCombatBursts } from "@/features/alchemy/run-loop/battle/combat-feedback-merge";
import { combatTextLane } from "@/features/alchemy/run-loop/battle/combat-feedback-motion";

function burst(id: number, events: CombatTextEvent[], now = 0): CombatTextBurst {
  return prepareCombatFeedback(events, id, now, 1100).bursts[0]!;
}

const hit: CombatTextEvent = { target: "enemy", kind: "damage", stat: "physical", amount: 5 };
const heal: CombatTextEvent = { target: "enemy", kind: "heal", stat: "health", amount: 3 };

describe("combat feedback preparation and merging", () => {
  it("keeps a later Critical Hit visible when rapid hits merge", () => {
    const current = burst(1, [{ ...hit, healthLost: 2 }]);
    const incoming = burst(2, [{ ...hit, healthLost: 3, critical: true }], 10);
    const result = consolidateCombatBursts([current], [incoming], 10);
    expect(result.bursts).toHaveLength(1);
    expect(result.bursts[0]!.entries[0]).toMatchObject({ amount: 10, healthLost: 5, critical: true });
    expect(current.entries[0]).not.toHaveProperty("critical");
  });

  it("merges a partial hit once, keeping expiry, order, and input events intact", () => {
    const current = [burst(1, [hit])];
    const incoming = [burst(2, [hit, heal], 10)];
    const snapshot = structuredClone({ current, incoming });
    const result = consolidateCombatBursts(current, incoming, 10);
    expect(result.bursts).toEqual([
      {
        ...current[0],
        entries: [{ ...current[0]!.entries[0], amount: 10, displayText: "-10" }],
      },
      { ...incoming[0], entries: [incoming[0]!.entries[1]] },
    ]);
    expect(result.added).toEqual([result.bursts[1]]);
    expect({ current, incoming }).toEqual(snapshot);
  });

  it("retains receipts until the entry queue admits or evicts their pending text", () => {
    const current = Array.from({ length: 3 }, (_, index) =>
      burst(index, [index === 0 ? hit : { ...heal, additive: false }]),
    );
    const snapshot = structuredClone(current);
    const incoming = burst(100, [hit, { ...heal, additive: false }], 10);
    const result = consolidateCombatBursts(current, [incoming], 10);
    expect(result.bursts).toHaveLength(4);
    expect(result.bursts[0]!.entries[0]).toMatchObject({ amount: 10, displayText: "-10" });
    expect(result.added[0]!.entries).toEqual([incoming.entries[1]]);
    expect(current).toEqual(snapshot);
  });

  it("drops expired receipts while preserving live entries on both targets", () => {
    const player = burst(200, [{ ...hit, target: "player" }]);
    const enemy = Array.from({ length: 3 }, (_, index) => burst(index, [{ ...hit, additive: false }]));
    const expired = burst(300, [heal], -1100);
    const incoming = burst(400, [{ ...hit, additive: false }], 10);
    const result = consolidateCombatBursts([expired, player, ...enemy], [incoming], 10);
    expect(result.bursts).toEqual([player, ...enemy, incoming]);
  });

  it("retains priority and target order, hides zero events, and uses one zero fallback", () => {
    const notice: CombatTextEvent = { target: "player", kind: "notice", stat: "stun", text: "Stunned" };
    const events: CombatTextEvent[] = [
      { ...heal, target: "player" },
      { ...hit, target: "player", amount: 0 },
      hit,
      notice,
    ];
    const result = prepareCombatFeedback(events, 1, 20, 1100);
    expect(result.bursts.map((entry) => entry.target)).toEqual(["player", "enemy"]);
    expect(result.bursts[0]!.entries.map((entry) => entry.kind)).toEqual(["notice", "heal"]);
    expect(result.bursts[1]!.entries[0]).toMatchObject({ ...hit, displayText: "-5" });
    const zero = prepareCombatFeedback(
      [
        { ...heal, amount: 0 },
        { ...hit, amount: 0 },
      ],
      2,
      20,
      1100,
    );
    expect(zero.bursts).toHaveLength(1);
    expect(zero.bursts[0]!.entries).toHaveLength(1);
    expect(zero.bursts[0]!.entries[0]).toMatchObject({ ...hit, amount: 0, displayText: "0" });
    expect(prepareCombatFeedback([], 3, 20, 1100)).toEqual({ bursts: [], impacts: {}, reactions: [] });
  });
});

it("preserves primary/corner intent through display totals and rapid burst merging", () => {
  const direct: CombatTextEvent = { target: "player", kind: "status", stat: "block", amount: 5, feedback: "primary" };
  const proc: CombatTextEvent = { ...direct, amount: 2, feedback: "secondary" };
  const current = burst(1, [direct, proc]);
  expect(current.entries).toHaveLength(2);
  expect(current.entries.map(combatTextLane)).toEqual(["impact", "benefit"]);
  const merged = consolidateCombatBursts([current], [burst(2, [proc], 10)], 10);
  expect(merged.bursts[0]!.entries).toMatchObject([
    { amount: 5, feedback: "primary" },
    { amount: 4, feedback: "secondary" },
  ]);
  const damage = prepareCombatFeedback(
    [
      { ...hit, feedback: "primary" },
      { ...hit, amount: 3, feedback: "secondary" },
    ],
    3,
    0,
    1100,
  ).bursts[0]!;
  expect(damage.entries).toHaveLength(2);
  expect(damage.entries.map(combatTextLane)).toEqual(["impact", "setback"]);
});

it("keeps direct and reaction damage distinct while retaining packet facts for impacts", () => {
  const events: CombatTextEvent[] = [
    { ...hit, amount: 6, critical: true, feedback: "primary" },
    { ...hit, amount: 8, additive: false, reactionId: "shatter", feedback: "secondary" },
    { target: "enemy", kind: "notice", stat: "physical", text: "Shatter", signal: "reaction", reactionId: "shatter" },
    { target: "enemy", kind: "damage", stat: "block", amount: 6, impact: false },
    { target: "enemy", kind: "damage", stat: "armor", amount: 3, impact: false },
    { target: "player", kind: "damage", stat: "health", amount: 2, impact: false },
  ];
  const original = structuredClone(events);
  const prepared = prepareCombatFeedback(events, 8, 100, 1100);
  expect(prepared.bursts[1]!.entries).toHaveLength(2);
  expect(prepared.reactions[0]!.entries).toMatchObject([
    { amount: 6, displayText: "-6", critical: true, feedback: "primary" },
    { amount: 8, displayText: "-8", reactionId: "shatter", feedback: "secondary" },
  ]);
  expect(prepared.impacts.enemyImpactCue).toMatchObject({ amount: 8 });
  expect(prepared.impacts.playerImpactCue).toBeUndefined();
  expect(prepared.reactions).toMatchObject([{ target: "enemy", reactionIds: ["shatter"], lifetimeMs: 1600 }]);
  expect(events).toEqual(original);
});

it("keeps natural Burn separate from Bloodboil while sharing one group", () => {
  const prepared = prepareCombatFeedback(
    [
      { target: "enemy", kind: "damage", stat: "burn", amount: 8, periodic: true },
      { target: "enemy", kind: "damage", stat: "burn", amount: 6, additive: false, reactionId: "bloodboil" },
      { target: "enemy", kind: "notice", stat: "burn", text: "Bloodboil", signal: "reaction", reactionId: "bloodboil" },
    ],
    1,
    0,
    1100,
  );
  expect(prepared.bursts).toEqual([]);
  expect(prepared.reactions[0]!.entries).toMatchObject([
    { amount: 8, displayText: "-8", periodic: true },
    { amount: 6, displayText: "-6", reactionId: "bloodboil" },
  ]);
  expect(prepared.impacts.enemyImpactCue).toMatchObject({ amount: 8, periodic: true });
});

it("totals repeated packets only within their exact reaction origin, retaining order and input events", () => {
  const events: CombatTextEvent[] = [
    { target: "enemy", kind: "damage", stat: "burn", amount: 8, feedback: "primary" },
    { target: "enemy", kind: "notice", stat: "burn", text: "Frostfire", signal: "reaction", reactionId: "frostfire" },
    {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: 4,
      additive: false,
      reactionId: "frostfire",
      feedback: "secondary",
    },
    { target: "enemy", kind: "notice", stat: "burn", text: "Venomflash", signal: "reaction", reactionId: "venomflash" },
    {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: 2,
      additive: false,
      reactionId: "venomflash",
      feedback: "secondary",
    },
    {
      target: "enemy",
      kind: "damage",
      stat: "burn",
      amount: 2,
      additive: false,
      reactionId: "venomflash",
      feedback: "secondary",
    },
  ];
  const original = structuredClone(events);
  const prepared = prepareCombatFeedback(events, 2, 0, 1050);
  expect(prepared.bursts).toEqual([]);
  expect(prepared.reactions[0]!.reactionIds).toEqual(["frostfire", "venomflash"]);
  expect(prepared.reactions[0]!.entries).toMatchObject([
    { amount: 8, feedback: "primary" },
    { amount: 4, reactionId: "frostfire" },
    { amount: 4, reactionId: "venomflash" },
  ]);
  expect(events).toEqual(original);
});
