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
  const title = GAME_MODE_TITLES[mode];
  const modeButton = page.getByRole("button", {
    name: action === "Resume" ? `Resume ${title}` : title,
  });
  await modeButton.click();
}

async function resumeGameMode(page: Page, mode: Exclude<GameMode, "wildwood"> = "campaign") {
  await selectGameMode(page, mode, "Resume");
}

export async function resumeCampaignRun(page: Page) {
  const destination = page.getByRole("heading", { name: "Choose Destination" });
  const playButton = page.getByRole("button", { name: "Play", exact: true });

  try {
    await playButton.waitFor({ state: "visible", timeout: 3000 });
    await resumeGameMode(page, "campaign");
  } catch {
    // Play button did not appear; we may already be on the destination screen (e.g., bootstrapped save).
  }
  await expect(destination).toBeVisible({ timeout: 10000 });
}
