import { expect, it } from "vitest";
import { createEmptyRewardState, resolveRewardChoice, type RewardState } from "@/lib/active-run-session";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import { makeGearInstance } from "../../helpers/gear-fixtures";

it.each(["card", "boon", "trinket"] as const)(
  "rejects stale %s selections while preserving the selected reward kind",
  (rewardType) => {
    const card = cardLibrary[0]!;
    const trinket = trinketLibrary[0]!;
    const state: RewardState =
      rewardType === "card"
        ? { ...createEmptyRewardState(), rewardType, choices: [card], selectedId: card.id }
        : { ...createEmptyRewardState(), rewardType, choices: [trinket], selectedId: trinket.id };
    expect(resolveRewardChoice(state)).toEqual({ rewardType, choice: state.choices[0] });
    expect(resolveRewardChoice(state, "not-offered")).toBeNull();
    expect(resolveRewardChoice(state, "")).toBeNull();
    expect(resolveRewardChoice({ ...state, selectedId: null })).toBeNull();
  },
);

it("selects the offered Gear instance rather than another copy of the same definition", () => {
  const first = makeGearInstance("ruby-ring-basic", "first", [{ id: "flat-burn", value: 1 }]);
  const second = makeGearInstance("ruby-ring-basic", "second", [{ id: "flat-freeze", value: 1 }]);
  const state: RewardState = {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices: [first, second],
    selectedId: second.instanceId,
  };
  expect(resolveRewardChoice(state)).toEqual({ rewardType: "gear", choice: second });
  expect(resolveRewardChoice(state, first.definitionId)).toBeNull();
  expect(resolveRewardChoice(state, "stale-instance")).toBeNull();
});
