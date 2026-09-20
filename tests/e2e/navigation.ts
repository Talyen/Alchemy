import { expect, type Page } from "@playwright/test";
import { GAME_MODE_TITLES, type GameMode } from "./types";

export async function openGameModeSelect(page: Page) {
  const adventureHeading = page.getByRole("heading", { name: "Start a Run" });
  if (await adventureHeading.isVisible()) return;

  const playButton = page.getByRole("button", { name: "Play", exact: true });
  await expect(playButton).toBeEnabled({ timeout: 15000 });

  await expect(async () => {
    await playButton.click();
    await expect(adventureHeading).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

export async function selectGameMode(page: Page, mode: GameMode) {
  await openGameModeSelect(page);
  await page.getByRole("button", { name: GAME_MODE_TITLES[mode] }).click();
}

export async function resumeCampaignRun(page: Page) {
  const destination = page.getByRole("heading", { name: "Choose Destination" });
  const continueButton = page.getByRole("button", { name: "Continue", exact: true });
  try {
    await continueButton.waitFor({ state: "visible", timeout: 3000 });
    await continueButton.click();
  } catch {}
  await expect(destination).toBeVisible({ timeout: 10000 });
}
