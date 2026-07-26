import { expect, type Locator, type Page } from "@playwright/test";

export class BattlePage {
  private page: Page;
  readonly hand: Locator;
  readonly manaPanel: Locator;
  readonly playerHealthPanel: Locator;
  readonly enemyHealthPanel: Locator;
  readonly endTurnBtn: Locator;
  readonly victoryHeading: Locator;
  readonly defeatHeading: Locator;
  readonly blockChip: Locator;
  readonly menuBtn: Locator;
  readonly companionPanel: Locator;
  readonly deathsDoorIcon: Locator;
  readonly statusChip: (name: string) => Locator;

  constructor(page: Page) {
    this.page = page;
    this.hand = this.page.locator('[aria-label^="Play "]');
    this.manaPanel = this.page.getByTestId("mana-panel");
    this.playerHealthPanel = this.page.getByTestId("player-health");
    this.enemyHealthPanel = this.page.getByTestId("enemy-health");
    this.endTurnBtn = this.page.getByRole("button", { name: "End Turn" });
    this.victoryHeading = this.page.getByRole("heading", { name: /^Victory/ });
    this.defeatHeading = this.page.getByRole("heading", { name: "Defeat" });
    this.blockChip = this.page.getByRole("button", { name: /^Block \d+$/ }).first();
    this.menuBtn = this.page.getByRole("button", { name: "Menu" });
    this.companionPanel = this.page.getByTestId("active-companion");
    this.deathsDoorIcon = this.page.getByLabel("Death's Door");
    this.statusChip = (name: string) =>
      this.page.getByTestId("enemy-statuses").getByRole("button", { name: new RegExp(`^${name} \\d+$`) });
  }

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
    await this.page
      .getByRole("button", { name: `Play ${name}` })
      .first()
      .click();
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

  async winViaCombat(maxTurns = 6) {
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
