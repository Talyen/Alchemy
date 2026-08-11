import { expect } from "@playwright/test";
import {
  activateCurrency,
  applyCurrencyToGear,
  bodyGear,
  confirmSalvage,
  currencyLocator,
  enterSalvageMode,
  expectSalvageDialog,
  gearItemLocator,
  openArmory,
  salvageInventoryItem,
} from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { seedRandom } from "./e2e/rng";
import { armory, critical, slow } from "./playwright-tags";

const affixedHelm = {
  instanceId: "gear-helm",
  definitionId: "leather-helm-basic" as const,
  affixes: [{ id: "max-health" as const, value: 7 }],
};

const emptyCraftingCurrencies = {
  "discordant-dice": 0,
  "sprig-of-growth": 0,
  voidstone: 0,
  "ascension-seal": 0,
  "severance-maw": 0,
  "smiths-whetstone": 0,
};

test.describe("Armory crafting", { ...armory }, () => {
  test("salvages gear and grants crafting materials", critical, async ({ page }) => {
    await seedRandom(page, 0);
    const sword = {
      instanceId: "gear-sword",
      definitionId: "shortsword-basic" as const,
      affixes: [{ id: "flat-physical" as const, value: 1 }],
    };

    await openArmory(page, {
      inventory: [sword],
      craftingCurrencies: { ...emptyCraftingCurrencies },
    });

    await salvageInventoryItem(page, "Shortsword");
    await expectSalvageDialog(page);
    await confirmSalvage(page);

    await expect(gearItemLocator(page, "Shortsword")).toHaveCount(0);
    await expect(currencyLocator(page, "discordant-dice")).toBeVisible();
    await expect
      .poll(async () => {
        const text = await currencyLocator(page, "discordant-dice").textContent();
        return Number(text?.trim() || "0");
      })
      .toBeGreaterThan(0);
  });

  test("stays in salvage mode after confirming a salvage", async ({ page }) => {
    await seedRandom(page, 0);
    const ringA = { instanceId: "ring-a", definitionId: "ruby-ring-basic" as const, affixes: [] };
    const ringB = { instanceId: "ring-b", definitionId: "ruby-ring-basic" as const, affixes: [] };

    await openArmory(page, {
      inventory: [ringA, ringB],
      craftingCurrencies: { ...emptyCraftingCurrencies },
    });

    await enterSalvageMode(page);
    await page.getByLabel("Salvage Ruby Ring", { exact: true }).first().click();
    await expectSalvageDialog(page);
    await confirmSalvage(page);

    await expect(page.getByRole("button", { name: "Cancel salvage" })).toBeVisible();
    await expect(gearItemLocator(page, "Ruby Ring")).toHaveCount(1);
  });

  test("applies voidstone and removes affixes", critical, async ({ page }) => {
    await openArmory(page, {
      inventory: [affixedHelm],
      craftingCurrencies: { ...emptyCraftingCurrencies, voidstone: 1 },
    });

    await activateCurrency(page, "voidstone");
    await applyCurrencyToGear(page, "Leather Helm", "Voidstone");

    await expect(page.getByTestId("armory-crafting-cursor")).toHaveCount(0);
    await expect(currencyLocator(page, "voidstone")).toHaveCount(0);

    const helm = gearItemLocator(page, "Leather Helm");
    await helm.hover();
    await expect(page.getByText("Enduring")).toHaveCount(0);
    await expect(page.getByText("Salvage for Basic crafting currency")).toBeHidden();
  });

  test("upgrades basic gear to astral with ascension seal", slow, async ({ page }) => {
    await openArmory(page, {
      inventory: [affixedHelm],
      craftingCurrencies: { ...emptyCraftingCurrencies, "ascension-seal": 1 },
    });

    await activateCurrency(page, "ascension-seal");
    await applyCurrencyToGear(page, "Leather Helm", "Ascension Seal");

    await expect(gearItemLocator(page, "Astral Leather Helm")).toBeVisible();
    await expect(gearItemLocator(page, "Leather Helm")).toHaveCount(0);
  });

  test("cancels currency targeting with Escape", async ({ page }) => {
    await openArmory(page, {
      inventory: [affixedHelm],
      craftingCurrencies: { ...emptyCraftingCurrencies, voidstone: 1 },
    });

    await activateCurrency(page, "voidstone");
    await expect(page.getByRole("button", { name: /Apply Voidstone to Leather Helm/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Apply Voidstone/ })).toHaveCount(0);
  });

  test("rejects invalid voidstone target without consuming currency", async ({ page }) => {
    await openArmory(page, {
      inventory: [bodyGear],
      craftingCurrencies: { ...emptyCraftingCurrencies, voidstone: 1 },
    });

    await activateCurrency(page, "voidstone");
    await gearItemLocator(page, "Leather Armor").click();
    await expect(currencyLocator(page, "voidstone")).toContainText("1");
    await expect(page.getByRole("button", { name: /Apply Voidstone/ })).toBeVisible();
  });

  test("shows affix epithets in gear tooltips", async ({ page }) => {
    await openArmory(page, { inventory: [affixedHelm] });

    await gearItemLocator(page, "Leather Helm").hover();
    await expect(page.getByText("Enduring")).toBeVisible();
    await expect(page.getByText("Increases Health by 7")).toBeVisible();
  });
});
