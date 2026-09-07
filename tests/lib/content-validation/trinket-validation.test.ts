import { describe, expect, it } from "vitest";
import { trinketLibrary, type TrinketEntry } from "@/lib/game-data";
import { TrinketContentSchema } from "@/lib/content-validation/schemas";
import {
  TRINKET_PARITY_RULES,
  validateTrinketDescriptionParity,
} from "@/lib/content-validation/card-parity/trinket-parity";

function getTrinket(id: string): TrinketEntry {
  const trinket = trinketLibrary.find((entry) => entry.id === id);
  if (!trinket) throw new Error(`Missing test trinket: ${id}`);
  return trinket;
}

const chimes = getTrinket("resonant-chimes");
const meteorite = getTrinket("meteorite");

function parityMessages(trinket: TrinketEntry): string[] {
  return validateTrinketDescriptionParity(trinket).map((issue) => issue.message);
}

describe("Trinket effect schema", () => {
  it.each([
    ["boolean for numeric field", { resonantChimeCardsRequired: true, resonantChimeMana: true }],
    ["number for boolean field", { firstBurnDoubled: 1 }],
    ["unknown key", { unknownEffect: 1 }],
    ["empty effects", {}],
    ["default numeric effects", { resonantChimeCardsRequired: 0, resonantChimeMana: 0 }],
    ["default boolean effect", { firstBurnDoubled: false }],
    ["mixed default effects", { resonantChimeMana: 0, firstBurnDoubled: false }],
    ["infinity", { resonantChimeMana: Infinity }],
    ["negative infinity", { resonantChimeMana: -Infinity }],
    ["NaN", { resonantChimeMana: NaN }],
  ])("rejects %s", (_label, effects) => {
    expect(TrinketContentSchema.safeParse({ ...chimes, effects }).success).toBe(false);
  });

  it.each([1, -1, 1.5])("accepts finite numeric value %s without balance restrictions", (amount) => {
    expect(TrinketContentSchema.safeParse({ ...chimes, effects: { resonantChimeMana: amount } }).success).toBe(true);
  });

  it("accepts active boolean effects", () => {
    expect(TrinketContentSchema.safeParse(meteorite).success).toBe(true);
  });
});

describe("Trinket description parity", () => {
  it("covers exactly the catalog", () => {
    expect(Object.keys(TRINKET_PARITY_RULES).sort()).toEqual(trinketLibrary.map((entry) => entry.id).sort());
  });

  it.each(trinketLibrary)("rejects changed numeric effects for $id", (trinket) => {
    for (const [key, value] of Object.entries(trinket.effects)) {
      if (typeof value !== "number") continue;
      const changed = { ...trinket, effects: { ...trinket.effects, [key]: value + 1 } };
      expect(parityMessages(changed)).toContain(
        `Effect ${key} value ${value + 1} does not match described amount ${value}`,
      );
    }
  });

  it("rejects swapped threshold and reward amounts", () => {
    expect(parityMessages({ ...chimes, effects: { resonantChimeCardsRequired: 1, resonantChimeMana: 3 } })).toEqual([
      "Effect resonantChimeCardsRequired value 1 does not match described amount 3",
      "Effect resonantChimeMana value 3 does not match described amount 1",
    ]);
  });

  it.each([
    "When you play 13 or more cards in a single turn, gain 1 Mana",
    "When you play 3.5 or more cards in a single turn, gain 1 Mana",
  ])("rejects numeric substring matches: %s", (description) => {
    expect(parityMessages({ ...chimes, descriptionLines: [description] })).toEqual([
      expect.stringContaining("Effect resonantChimeCardsRequired value 3 does not match described amount"),
    ]);
  });

  it.each([
    "When you play 3 or more cards in a single turn, lose 1 Mana",
    "Gain 1 Mana",
    "When you play 3 or more cards in a single turn, gain 1 Mana and lose Health",
    "When you play 3 or more cards in a single turn, gain 1.5.2 Mana",
  ])("rejects incorrect or incomplete mechanics: %s", (description) => {
    expect(parityMessages({ ...chimes, descriptionLines: [description] })).toEqual([
      expect.stringContaining("required trigger and outcome"),
    ]);
  });

  it("rejects a disabled boolean mechanic", () => {
    expect(parityMessages({ ...meteorite, effects: { firstBurnDoubled: false } })).toEqual([
      "Effect firstBurnDoubled must be true",
    ]);
  });

  it.each(["Your first Burn damage each combat is halved", "Your Burn damage each combat is doubled"])(
    "rejects an incorrect boolean mechanic description: %s",
    (description) => {
      expect(parityMessages({ ...meteorite, descriptionLines: [description] })).toEqual([
        expect.stringContaining("required trigger and outcome"),
      ]);
    },
  );

  it("reports missing and unexpected effect keys", () => {
    expect(parityMessages({ ...chimes, effects: { resonantChimeMana: 1, extraDrawPerBattle: 3 } })).toEqual([
      "Missing required effect: resonantChimeCardsRequired",
      "Unexpected effect: extraDrawPerBattle",
      "Effect resonantChimeCardsRequired value undefined does not match described amount 3",
    ]);
  });

  it("rejects unregistered Trinkets", () => {
    expect(parityMessages({ ...chimes, id: "unregistered-trinket" })).toEqual([
      'Trinket "unregistered-trinket" has no registered description parity rule',
    ]);
  });

  it("accepts matching balance edits with case and whitespace normalization", () => {
    expect(
      parityMessages({
        ...chimes,
        descriptionLines: ["  WHEN you play 4 or more cards", "in a single turn,   gain 2 Mana  "],
        effects: { resonantChimeCardsRequired: 4, resonantChimeMana: 2 },
      }),
    ).toEqual([]);
  });

  it.each([
    ["brass-censer", "Holy damage has a 25% chance to also Burn or Leech", { brassCenserProcChance: 25 }],
    [
      "plague-doctors-mask",
      "At the start of your turn, Cleanse up to 3 Poison and deal half the amount cleansed as Poison damage",
      { plagueDoctorPoisonCleanse: 3 },
    ],
  ])("derives numeric expectations from effects for %s", (id, description, effects) => {
    expect(parityMessages({ ...getTrinket(id), descriptionLines: [description], effects })).toEqual([]);
  });
});
