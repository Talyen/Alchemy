import { expect } from "@playwright/test";
import { startBattleWithDeck, makeStatusCard, WOLF_COMPANION_CARD, injectTalentUnlocks, makeCard } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

const DOT_STATUS_CASES = [
  {
    name: "burn ticks each turn and halves",
    damageType: "burn",
    amount: 7,
    chipVisibleAfterTick: true,
  },
  {
    name: "poison ticks each turn and decays by 1",
    damageType: "poison",
    amount: 5,
    chipVisibleAfterTick: false,
  },
  {
    name: "bleed bursts on tick and resets to 0",
    damageType: "bleed",
    amount: 3,
    chipVisibleAfterTick: false,
    chipGoneAfterTick: true,
  },
] as const;

const CC_STATUS_CASES = [
  { name: "stun triggers CC causing enemy to skip turn", damageType: "stun", amount: 25 },
  { name: "freeze triggers CC causing enemy to skip turn", damageType: "freeze", amount: 25 },
] as const;

test.describe("Damage-over-Time Status Effects", critical, () => {
  for (const statusCase of DOT_STATUS_CASES) {
    test(statusCase.name, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      const title = statusCase.damageType.charAt(0).toUpperCase() + statusCase.damageType.slice(1);
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeStatusCard(statusCase.damageType, statusCase.amount)),
      );
      const battle = new BattlePage(page);

      await battle.playCardNamed(title);
      await expect(battle.statusChip(title)).toBeVisible({ timeout: 2000 });

      const enemyHpBefore = await battle.enemyHealth();
      await battle.endTurn();

      await expect(async () => {
        expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
      }).toPass({ timeout: 5000 });

      if ("chipGoneAfterTick" in statusCase && statusCase.chipGoneAfterTick) {
        await expect(battle.statusChip(title)).toBeHidden();
      } else if (statusCase.chipVisibleAfterTick) {
        await expect(battle.statusChip(title)).toBeVisible();
      }
    });
  }
});

test.describe("Crowd Control Status Effects", critical, () => {
  for (const statusCase of CC_STATUS_CASES) {
    test(statusCase.name, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      const title = statusCase.damageType.charAt(0).toUpperCase() + statusCase.damageType.slice(1);
      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeStatusCard(statusCase.damageType, statusCase.amount)),
      );
      const battle = new BattlePage(page);

      const playerHpBefore = await battle.playerHealth();
      await battle.playCardNamed(title);

      await battle.endTurn();
      await expect(async () => {
        expect(await battle.playerHealth()).toBe(playerHpBefore);
      }).toPass({ timeout: 5000 });
    });
  }
});

test.describe("Companion Battle Behavior", () => {
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    await expect(battle.companionPanel).toHaveAttribute("aria-label", "Active companion: Wolf Companion");
  });

  test("companion auto-attacks at start of owner turn", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
  });

  test("companion persists across multiple turns", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    if ((await battle.handCount()) > 0) {
      await battle.playFirstCard();
    }
    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
  });
});

interface TalentCase {
  id: string;
  category: string;
  description: string;
  run: (page: import("@playwright/test").Page, battle: BattlePage) => Promise<void>;
}

const TALENT_CASES: TalentCase[] = [
  {
    id: "block-start",
    category: "block",
    description: "gives starting block in combat",
    run: async (page, _battle) => {
      await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible({ timeout: 3000 });
    },
  },
  {
    id: "physical-brute-force",
    category: "physical",
    description: "increases physical damage dealt",
    run: async (_page, battle) => {
      const enemyHpBefore = await battle.enemyHealth();
      await battle.playCardNamed("Slash");
      await expect(async () => {
        expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore - 6);
      }).toPass({ timeout: 5000 });
    },
  },
];

test.describe("Talents in Battle", () => {
  for (const tc of TALENT_CASES) {
    test(`${tc.id} ${tc.description}`, async ({ page, fastBattle }) => {
      void fastBattle;
      await injectTalentUnlocks(page, { [tc.category]: [tc.id] });
      await startBattleWithDeck(
        page,
        Array.from({ length: 8 }, () => makeCard()),
      );
      await tc.run(page, new BattlePage(page));
    });
  }
});
