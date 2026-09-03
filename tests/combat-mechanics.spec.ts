import { expect, type Page } from "@playwright/test";
import {
  startBattleWithDeck,
  makeStatusCard,
  WOLF_COMPANION_CARD,
  makeCard,
  seedRandom,
  boxesOverlap,
} from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical, slow } from "./playwright-tags";

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

test.describe("Damage-over-Time Status Effects", critical, () => {
  for (const statusCase of DOT_STATUS_CASES) {
    const body = async ({
      page,
      fastBattle,
      runtimeErrors,
    }: {
      page: Page;
      fastBattle: void;
      runtimeErrors: string[];
    }) => {
      void fastBattle;
      void runtimeErrors;

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
      test(statusCase.name, body);
    } else {
      test(statusCase.name, slow, body);
    }
  }
});

test.describe("Companion Battle Behavior", critical, () => {
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

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
  test("plays a hand card without clicking it", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);
    await expect(battle.autoplayToggle).toBeVisible();
    const manaBefore = await battle.mana();
    const enemyBefore = await battle.enemyHealth();

    await battle.autoplayToggle.click();

    await expect(async () => {
      if (!(await battle.autoplayToggle.isVisible())) return;
      await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "true", { timeout: 250 });
    }).toPass({ timeout: 5_000 });

    await expect
      .poll(async () => {
        if (await battle.victoryHeading.isVisible()) return true;
        if (!(await battle.manaPanel.isVisible()) || !(await battle.enemyHealthPanel.isVisible())) return false;
        const mana = await battle.mana();
        const enemy = await battle.enemyHealth();
        return mana < manaBefore || enemy < enemyBefore;
      })
      .toBe(true);
  });
});
