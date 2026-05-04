import { expect, test } from "@playwright/test";

const supportedResolutions = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];

async function playUntilVictory(page: Parameters<typeof test>[0]["page"]) {
  const victoryHeading = page.getByRole("heading", { name: "Victory!" });

  for (let turn = 0; turn < 12; turn += 1) {
    if (await victoryHeading.isVisible().catch(() => false)) {
      return;
    }

    while ((await page.locator('[aria-label^="Play "]').count()) > 0) {
      await page.locator('[aria-label^="Play "]').first().click();
      await page.waitForTimeout(220);

      if (await victoryHeading.isVisible().catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1400);
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

async function waitForEnemyTurn(page: Parameters<typeof test>[0]["page"]) {
  const endTurnButton = page.getByRole("button", { name: "End Turn" });
  await endTurnButton.click();
  await expect(endTurnButton).toBeEnabled({ timeout: 8000 });
}

async function startRun(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  // Select the Knight character, then click Continue
  await page.getByRole("button", { name: "Knight" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
}

test("block card applies block status chip", async ({ page }) => {
  await startRun(page);

  // Look for Block in the initial hand.
  const blockCard = page.getByRole("button", { name: "Play Block" });
  if (!(await blockCard.isVisible({ timeout: 500 }).catch(() => false))) {
    test.skip(true, "Block card not in initial hand");
    return;
  }

  await blockCard.click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible();

  // End enemy phase. With 5 block, enemy 8 attack → 3 damage. Health → 27.
  await waitForEnemyTurn(page);
  await expect(page.locator("text=/27\\/30/").first()).toBeVisible({ timeout: 3000 });

  // Block consumed to 0 and halved → chip gone.
  await expect(page.getByRole("button", { name: /^Block/ })).toHaveCount(0);
});

test("block absorbs attack damage and halves", async ({ page }) => {
  await startRun(page);

  const blockCard = page.getByRole("button", { name: "Play Block" });
  if (!(await blockCard.isVisible({ timeout: 500 }).catch(() => false))) {
    test.skip(true, "Block card not in initial hand");
    return;
  }

  // Record health before damage.
  const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
  const hpBefore = Number(hpText?.split("/")[0]);

  await blockCard.click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible();

  await waitForEnemyTurn(page);

  const hpAfterText = await page.locator("text=/\\d+\\/30/").first().textContent();
  const hpAfter = Number(hpAfterText?.split("/")[0]);
  const hpLost = hpBefore - hpAfter;

  // With 5 block, enemy 8 attack → at most 3 damage (not full 8).
  expect(hpLost).toBeLessThanOrEqual(3);
  expect(hpLost).toBeGreaterThanOrEqual(0);
});

test("blessed aegis deals holy damage equal to current block", async ({ page }) => {
  await startRun(page);

  const blockCard = page.getByRole("button", { name: "Play Block" });
  const aegisCard = page.getByRole("button", { name: "Play Blessed Aegis" });
  if (!(await blockCard.isVisible({ timeout: 500 }).catch(() => false))
    || !(await aegisCard.isVisible({ timeout: 500 }).catch(() => false))) {
    test.skip(true, "Block and Blessed Aegis must both be in initial hand");
    return;
  }

  await blockCard.click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible();

  await aegisCard.click();
  await page.waitForTimeout(300);

  // Block remains 5 (fromBlock doesn't consume it). Enemy: 30 - 5 = 25.
  await expect(page.locator("text=/25\\/30/").last()).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible();
});

test("options page exposes the display resolution selector", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Options" }).click();

  await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
  await expect(page.getByLabel("Resolution")).toHaveValue("1920x1080");
  await page.getByLabel("Resolution").selectOption("2560x1440");
  await expect(page.getByLabel("Resolution")).toHaveValue("2560x1440");
});

test("multiple copies of the same card in hand can be hovered and played independently", async ({ page }) => {
  await startRun(page);

  const playableCards = page.locator('[aria-label^="Play "]');

  const handBefore = await playableCards.count();
  expect(handBefore).toBeGreaterThanOrEqual(2);

  await playableCards.nth(0).hover();
  await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

  await playableCards.nth(1).hover();
  await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

  await playableCards.nth(0).click();
  await page.waitForTimeout(300);

  const handAfterFirst = await playableCards.count();
  expect(handAfterFirst).toBe(handBefore - 1);

  await playableCards.nth(0).click();
  await page.waitForTimeout(300);

  const handAfterSecond = await playableCards.count();
  expect(handAfterSecond).toBe(handAfterFirst - 1);
});

test("collection tabs expose known and undiscovered compendium entries", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Collection" }).click();

  await expect(page.getByRole("heading", { name: "Collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();

  await page.getByRole("button", { name: "Inspect Slash" }).hover();
  await expect(page.getByText("Deal 5")).toBeVisible();

  await page.getByRole("button", { name: "Bestiary" }).click();
  await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
  await expect(page.getByText("Undiscovered").first()).toBeVisible();

  await page.getByRole("button", { name: "Trinkets" }).click();
  await page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first().hover();
  await expect(page.getByText("Undiscovered").first()).toBeVisible();
});

test("victory reward requires confirmation before advancing to destinations", async ({ page }) => {
  await startRun(page);

  await playUntilVictory(page);

  const addCardButton = page.getByRole("button", { name: "Add Card" });
  await expect(addCardButton).toBeDisabled();

  await page.locator('[aria-label^="Select "]').first().click();
  await expect(addCardButton).toBeEnabled();

  await addCardButton.click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
});

for (const resolution of supportedResolutions) {
  test(`battle fits without scrolling and allows card play at ${resolution.width}x${resolution.height}`, async ({ page }) => {
    await page.setViewportSize({ width: resolution.width, height: resolution.height });
    await startRun(page);

    const playableCards = page.locator('[aria-label^="Play "]');
    await expect(playableCards.first()).toBeVisible();

    const cardsBeforePlay = await playableCards.count();
    const firstCard = playableCards.first();
    await firstCard.hover();

    await expect(page.locator(".hover-popup-quick-in")).toBeVisible();

    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));

    expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight);

    await firstCard.click();
    await expect(playableCards).toHaveCount(Math.max(0, cardsBeforePlay - 1));
  });
}