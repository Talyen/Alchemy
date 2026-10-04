import { expect, it } from "vitest";
import { applyAltarModifiers } from "@/lib/corruption/altar-modifiers";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { cardById } from "@/lib/game-data";

it("Blood Rite favors Bleed over each other conversion instead of equally boosting all types", () => {
  const card = cardById.slash!;
  const conversion = getCorruptionMutationGroups(card, ["blood-rite"]).find((group) => group.kind === "convert")!;
  const counts = new Map<string, number>();
  for (const { card: outcome } of conversion.mutations) {
    const effect = outcome.effects[0];
    if (effect?.kind === "damage") counts.set(effect.damageType, (counts.get(effect.damageType) ?? 0) + 1);
  }
  expect(counts.get("bleed")).toBeGreaterThan(counts.get("poison")!);
  expect(counts.get("bleed")).toBeGreaterThan(counts.get("freeze")!);
});

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
