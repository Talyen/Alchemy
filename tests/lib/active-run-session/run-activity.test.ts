import { expect, it } from "vitest";
import { readActivityData, type RunActivity } from "@/lib/active-run-session";

it("cannot mutate another visit through an inactive activity read", () => {
  const activity: RunActivity = { kind: "idle" };
  const fallback = readActivityData(activity, "shop");
  expect(() => fallback.cards.push(null as never)).toThrow();
  expect(() => {
    fallback.refreshesLeft = 99;
  }).toThrow();
  expect(readActivityData(activity, "shop").cards).toEqual([]);
});
