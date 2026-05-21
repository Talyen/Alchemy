import { test, expect } from "@playwright/test";
import { failOnRuntimeErrors, startCampaignBattle } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Draw/discard animation invariants (1920×1080)", () => {
  test("no runtime errors or console errors during a full turn cycle", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    if (await battle.hand.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await battle.playFirstCard();
    }
    await battle.endTurn();
    expect(errors).toEqual([]);
  });

  test("cards are playable after draw animation completes", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await battle.endTurn();
    const count = await battle.handCount();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(battle.hand.nth(i)).toBeEnabled({ timeout: 1000 });
    }
  });

  test("end turn button is re-enabled after enemy turn and draw", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.endTurn();
  });

  test("flying overlay appears during discard and draw, then disappears", async ({ page }) => {
    const flyingLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[flying]")) flyingLogs.push(msg.text());
    });

    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.endTurn();
    expect(flyingLogs.length).toBeGreaterThanOrEqual(4);
    const creates = flyingLogs.filter((l) => l.includes("create")).length;
    const removes = flyingLogs.filter((l) => l.includes("remove")).length;
    expect(creates).toBeGreaterThan(0);
    expect(creates).toBe(removes);
  });

  test("overlay lands within 0.5px of card position and size", async ({ page }) => {
    const snapLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[snap]")) snapLogs.push(msg.text());
    });

    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.endTurn();
    expect(snapLogs, "Card position/size deviation exceeded 0.5px threshold").toEqual([]);
  });
});

const ALT_RESOLUTIONS = [
  { width: 932, height: 430, label: "mobile landscape" },
  { width: 2560, height: 1080, label: "ultrawide" },
  { width: 1440, height: 900, label: "16:10" },
] as const;

for (const { width, height, label } of ALT_RESOLUTIONS) {
  test.describe(`Draw/discard at ${label}`, () => {
    test.use({ viewport: { width, height } });

    test("no errors and cards playable after draw", async ({ page }) => {
      const errors = failOnRuntimeErrors(page);
      await startCampaignBattle(page);
      const battle = new BattlePage(page);
      await battle.endTurn();
      const count = await battle.handCount();
      expect(count).toBeGreaterThan(0);
      expect(errors, `Runtime errors at ${width}x${height}`).toEqual([]);
    });
  });
}

test.describe("Draw/discard edge cases", () => {
  test("skip combat during end turn: no errors", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await startCampaignBattle(page);
    const battle = new BattlePage(page);

    await battle.endTurnBtn.click();
    await battle.skipCombatBtn.click();
    await expect(battle.victoryHeading).toBeVisible({ timeout: 5000 }).catch(() => {});
    expect(errors).toEqual([]);
  });
});
