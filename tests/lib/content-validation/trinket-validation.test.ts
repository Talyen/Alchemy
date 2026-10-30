import { expect, it } from "vitest";
import { describeTrinket, trinketById, trinketLibrary, type TrinketEntry } from "@/lib/game-data";
import { defaultTrinketEffects } from "@/lib/trinkets";
import { TrinketContentSchema } from "@/lib/content-validation/schemas";
import { validateTrinketDescriptionParity } from "@/lib/content-validation/card-parity/trinket-parity";

const chimes = trinketById["resonant-chimes"]!;
function messages(entry: TrinketEntry): string[] {
  return validateTrinketDescriptionParity(entry).map(({ message }) => message);
}

it.each([
  { resonantChimeMana: true },
  { firstBurnDoubled: 1 },
  { unknownEffect: 1 },
  {},
  { resonantChimeMana: 0, firstBurnDoubled: false },
  { resonantChimeMana: Infinity },
  { resonantChimeMana: NaN },
])("rejects invalid or inactive Trinket effects: %j", (effects) => {
  expect(TrinketContentSchema.safeParse({ ...chimes, effects }).success).toBe(false);
});

it("allows finite balance values and active boolean mechanics", () => {
  for (const amount of [1, -1, 1.5])
    expect(TrinketContentSchema.safeParse({ ...chimes, effects: { resonantChimeMana: amount } }).success).toBe(true);
  expect(TrinketContentSchema.safeParse(trinketById.meteorite).success).toBe(true);
});

it("detects stale numeric descriptions across the catalog and grants every manifest field", () => {
  for (const entry of trinketLibrary) {
    expect(entry.descriptionLines, entry.id).toEqual([describeTrinket(entry.id, entry.effects)]);
    for (const [key, value] of Object.entries(entry.effects)) {
      if (typeof value !== "number") continue;
      expect(messages({ ...entry, effects: { ...entry.effects, [key]: value + 1 } }), `${entry.id}: ${key}`).toEqual([
        expect.stringContaining("required trigger and outcome"),
      ]);
    }
  }
  const granted = new Set(trinketLibrary.flatMap(({ effects }) => Object.keys(effects)));
  expect(Object.keys(defaultTrinketEffects).filter((key) => !granted.has(key))).toEqual([]);
});

it("keeps thresholds distinct from rewards while accepting matching balance edits and whitespace", () => {
  const effects = { resonantChimeCardsRequired: 4, resonantChimeMana: 2 };
  expect(describeTrinket(chimes.id, effects)).toBe("When you play 4 or more cards in a single turn, gain 2 Mana");
  expect(messages({ ...chimes, effects })).toEqual([expect.stringContaining("required trigger and outcome")]);
  expect(
    messages({
      ...chimes,
      effects,
      descriptionLines: [" WHEN you play 4 or more cards", "in a single turn,   gain 2 Mana "],
    }),
  ).toEqual([]);
});

it.each([
  "When you play 13 or more cards in a single turn, gain 1 Mana",
  "When you play 3 or more cards in a single turn, lose 1 Mana",
  "Gain 1 Mana",
  "When you play 3 or more cards in a single turn, gain 1 Mana and lose Health",
])("rejects incorrect trigger or outcome wording: %s", (description) => {
  expect(messages({ ...chimes, descriptionLines: [description] })).toEqual([
    expect.stringContaining("required trigger and outcome"),
  ]);
});

it("rejects missing, unexpected, disabled, and unregistered mechanics", () => {
  expect(messages({ ...chimes, effects: { resonantChimeMana: 1, tatteredPagesBurnDrawChance: 10 } })).toEqual([
    "Missing required effect: resonantChimeCardsRequired",
    "Unexpected effect: tatteredPagesBurnDrawChance",
    expect.stringContaining("required trigger and outcome"),
  ]);
  expect(messages({ ...trinketById.meteorite!, effects: { firstBurnDoubled: false } })).toEqual([
    "Effect firstBurnDoubled must be true",
  ]);
  for (const id of ["unknown", "constructor", "__proto__"])
    expect(messages({ ...chimes, id })).toEqual([`Trinket "${id}" has no registered description definition`]);
});
