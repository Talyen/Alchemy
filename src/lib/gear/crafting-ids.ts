export type CraftingCurrencyId =
  | "discordant-dice"
  | "sprig-of-growth"
  | "voidstone"
  | "ascension-seal"
  | "severance-maw"
  | "smiths-whetstone";

export const CRAFTING_CURRENCY_IDS = [
  "discordant-dice",
  "sprig-of-growth",
  "voidstone",
  "ascension-seal",
  "severance-maw",
  "smiths-whetstone",
] as const satisfies readonly CraftingCurrencyId[];

export const EMPTY_CRAFTING_CURRENCIES = Object.fromEntries(CRAFTING_CURRENCY_IDS.map((id) => [id, 0])) as Record<
  CraftingCurrencyId,
  number
>;

export function normalizeCraftingCurrencies(
  currencies: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  const normalized = { ...EMPTY_CRAFTING_CURRENCIES };
  if (!currencies || typeof currencies !== "object") return normalized;

  for (const id of CRAFTING_CURRENCY_IDS) {
    const value = currencies[id];
    normalized[id] = typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  return normalized;
}

export function addCraftingCurrencies(
  base: Partial<Record<string, unknown>> | null | undefined,
  added: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  const next = normalizeCraftingCurrencies(base);
  if (!added || typeof added !== "object") return next;

  for (const id of CRAFTING_CURRENCY_IDS) {
    const value = added[id];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[id] += Math.floor(value);
    }
  }

  return next;
}
