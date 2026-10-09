import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { launchElectronApp, getElectronMainWindow } from "./electron-helpers";
import {
  injectSaveState,
  injectActiveBattle,
  makeCard,
  makeGoblinBattleState,
  failOnRuntimeErrors,
} from "../browser-helpers";
import { savedActivityFixture } from "../fixtures/run-activity";
import { ShopPage } from "../pages/shop-page";
import { BattlePage } from "../pages/battle-page";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

function saved(profile: string) {
  const candidates = [
    "save.json",
    "save-recovery.json",
    ...[1, 2, 3].flatMap((i) => [`save.json.bak.${i}`, `save-recovery.json.bak.${i}`]),
  ]
    .filter((name) => fs.existsSync(path.join(profile, name)))
    .flatMap((name) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(profile, name), "utf8")) as SaveData];
      } catch {
        // An interrupted write can leave an unreadable slot; the backup ring
        // must still contain a complete acknowledged snapshot.
        return [];
      }
    })
    .sort((a, b) => b.lastSavedAt - a.lastSavedAt);
  const latest = candidates[0];
  if (!latest) throw new Error("No readable save survived interruption");
  return latest;
}
async function quote(page: Page) {
  const text = await new ShopPage(page).buyBtn.first().locator("span.tabular-nums").last().innerText();
  const price = Number(text.replaceAll(",", ""));
  expect(price).toBeGreaterThan(0);
  return price;
}
async function terminate(app: ElectronApplication) {
  const child = app.process();
  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
  child.kill("SIGKILL");
  await exited;
}
async function prepare(page: Page, kind: "purchase" | "reward" | "victory") {
  if (kind === "purchase") {
    await injectSaveState(page, {
      runGold: 100,
      runDeck: [makeCard()],
      activity: savedActivityFixture("shop", {
        cards: [makeCard()],
        refreshesLeft: 1,
        purchasedSlotKeys: [],
        removeUsed: false,
        firstPurchaseUsed: false,
        freeRefreshUsed: false,
      }),
    });
    const shop = new ShopPage(page);
    await expect(shop.buyBtn.first()).toBeVisible();
    return () => shop.buyCard();
  }
  if (kind === "reward") {
    await injectSaveState(page, {
      runDeck: [makeCard()],
      activity: savedActivityFixture("rewards", {
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: ["Normal Combat", "Campfire"],
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
        rewardType: "card",
        choiceIds: ["block"],
        companionChoiceIds: [],
      }),
    });
    const choice = page.locator('[aria-label^="Select "]').first();
    await expect(choice).toBeVisible();
    return () => choice.click();
  }
  const card = makeCard({ cost: 0 });
  await injectActiveBattle(
    page,
    makeGoblinBattleState({ hand: [card], enemyHealth: 1, enemyCC: { stunSkipTurns: 1 } }),
    {
      runDeck: [card],
      autoEndTurn: false,
    },
  );
  const battle = new BattlePage(page);
  await battle.waitForOpeningHand();
  return () => battle.playFirstCard();
}

for (const kind of ["purchase", "reward", "victory"] as const) {
  test(
    `${kind} survives abrupt termination immediately after visible completion`,
    { tag: "@interaction-canary" },
    async () => {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-crash-"));
      let app: ElectronApplication | undefined;
      try {
        app = await launchElectronApp({ packagedRenderer: true, profile });
        let page = await getElectronMainWindow(app);
        const errors = failOnRuntimeErrors(page);
        const action = await prepare(page, kind);
        const before = saved(profile);
        const price = kind === "purchase" ? await quote(page) : 0;
        await action();
        if (kind === "purchase") await new ShopPage(page).waitForPurchase();
        else
          await expect(
            page.getByRole("heading", { name: kind === "reward" ? "Choose Destination" : "Victory", exact: true }),
          ).toBeVisible();
        await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
        const completed = saved(profile);
        expect(completed).not.toEqual(before);
        if (kind === "purchase") {
          expect(completed.gold).toBe(before.gold - price);
          expect(completed.activeRun!.runDeck).toHaveLength(before.activeRun!.runDeck.length + 1);
        }
        expect(errors).toEqual([]);
        await terminate(app);
        app = undefined;
        app = await launchElectronApp({ packagedRenderer: true, profile });
        page = await getElectronMainWindow(app);
        const resumedErrors = failOnRuntimeErrors(page);
        await expect(
          page.getByRole("heading", {
            name: kind === "purchase" ? "Card Shop" : kind === "reward" ? "Choose Destination" : "Victory",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByText("Saving…", { exact: true })).toHaveCount(0);
        const restored = saved(profile);
        expect(restored.gold).toBe(completed.gold);
        expect(restored.materialInventory).toEqual(completed.materialInventory);
        expect(restored.activeRun?.runDeck.map((card) => card.uid)).toEqual(
          completed.activeRun?.runDeck.map((card) => card.uid),
        );
        expect(restored.activeRun?.activity).toEqual(completed.activeRun?.activity);
        if (kind === "purchase") {
          const shop = new ShopPage(page);
          await expect(shop.buyBtn).toHaveCount(0);
        } else if (kind === "reward")
          expect(restored.activeRun?.runDeck).toHaveLength(before.activeRun!.runDeck.length + 1);
        else expect(restored.activeRun?.activity.kind).toBe("rewards");
        expect(resumedErrors).toEqual([]);
      } finally {
        await app?.close();
        fs.rmSync(profile, { recursive: true, force: true });
      }
    },
  );
}

for (const stage of [
  "before-submit",
  "before-write",
  "after-temp-write",
  "after-temp-sync",
  "after-backup-rotation",
  "after-replace",
] as const) {
  test(`interrupted purchase recovers coherently at ${stage}`, { tag: "@interaction-nightly" }, async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-crash-stage-"));
    let app: ElectronApplication | undefined;
    try {
      app = await launchElectronApp({ packagedRenderer: true, profile });
      let page = await getElectronMainWindow(app);
      const errors = failOnRuntimeErrors(page);
      const action = await prepare(page, "purchase");
      const before = saved(profile);
      const price = await quote(page);
      fs.writeFileSync(path.join(profile, "save-barrier.json"), JSON.stringify({ stage }));
      await action();
      await expect.poll(() => fs.existsSync(path.join(profile, "save-barrier.reached"))).toBe(true);
      await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
      await expect(new ShopPage(page).purchasedText).toHaveCount(0);
      expect(errors).toEqual([]);
      await terminate(app);
      app = undefined;
      const recovered = saved(profile);
      expect([before.activeRun!.runDeck.length, before.activeRun!.runDeck.length + 1]).toContain(
        recovered.activeRun!.runDeck.length,
      );
      if (stage === "after-replace")
        expect(recovered.activeRun!.runDeck).toHaveLength(before.activeRun!.runDeck.length + 1);
      const acquired = recovered.activeRun!.runDeck.length > before.activeRun!.runDeck.length;
      expect(recovered.gold).toBe(acquired ? before.gold - price : before.gold);
      expect(recovered.activeRun!.activity.kind).toBe("shop");
      app = await launchElectronApp({ packagedRenderer: true, profile });
      page = await getElectronMainWindow(app);
      const resumedErrors = failOnRuntimeErrors(page);
      await expect(page.getByRole("heading", { name: "Card Shop", exact: true })).toBeVisible();
      const shop = new ShopPage(page);
      if (!acquired) {
        await shop.buyCard();
        await shop.waitForPurchase();
      }
      expect(saved(profile).activeRun!.runDeck).toHaveLength(before.activeRun!.runDeck.length + 1);
      expect(saved(profile).gold).toBe(before.gold - price);
      expect(resumedErrors).toEqual([]);
    } finally {
      await app?.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
}
