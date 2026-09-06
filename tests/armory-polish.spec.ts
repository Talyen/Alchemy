import { expect } from "@playwright/test";
import { failOnRuntimeErrors } from "./e2e/errors";
import { test } from "./fixtures/e2e";
import {
  activateCurrency,
  currencyLocator,
  enterSalvageMode,
  equipmentSlotLocator,
  gearItemLocator,
  openArmory,
} from "./e2e/armory";
import { createEmptyGearLoadouts, type GearInstance } from "@/lib/gear/types";

const sword: GearInstance = {
  instanceId: "polish-sword",
  definitionId: "longsword-basic",
  affixes: [{ id: "flat-physical", value: 1 }],
};

test("matches currency artwork sizes and freezes the equipped salvage preview", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  void runtimeErrors;
  const loadouts = createEmptyGearLoadouts();
  loadouts.knight["main-hand"] = sword.instanceId;
  await openArmory(page, { inventory: [sword], loadouts, craftingCurrencies: { voidstone: 2 } });
  await activateCurrency(page, "voidstone");
  const cursor = page.getByTestId("armory-crafting-cursor");
  await expect(cursor).toBeVisible();
  const chipBounds = await currencyLocator(page, "voidstone").boundingBox();
  const cursorBounds = await cursor.boundingBox();
  expect(cursorBounds?.width).toBeCloseTo(chipBounds!.width, 0);
  expect(cursorBounds?.height).toBeCloseTo(chipBounds!.height, 0);
  await page.keyboard.press("Escape");
  await enterSalvageMode(page);
  await equipmentSlotLocator(page, "main-hand").getByRole("button", { name: "Salvage Longsword", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Salvage", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Salvaging Longsword will yield:/)).toBeVisible();
  await expect(dialog.getByText(/Equipped by Knight/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await expect(page.getByTestId("armory-salvage-toggle")).toHaveAttribute("aria-pressed", "false");
  expect(await dialog.evaluate((element) => getComputedStyle(element).cursor)).not.toContain("data:image");
  const rewards = dialog.getByTestId("armory-salvage-yield");
  const firstPreview = await rewards.innerText();
  expect(firstPreview).not.toContain("+");
  const rewardChip = dialog.getByTestId("armory-salvage-currency-preview").first();
  expect((await rewardChip.boundingBox())?.width).toBeCloseTo(chipBounds!.width, 0);
  await expect(rewardChip).toHaveAttribute("role", "group");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath("salvage-confirmation.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await enterSalvageMode(page);
  await equipmentSlotLocator(page, "main-hand").getByRole("button", { name: "Salvage Longsword", exact: true }).click();
  await expect.poll(() => rewards.innerText()).toBe(firstPreview);
  await dialog.getByRole("button", { name: "Salvage", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(equipmentSlotLocator(page, "main-hand").getByRole("button", { name: "Protect Longsword" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("armory-salvage-toggle")).toHaveAttribute("aria-pressed", "false");
});

test("crafts once, reports the change, and saves item protection", async ({ page, runtimeErrors }, testInfo) => {
  void runtimeErrors;
  await openArmory(page, { inventory: [sword], craftingCurrencies: { "smiths-whetstone": 3, voidstone: 2 } });
  await activateCurrency(page, "smiths-whetstone");
  await gearItemLocator(page, "Longsword").getByRole("button").click();
  await expect(currencyLocator(page, "smiths-whetstone")).toContainText("2");
  await expect(currencyLocator(page, "smiths-whetstone")).toHaveAttribute("aria-pressed", "false");
  const result = page.getByTestId("armory-crafting-result");
  await expect(result).toContainText("Increases Physical damage by 1");
  await expect(result).toContainText("Increases Physical damage by 2");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath("crafting-result.png") });
  await page.getByRole("button", { name: "Protect Longsword", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unlock Longsword", exact: true })).toBeVisible();
  await activateCurrency(page, "voidstone");
  await gearItemLocator(page, "Longsword").getByRole("button").click();
  await expect(page.getByRole("status").filter({ hasText: "Unlock this item before crafting." })).toBeVisible();
  await expect(currencyLocator(page, "voidstone")).toContainText("2");
  const restoredPage = await page.context().newPage();
  const restoredErrors = failOnRuntimeErrors(restoredPage);
  try {
    await restoredPage.goto(page.url());
    await restoredPage.getByRole("button", { name: "Armory", exact: true }).click();
    await expect(restoredPage.getByRole("button", { name: "Unlock Longsword", exact: true })).toBeVisible();
    await expect(currencyLocator(restoredPage, "smiths-whetstone")).toContainText("2");
    await expect(restoredPage.getByTestId("armory-salvage-toggle")).toBeDisabled();
    await restoredPage.getByRole("button", { name: "Unlock Longsword", exact: true }).click();
    await expect(restoredPage.getByTestId("armory-salvage-toggle")).toBeEnabled();
    expect(restoredErrors).toEqual([]);
  } finally {
    await restoredPage.close();
  }
});
