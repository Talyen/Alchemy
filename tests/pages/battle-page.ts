import { expect, type Page } from "@playwright/test";

export class BattlePage {
  constructor(private page: Page) {}

  readonly hand = this.page.locator('[aria-label^="Play "]');
  readonly manaPanel = this.page.getByTestId("mana-panel");
  readonly endTurnBtn = this.page.getByRole("button", { name: "End Turn" });
  readonly victoryHeading = this.page.getByRole("heading", { name: /^Victory/ });
  readonly defeatHeading = this.page.getByRole("heading", { name: "Defeat" });
  readonly blockChip = this.page.getByRole("button", { name: /^Block \d+$/ }).first();
  readonly skipCombatBtn = this.page.getByRole("button", { name: "Skip Combat" });
  readonly menuBtn = this.page.getByRole("button", { name: "Menu" });

  async mana(): Promise<number> {
    return Number(await this.manaPanel.getAttribute("data-mana"));
  }

  async block(): Promise<number> {
    if (!(await this.blockChip.isVisible({ timeout: 300 }).catch(() => false))) return 0;
    const label = await this.blockChip.getAttribute("aria-label");
    return Number(label?.match(/\d+/)?.[0] ?? 0);
  }

  async playFirstCard() {
    await this.hand.first().click();
  }

  async playCardNamed(name: string) {
    await this.page.getByRole("button", { name: `Play ${name}` }).click();
  }

  async endTurn() {
    await expect(this.endTurnBtn).toBeEnabled({ timeout: 8000 });
    await this.endTurnBtn.click();
    await expect(this.endTurnBtn).toBeEnabled({ timeout: 8000 });
  }

  async isVictoryVisible(): Promise<boolean> {
    return this.victoryHeading.isVisible().catch(() => false);
  }

  async isBattleOver(): Promise<boolean> {
    return (await this.isVictoryVisible()) || (await this.defeatHeading.isVisible().catch(() => false));
  }

  async handCount(): Promise<number> {
    return this.hand.count();
  }

  async playAllCards() {
    for (let i = 0; i < 8; i++) {
      const card = this.hand.filter({ visible: true }).first();
      if (!(await card.isVisible({ timeout: 200 }).catch(() => false))) break;
      if (!(await card.isEnabled({ timeout: 200 }).catch(() => false))) break;
      await card.click({ force: true }).catch(() => {});
      if (await this.isBattleOver()) return;
    }
  }

  async fightTurns(maxTurns = 12) {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (await this.isBattleOver()) return;
      await this.playAllCards();
      if (await this.isBattleOver()) return;
      await this.endTurnBtn.click({ force: true }).catch(() => {});
      await expect(this.endTurnBtn).toBeEnabled({ timeout: 8000 }).catch(async (e) => {
        if (await this.isBattleOver()) return;
        throw e;
      });
    }
    throw new Error("Battle did not reach the Victory screen in time.");
  }
}
