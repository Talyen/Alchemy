import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { MenuPage } from "../../pages/menu-page";

test("Dodge color remains distinct from nearby keyword colors", async ({ page, runtimeErrors }, testInfo) => {
  void runtimeErrors;
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta();
  await menu.openTalents();
  const colors: string[] = [];
  for (const [label, colorClass] of [
    ["Dodge", "text-lime-300"],
    ["Archery", "text-lime-700"],
    ["Gold", "text-yellow-300"],
    ["Nature", "text-emerald-600"],
    ["Poison", "text-green-700"],
  ]) {
    await page.getByRole("button", { name: `Select ${label} Talents` }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
    const talent = page.locator(".talent-node").first();
    await expect(talent).toBeVisible();
    colors.push(
      await talent
        .locator(`.${colorClass}`)
        .first()
        .evaluate((element) => getComputedStyle(element).color),
    );
    await talent.screenshot({ path: testInfo.outputPath(`keyword-color-${label}.png`) });
    await page.getByRole("button", { name: "Back", exact: true }).click();
  }
  expect(new Set(colors).size).toBe(5);
});

test("Dodge has a blank portrait, colored descriptions, and keyboard-unlockable talents", async ({
  page,
  runtimeErrors,
}, testInfo) => {
  void runtimeErrors;
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({ talentXP: { dodge: 550 }, unlockedTalents: {} });
  await menu.openTalents();
  const portrait = page.getByRole("button", { name: "Select Dodge Talents" });
  await expect(portrait).toBeVisible();
  await expect(portrait.locator("img")).toHaveCount(0);
  await expect(portrait.locator("svg")).toBeVisible();
  await portrait.focus();
  await portrait.press("Enter");
  await expect(page.getByText("Lightfoot", { exact: true })).toBeVisible();
  await expect(page.locator(".talent-node")).toHaveCount(10);
  await expect(page.getByText("Coming Soon", { exact: true })).toHaveCount(0);

  const getaway = page.locator(".talent-node").filter({ has: page.getByText("Clean Getaway", { exact: true }) });
  await expect(getaway.locator("p .text-lime-300")).toHaveText("Dodge");
  await expect(getaway.locator("p .text-orange-400")).toHaveText("Burn");
  await expect(getaway.locator("p .text-green-700")).toHaveText("Poison");
  await expect(getaway.locator("p .text-red-600")).toHaveText("Bleed");
  await expect(getaway.locator("p .text-lime-300")).toHaveCSS("font-weight", "600");

  const names = [
    "Lightfoot",
    "Catch Breath",
    "Feint",
    "Thornstep",
    "Clean Getaway",
    "Open Flank",
    "Unburdened",
    "Rolling Recovery",
    "Finding Rhythm",
    "Perfect Timing",
  ];
  for (const [index, name] of names.entries()) {
    const node = page.getByRole("button").filter({ has: page.getByText(name, { exact: true }) });
    await node.focus();
    await node.press(index % 2 === 0 ? "Enter" : "Space");
    await expect(
      page
        .locator(".talent-node")
        .filter({ has: page.getByText(name, { exact: true }) })
        .locator(".talent-card-unlocked"),
    ).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath("dodge-tree.png"), fullPage: true });
});
