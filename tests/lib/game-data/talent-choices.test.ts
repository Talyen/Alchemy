import { afterEach, expect, it, vi } from "vitest";
import * as pools from "@/lib/game-data/talents/talent-pool-definitions";
import { getAllocatableTalentChoices, getTalentRows } from "@/lib/game-data/talents/choices";
import type { TalentDefinition } from "@/lib/game-data/talents/types";

afterEach(() => vi.restoreAllMocks());

it("keeps overflow talents locked until the displayed fourth row is complete", () => {
  const talents: TalentDefinition[] = Array.from({ length: 12 }, (_, index) => ({
    id: `talent-${index}`,
    keywordId: "physical",
    description: "",
  }));
  vi.spyOn(pools, "getTalentsForKeyword").mockReturnValue(talents);
  const purchased = talents.slice(0, 9).map(({ id }) => id);
  expect(getTalentRows("physical").map((row) => row.length)).toEqual([1, 2, 3, 4, 2]);
  expect(getAllocatableTalentChoices("physical", purchased)).toEqual([talents[9]]);
  expect(getAllocatableTalentChoices("physical", [...purchased, talents[9]!.id])).toEqual(talents.slice(10));
});
