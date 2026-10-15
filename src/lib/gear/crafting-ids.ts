import { createNumericManifest, mergeNumericManifests } from "@/lib/manifest-utils";

export const CRAFTING_CURRENCY_IDS = [
  "discordant-dice",
  "sprig-of-growth",
  "voidstone",
  "ascension-seal",
  "severance-maw",
  "smiths-whetstone",
] as const;

export type CraftingCurrencyId = (typeof CRAFTING_CURRENCY_IDS)[number];

export const EMPTY_CRAFTING_CURRENCIES = createNumericManifest(CRAFTING_CURRENCY_IDS);

function sanitizeCurrencyValue(value: unknown): number {
  if (typeof value !== "number" || value <= 0) return 0;
  const integer = Math.floor(value);
  return Number.isSafeInteger(integer) ? integer : 0;
}

export function normalizeCraftingCurrencies(
  currencies: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  const normalized = { ...EMPTY_CRAFTING_CURRENCIES };
  if (!currencies || typeof currencies !== "object") return normalized;

  for (const id of CRAFTING_CURRENCY_IDS) {
    normalized[id] = sanitizeCurrencyValue(currencies[id]);
  }

  return normalized;
}

export function addCraftingCurrencies(
  base: Partial<Record<string, unknown>> | null | undefined,
  added: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  return mergeNumericManifests(
    normalizeCraftingCurrencies(base),
    normalizeCraftingCurrencies(added),
    CRAFTING_CURRENCY_IDS,
  );
}
