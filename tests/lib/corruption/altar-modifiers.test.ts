import { expect, it } from "vitest";
import { applyAltarModifiers } from "@/lib/corruption/altar-modifiers";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { cardById } from "@/lib/game-data";

it("composes altar restrictions and weights without changing the original offers", () => {
  const card = { ...cardById.slash!, tags: ["poison" as const] };
  const groups = getCorruptionMutationGroups(card);
  const original = structuredClone(groups);
  const result = applyAltarModifiers(groups, card, ["steady-sigil", "blood-rite", "echoing-altar"]);
  expect(result.some((group) => group.kind === "weaken")).toBe(false);
  expect(result.find((group) => group.kind === "leech")?.weight).toBe(
    groups.find((group) => group.kind === "leech")!.weight * 3,
  );
  const conversion = result.find((group) => group.kind === "convert")!;
  expect(conversion.weight).toBe(groups.find((group) => group.kind === "convert")!.weight * 2);
  expect(conversion.mutations.map(({ card }) => card.effects[0])).toEqual([
    { kind: "damage", amount: 1, damageType: "poison" },
  ]);
  expect(conversion.mutations[0]?.card.descriptionLines).toContain("Deal 1 Poison damage");
  expect(result.find((group) => group.kind === "secondary")?.mutations).toHaveLength(1);
  expect(groups).toEqual(original);
});
