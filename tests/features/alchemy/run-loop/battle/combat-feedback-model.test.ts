import { describe, expect, it } from "vitest";
import type { CombatTextEvent } from "@/lib/battle";
import type { CombatTextBurst } from "@/features/alchemy/shared/types";
import { prepareCombatFeedback } from "@/features/alchemy/run-loop/battle/combat-feedback-model";
import { consolidateCombatBursts } from "@/features/alchemy/run-loop/battle/combat-feedback-merge";
import { COMBAT_TEXT_MAX_BURSTS_PER_RAIL } from "@/lib/game-constants";

function burst(id: number, events: CombatTextEvent[], now = 0): CombatTextBurst {
  return prepareCombatFeedback(events, id, now, 1100).bursts[0]!;
}

const hit: CombatTextEvent = { target: "enemy", kind: "damage", stat: "physical", amount: 5 };
const heal: CombatTextEvent = { target: "enemy", kind: "heal", stat: "health", amount: 3 };

describe("combat feedback preparation and merging", () => {
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

  it("retries after rail eviction so damage merged into an evicted burst is still shown", () => {
    const current = Array.from({ length: COMBAT_TEXT_MAX_BURSTS_PER_RAIL }, (_, index) =>
      burst(index, [index === 0 ? hit : { ...heal, additive: false }]),
    );
    const snapshot = structuredClone(current);
    const incoming = burst(100, [hit, { ...heal, additive: false }], 10);
    const result = consolidateCombatBursts(current, [incoming], 10);
    expect(result.bursts).toEqual([...current.slice(1), incoming]);
    expect(result.added).toEqual([incoming]);
    expect(current).toEqual(snapshot);
  });

  it("drops expired bursts and preserves the other rail when making space", () => {
    const player = burst(200, [{ ...hit, target: "player" }]);
    const enemy = Array.from({ length: COMBAT_TEXT_MAX_BURSTS_PER_RAIL }, (_, index) =>
      burst(index, [{ ...hit, additive: false }]),
    );
    const expired = burst(300, [heal], -1100);
    const incoming = burst(400, [{ ...hit, additive: false }], 10);
    const result = consolidateCombatBursts([expired, player, ...enemy], [incoming], 10);
    expect(result.bursts).toEqual([player, ...enemy.slice(1), incoming]);
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
    expect(prepareCombatFeedback([], 3, 20, 1100)).toEqual({ bursts: [], impacts: {} });
  });
});
