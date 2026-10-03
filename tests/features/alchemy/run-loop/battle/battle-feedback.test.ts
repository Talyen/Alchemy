import { expect, it } from "vitest";
import { shouldPlayCardGoldGain } from "@/features/alchemy/run-loop/battle/controller-utils";
import { makeTestCard, patchBattleState } from "../../../../fixtures/battle";

it("reserves Steal's Gold sound for its own cue while other Gold gains receive feedback", () => {
  const previous = patchBattleState({ gold: 5 });
  const gained = patchBattleState({ gold: 8 });
  expect(shouldPlayCardGoldGain(previous, gained, makeTestCard({ id: "steal" }))).toBe(false);
  expect(shouldPlayCardGoldGain(previous, gained, makeTestCard({ id: "strike" }))).toBe(true);
  expect(shouldPlayCardGoldGain(gained, previous, makeTestCard({ id: "strike" }))).toBe(false);
});
