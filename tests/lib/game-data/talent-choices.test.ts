import { afterEach, expect, it, vi } from "vitest";
import * as pools from "@/lib/game-data/talents/talent-pool-definitions";
import { chunkIntoRows, getAllocatableTalentChoices, getTalentRows } from "@/lib/game-data/talents/choices";
import type { TalentDefinition } from "@/lib/game-data/talents/types";

afterEach(() => vi.restoreAllMocks());

it("preserves all entries in fixed and tiered rows and rejects sizes that can hang or drop entries", () => {
  const items = [1, 2, 3, 4, 5];
  expect(chunkIntoRows(items, 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunkIntoRows(items, [1, 2])).toEqual([[1], [2, 3], [4, 5]]);
  for (const size of [0, -1, 1.5, NaN, Infinity]) {
    expect(() => chunkIntoRows(items, size)).toThrow(RangeError);
    expect(() => chunkIntoRows(items, [1, size])).toThrow(RangeError);
  }
});

it("keeps overflow talents locked until the displayed fourth row is complete", () => {
  const talents: TalentDefinition[] = Array.from({ length: 12 }, (_, index) => ({
    id: `talent-${index}`,
    keywordId: "physical",
    description: "",
  }));
  vi.spyOn(pools, "getTalentsForKeyword").mockReturnValue(talents);
  vi.spyOn(pools.talentPoolByKeyword, "get").mockReturnValue(talents);
  const purchased = talents.slice(0, 9).map(({ id }) => id);
  expect(getTalentRows("physical").map((row) => row.length)).toEqual([1, 2, 3, 4, 2]);
  expect(getAllocatableTalentChoices("physical", purchased)).toEqual([talents[9]]);
  expect(getAllocatableTalentChoices("physical", [...purchased, talents[9]!.id])).toEqual(talents.slice(10));
});

it("offers the first incomplete row in order for every unlocked subset", () => {
  const talents: TalentDefinition[] = Array.from({ length: 12 }, (_, index) => ({
    id: `talent-${index}`,
    keywordId: "physical",
    description: "",
  }));
  vi.spyOn(pools, "getTalentsForKeyword").mockReturnValue(talents);
  vi.spyOn(pools.talentPoolByKeyword, "get").mockReturnValue(talents);
  const rows = chunkIntoRows(talents, [1, 2, 3, 4]);
  for (let mask = 0; mask < 1 << talents.length; mask++) {
    const unlocked = talents.filter((_, index) => mask & (1 << index)).map((talent) => talent.id);
    const expected = rows.map((row) => row.filter((talent) => !unlocked.includes(talent.id))).find((row) => row.length);
    expect(getAllocatableTalentChoices("physical", unlocked)).toEqual(expected ?? []);
  }
});
