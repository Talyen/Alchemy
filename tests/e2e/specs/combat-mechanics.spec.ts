import { expect, type Page } from "@playwright/test";
import {
  startBattleWithDeck,
  injectActiveBattle,
  makeGoblinBattleState,
  makeStatusCard,
  WOLF_COMPANION_CARD,
  makeCard,
  seedRandom,
  boxesOverlap,
  AEGIS_CARD,
  BLOCK_CARD,
  ANVIL_CARD,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { test } from "../../fixtures/e2e";
import { critical, slow } from "../../playwright-tags";

const DOT_STATUS_CASES = [
  {
    name: "burn ticks each turn and halves",
    damageType: "burn",
    amount: 7,
    chipVisibleAfterTick: true,
  },
  {
    name: "bleed bursts on tick and resets to 0",
    damageType: "bleed",
    amount: 3,
    chipVisibleAfterTick: false,
    chipGoneAfterTick: true,
  },
] as const;

const DOT_ENCOUNTER_OVERRIDES = { encounteredRunEnemyIds: ["goblin"] };

test.describe("Damage-over-Time Status Effects", () => {
  for (const statusCase of DOT_STATUS_CASES) {
    const body = async ({ page, fastBattle }: { page: Page; fastBattle: void }) => {
      void fastBattle;

      await seedRandom(page, 42);
      const title = statusCase.damageType.charAt(0).toUpperCase() + statusCase.damageType.slice(1);
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeStatusCard(statusCase.damageType, statusCase.amount)),
        DOT_ENCOUNTER_OVERRIDES,
      );
      const battle = new BattlePage(page);

      await battle.playCardNamed("Slash");
      await expect(battle.statusChip(title)).toBeVisible({ timeout: 2000 });

      await battle.endTurn();

      await expect(battle.victoryHeading).toBeHidden();

      if ("chipGoneAfterTick" in statusCase && statusCase.chipGoneAfterTick) {
        await expect(battle.statusChip(title)).toBeHidden();
      } else if (statusCase.chipVisibleAfterTick) {
        await expect(battle.statusChip(title)).toBeVisible();
      }
    };
    if (statusCase.damageType === "burn") {
      test(statusCase.name, critical, body);
    } else {
      test(statusCase.name, slow, body);
    }
  }
});

test.describe("Companion Battle Behavior", critical, () => {
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    await expect(battle.companionPanel).toHaveAttribute("aria-label", "Active companion: Wolf Companion");

    await expect(async () => {
      const companionBox = await battle.companionPanel.boundingBox();
      const healthBox = await battle.playerHealthPanel.boundingBox();
      expect(companionBox && healthBox).toBeTruthy();
      if (!companionBox || !healthBox) return;
      expect(boxesOverlap(companionBox, healthBox)).toBe(false);
    }).toPass();
  });
});

test.describe("Battle Autoplay", critical, () => {
  test("plays a hand card without clicking it", async ({ page, fastBattle }) => {
    void fastBattle;
    // Keep combat alive so the assertion observes card play, not disappearing HUD controls.
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand: Array.from({ length: 4 }, () => makeCard({ cost: 1 })),
        enemyHealth: 200,
        enemyMaxHealth: 200,
      }),
      { autoEndTurn: false, autoplayEnabled: false },
    );
    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(4);
    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "false");

    await battle.autoplayToggle.click();

    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => battle.handCount()).toBeLessThan(4);
    await expect.poll(() => battle.enemyHealth()).toBeLessThan(200);
  });
});

test.describe("Block and Status Invariants", () => {
  test("blessed aegis plays against a live block value", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(page, [BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD, BLOCK_CARD, AEGIS_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Block");
    await expect.poll(async () => battle.block(), { timeout: 8000 }).toBeGreaterThan(0);
    const blockBeforeAegis = await battle.block();
    const enemyHealthBeforeAegis = await battle.enemyHealth();

    await battle.playCardNamed("Blessed Aegis");
    await expect.poll(async () => battle.enemyHealth(), { timeout: 10_000 }).toBeLessThan(enemyHealthBeforeAegis);
    await expect.poll(async () => battle.block(), { timeout: 5000 }).toBe(blockBeforeAegis);
  });

  test("forge status persists across end turn", async ({ page, fastBattle }) => {
    void fastBattle;
    await startBattleWithDeck(page, [ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Anvil");
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await battle.endTurn();
    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });
});
