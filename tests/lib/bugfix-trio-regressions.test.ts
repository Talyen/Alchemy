import { describe, expect, it } from "vitest";
import { SaveDataSchema, isCombatGoldOverride } from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { makeMinimalActiveRunInput } from "../fixtures/active-run";
import { savedActivityFixture } from "../fixtures/run-activity";
import { scoreAvailableReactions } from "@/lib/battle/reaction-score";
import { patchBattleState, makeTestCard } from "../fixtures/battle";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";

describe("bugfix trio regressions", () => {
  it("rounds fractional live-combat gold instead of flooring it", () => {
    expect(isCombatGoldOverride(10.9, 11)).toBe(true);
    expect(isCombatGoldOverride(10.9, 10)).toBe(false);
    const result = SaveDataSchema.safeParse({
      gold: 0,
      activeRun: makeMinimalActiveRunInput({
        activity: savedActivityFixture("battle", { battleState: { ...defaultBattleState(), gold: 10.9 } }),
      }),
    });
    expect(result.success, JSON.stringify(result.success ? "" : result.error?.issues)).toBe(true);
    if (result.success) expect(result.data.gold).toBe(11);
  });

  it("projects odd-span random damage at the rounded average", () => {
    const base = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerHealth: 100,
      playerMaxHealth: 100,
      appliesFightPacing: false,
      encounterBenefits: ["wildheart"],
      currentEnemy: { abilityIds: ["slash", "stab"] },
      deck: Array.from({ length: 8 }, (_, i) =>
        makeTestCard({ id: `deck-${i}`, effects: [{ kind: "player-status", status: "block", amount: 1 }] }),
      ),
      enemyStatuses: { burn: 8 },
    });
    // Wildheart doubles the first Nature hit, so the pre-round choice matters:
    // unfixed 2.5 * 2 = 5 leaves 1 HP on a 6-HP enemy (wildfire pays),
    // while rounded 3 * 2 = 6 kills (wildfire pays nothing).
    const state = { ...endPlayerTurn(endPlayerTurn(base).state).state, enemyHealth: 6 };
    const random = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["nature", "holy"] }],
    });
    const natureThree = makeTestCard({
      effects: [{ kind: "damage", damageType: "nature", amount: 3 }],
    });
    const holyThree = makeTestCard({
      effects: [{ kind: "damage", damageType: "holy", amount: 3 }],
    });
    const natureTwo = makeTestCard({
      effects: [{ kind: "damage", damageType: "nature", amount: 2 }],
    });
    const holyTwo = makeTestCard({
      effects: [{ kind: "damage", damageType: "holy", amount: 2 }],
    });
    // (1 + 4) / 2 = 2.5 must round to 3 per the combat-magnitude invariant.
    // scoreAvailableReactions builds a synthetic damage packet, so it must stay
    // integer; the autoplay heuristic in autoplay-policy may stay fractional.
    const expected = (scoreAvailableReactions(natureThree, state) + scoreAvailableReactions(holyThree, state)) / 2;
    const floored = (scoreAvailableReactions(natureTwo, state) + scoreAvailableReactions(holyTwo, state)) / 2;
    expect(scoreAvailableReactions(random, state)).toBe(expected);
    expect(scoreAvailableReactions(random, state)).not.toBe(floored);
  });
});
