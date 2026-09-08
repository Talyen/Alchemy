import { expect, test } from "@playwright/test";
import { injectSaveState, failOnRuntimeErrors } from "../../helpers";
import { makeTestCard } from "../../fixtures/cards";

for (const width of [1280, 640]) {
  test(`corrupted numbers stay solid while the title shines at ${width}px`, async ({ page }, testInfo) => {
    const errors = failOnRuntimeErrors(page);
    await page.setViewportSize({ width, height: 900 });
    const originalCard = makeTestCard({
      id: "block",
      title: "Block",
      descriptionLines: ["Gain 5 Block"],
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });
    const corruptedCard = {
      ...originalCard,
      corrupted: true,
      descriptionLines: ["Lose 2 Health", "Gain 10 Block"],
      effects: [
        { kind: "lose-health", amount: 2 },
        { kind: "player-status", status: "block", amount: 10 },
      ],
      corruptedValuePositions: [
        { lineIndex: 0, matchIndex: 5 },
        { lineIndex: 1, matchIndex: 5 },
      ],
    };
    await injectSaveState(page, {
      currentScreen: "corruption",
      runDeck: [corruptedCard],
      corruptionResult: { originalCard, corruptedCard, transformed: false, delta: 1 },
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Altar of Corruption" })).toBeVisible();
    await page.getByRole("button", { name: "Result: Corrupted Block", exact: true }).hover();
    const popup = page.locator('#tooltip-root [data-visible="true"]');
    await expect(popup).toBeVisible();
    const numbers = popup.locator(".text-destructive");
    await expect(numbers).toHaveText(["2", "10"]);
    for (const number of await numbers.all()) {
      await expect(number).toHaveCSS("animation-name", "none");
      await expect(number).toHaveCSS("background-image", "none");
      await expect(number).toHaveCSS("color", "rgb(172, 57, 57)");
    }
    const prefix = popup.locator(".text-shine-corruption");
    await expect(prefix).toHaveText("Corrupted ");
    await expect(prefix).toHaveCSS("animation-name", "boss-title-shine");
    await expect(popup.getByText("Health", { exact: true })).toHaveClass(/text-red-400/);
    await expect(popup.getByText("Block", { exact: true })).toHaveClass(/text-sky-300/);
    await page.screenshot({ path: testInfo.outputPath("corruption-result.png") });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
