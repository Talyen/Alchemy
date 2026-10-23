import { expect, type Page } from "@playwright/test";
import { injectActiveBattle, enterPrimaryRewardScreen, makeCard, makeGoblinBattleState } from "../browser-helpers";
import { MenuPage } from "../pages/menu-page";
import { resumeInjectedRun } from "../e2e/navigation";
import { translatedLabel, type AcceptanceLocale } from "../e2e/localization";

/** Shared checkpoint for pixel baselines and ad-hoc original/candidate review. */
export async function openVisualBattle(page: Page) {
  const cards = [makeCard({ uid: 101 }), makeCard({ id: "block", uid: 102 }), makeCard({ id: "apple", uid: 103 })];
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards, deck: cards, appliesFightPacing: false }), {
    runDeck: cards,
  });
}

export async function openVisualScenario(page: Page, scenario: string, locale = "en") {
  const label = (english: string) => (locale === "en" ? english : translatedLabel(locale as AcceptanceLocale, english));
  const activeRun = ["battle", "card-inspection", "rewards"].includes(scenario);
  if (scenario === "battle" || scenario === "card-inspection") await openVisualBattle(page);
  else if (scenario === "rewards")
    await enterPrimaryRewardScreen(page, { rewardType: "card", choiceIds: ["slash", "bash"], selectedId: "bash" });
  else if (scenario === "homestead") await new MenuPage(page).gotoWithUnlockedMeta();
  else await new MenuPage(page).goto();

  // Existing injection helpers enter their checkpoint in English. Switch only
  // after injection, then use the player's localized Continue action on reload.
  if (locale !== "en") {
    await page.addInitScript((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await page.evaluate((value) => localStorage.setItem("alchemy-language-v1", value), locale);
    await page.reload();
    if (activeRun) await resumeInjectedRun(page, label("Continue"));
  }
  if (scenario === "battle" || scenario === "card-inspection") {
    // Hand slots retain their identity across locales; card action names translate.
    const hand = page.locator("[data-hand-slot]");
    await expect(hand).toHaveCount(3);
    await expect(hand.first()).toBeVisible();
  }
  if (scenario === "options" || scenario === "homestead") {
    const title = label(scenario === "options" ? "Options" : "Homestead");
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  } else if (scenario === "card-inspection") {
    await page.getByTestId("draw-pile").getByRole("button").click();
    await expect(page.getByRole("dialog", { name: label("Draw Pile"), exact: true })).toBeVisible();
  } else if (scenario === "rewards") {
    await expect(page.getByRole("heading", { name: label("Victory"), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: label("Skip"), exact: true })).toBeEnabled();
  } else if (scenario === "battle") {
    await expect(page.getByTestId("battle-scene")).toBeVisible();
  } else {
    await expect(page.getByRole("img", { name: "Alchemy logo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: label("Play"), exact: true })).toBeEnabled();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.getByTestId("vr-stage")).toBeVisible();
}
