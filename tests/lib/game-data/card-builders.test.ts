import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { cardMagnitude, type CardDescription } from "@/lib/game-data";
import { effectsCard } from "@/lib/game-data/cards/card-builders";
import { expect, it } from "vitest";

it("owns custom description lines so building or editing a variant cannot change another card", () => {
  const authored: CardDescription = [
    {
      parts: ["Restore ", cardMagnitude({ kind: "heal", effectIndex: 0, field: "amount" }), " Health"],
      role: "effect",
    },
  ];
  const before = structuredClone(authored);
  const base = { id: "shared", art: "", effects: [{ kind: "heal" as const, amount: 2 }], describe: () => authored };
  const tagged = effectsCard({ ...base, tags: ["nature"], consume: true });
  const plain = effectsCard(base);
  expect(tagged.descriptionLines).toEqual(["Restore 2 Health", "Nature", "Consume"]);
  expect(plain.descriptionLines).toEqual(["Restore 2 Health"]);
  tagged.descriptionLines[0] = "Changed";
  plain.descriptionLines.push("Changed");
  tagged.description![0]!.parts[0] = "Changed";
  expect(authored).toEqual(before);
});

it("validates exact canonical text and still rejects edited amounts and omitted effects", () => {
  const card = effectsCard({
    id: "canonical",
    art: "",
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "draw-cards", amount: 1 },
    ],
  });
  expect(card.descriptionLines).toEqual(["Restore 4 Health", "Draw a card", "Consume"]);
  expect(validateCardDescriptionParity(card)).toEqual([]);
  for (const descriptionLines of [
    ["Restore 9 Health", "Draw a card", "Consume"],
    ["Restore 4 Health", "Consume"],
  ]) {
    const changed = { ...card, descriptionLines };
    expect(validateCardDescriptionParity(changed).some((issue) => issue.severity === "error")).toBe(true);
  }
});
