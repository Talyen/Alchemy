// Main-menu and game-mode navigation helpers for E2E specs.
import { expect, type Page } from "@playwright/test";
import { GAME_MODE_TITLES, type GameMode } from "./types";

export async function openGameModeSelect(page: Page) {
  const adventureHeading = page.getByRole("heading", { name: "Choose Your Adventure" });
  if (await adventureHeading.isVisible()) return;

  const playButton = page.getByRole("button", { name: "Play", exact: true });
  await expect(playButton).toBeEnabled({ timeout: 15000 });

  await expect(async () => {
    await playButton.click();
    await expect(adventureHeading).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

export async function selectGameMode(page: Page, mode: GameMode, action: "Play" | "Resume" = "Play") {
  await openGameModeSelect(page);
  const modeButton = page.getByRole("button", { name: new RegExp(GAME_MODE_TITLES[mode]) });
  await modeButton.click();
  await expect(modeButton).toHaveAttribute("aria-pressed", "true", { timeout: 5000 });
  const actionButton = page.getByRole("button", { name: action, exact: true });
  await expect(actionButton).toBeEnabled({ timeout: 5000 });
  await actionButton.click();
}

export async function resumeGameMode(page: Page, mode: Exclude<GameMode, "wildwood"> = "campaign") {
  await selectGameMode(page, mode, "Resume");
}

/** Resume campaign when the menu flow is required, or wait if save bootstrap already opened destination. */
export async function resumeCampaignRun(page: Page) {
  const destination = page.getByRole("heading", { name: "Choose Destination" });
  if (await destination.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }
  await resumeGameMode(page, "campaign");
  await expect(destination).toBeVisible({ timeout: 10000 });
}
