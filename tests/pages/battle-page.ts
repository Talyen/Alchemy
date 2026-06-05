import { expect, type Page } from "@playwright/test";

export class BattlePage {
  constructor(private page: Page) {}

  readonly hand = this.page.locator('[aria-label^="Play "]');
  readonly manaPanel = this.page.getByTestId("mana-panel");
  readonly playerHealthPanel = this.page.getByTestId("player-health");
  readonly enemyHealthPanel = this.page.getByTestId("enemy-health");
  readonly endTurnBtn = this.page.getByRole("button", { name: "End Turn" });
  readonly victoryHeading = this.page.getByRole("heading", { name: /^Victory/ });
  readonly defeatHeading = this.page.getByRole("heading", { name: "Defeat" });
  readonly blockChip = this.page.getByRole("button", { name: /^Block \d+$/ }).first();
  readonly menuBtn = this.page.getByRole("button", { name: "Menu" });
  readonly companionPanel = this.page.getByTestId("active-companion");
  readonly deathsDoorIcon = this.page.getByLabel("Death's Door");
  readonly statusChip = (name: string) => this.page.getByRole("button", { name: new RegExp(`^${name} \\d+$`) });

  async mana(): Promise<number> {
    return Number(await this.manaPanel.getAttribute("data-mana"));
  }

  async playerHealth(): Promise<number> {
    const text = await this.playerHealthPanel.textContent();
    return Number(text?.split("/")[0] ?? 30);
  }

  async enemyHealth(): Promise<number> {
    const text = await this.enemyHealthPanel.textContent();
    return Number(text?.split("/")[0] ?? 30);
  }

  async block(): Promise<number> {
    if (!(await this.blockChip.isVisible({ timeout: 2000 }).catch(() => false))) return 0;
    const label = await this.blockChip.getAttribute("aria-label");
    return Number(label?.match(/\d+/)?.[0] ?? 0);
  }

  async playFirstCard() {
    await this.hand.first().click();
  }

  async playCardNamed(name: string) {
    await this.page.getByRole("button", { name: `Play ${name}` }).first().click();
  }

  async endTurn() {
    if (await this.isBattleOver()) return;
    const turnTimeout = process.env.CI ? 10_000 : 5_000;
    const settleTimeout = process.env.CI ? 25_000 : 12_000;

    await expect(async () => {
      if (await this.isBattleOver()) return;
      const endTurn = this.page.getByRole("button", { name: "End Turn" });
      await expect(endTurn).toBeEnabled({ timeout: turnTimeout });
      await endTurn.click({ force: true });
    }).toPass({ timeout: settleTimeout });

    await expect(async () => {
      if (await this.isBattleOver()) return;
      const endTurn = this.page.getByRole("button", { name: "End Turn" });
      await expect(endTurn).toBeEnabled({ timeout: 3_000 });
    }).toPass({ timeout: settleTimeout });
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
      if (!(await card.isVisible({ timeout: 1000 }).catch(() => false))) break;
      if (!(await card.isEnabled({ timeout: 1000 }).catch(() => false))) break;
      await card.click({ force: true, timeout: 2000 }).catch(async (e) => {
        if (await this.isBattleOver()) return;
        throw e;
      });
      if (await this.isBattleOver()) return;
    }
  }

  /** Win by playing cards and ending turns — works in preview/production builds. */
  async winViaCombat(maxTurns = 12) {
    for (let turn = 0; turn < maxTurns; turn++) {
      if (await this.isBattleOver()) break;
      await this.playAllCards();
      if (await this.isVictoryVisible()) break;
      if (await this.isBattleOver()) break;
      await this.endTurn();
      if (await this.isVictoryVisible()) break;
    }
    await expect(this.victoryHeading).toBeVisible({ timeout: 8000 });
  }

}
