import { expect, it } from "vitest";
import { getGearInstanceAffixes } from "@/lib/gear/affixes";
import { getUniqueAffixes } from "@/lib/gear/unique-catalog";
import { getGearInstanceKeywordIds } from "@/lib/gear/gear-shine";

it("shares protected canonical Unique affixes across inspection and combat reads", () => {
  const first = { instanceId: "unique-read-1", definitionId: "wardbreaker", affixes: [] };
  const second = {
    instanceId: "unique-read-2",
    definitionId: "wardbreaker",
    affixes: [{ id: "flat-burn", value: 999 }],
  };
  const expected = getUniqueAffixes("wardbreaker")!;
  const keywords = getGearInstanceKeywordIds(first);
  const view = getGearInstanceAffixes(first);
  expect(view).toEqual(expected);
  expect(getGearInstanceAffixes(second)).toBe(view);
  expect(Object.isFrozen(view)).toBe(true);
  expect(Reflect.set(view[0]!, "value", 999)).toBe(false);

  const mutableCopy = getUniqueAffixes("wardbreaker")!;
  mutableCopy[0]!.value = 999;
  mutableCopy.pop();
  expect(getGearInstanceAffixes(first)).toEqual(expected);
  expect(getUniqueAffixes("wardbreaker")).toEqual(expected);
  expect(getGearInstanceKeywordIds(second)).toEqual(keywords);
});
