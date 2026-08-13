import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { BattlePage } from "../tests/pages/battle-page";
import { battleStageMarkName, type BattleStageMarkName } from "./battle-stage-mark-names";
import { delay } from "./delay";

export async function playHandCard(page: Page, index = 0): Promise<void> {
  const card = page.locator('[aria-label^="Play "]').nth(index);
  await expect(card).toBeAttached({ timeout: 10_000 });
  await card.evaluate((el) => {
    const button = el.closest("button") ?? el;
    (button as HTMLButtonElement).click();
  });
}

/** Hand cards can start at opacity 0 during the screen fade-in. */
export async function waitForHandPlayable(page: Page, timeoutMs = 15_000): Promise<void> {
  const hand = page.locator('[aria-label^="Play "]');
  await expect(hand.first()).toBeAttached({ timeout: timeoutMs });
  await expect
    .poll(
      async () => {
        const count = await hand.count();
        if (count === 0) return false;
        return hand.first().evaluate((el) => {
          const button = el.closest("button") ?? el;
          if (button instanceof HTMLButtonElement && button.disabled) return false;
          const style = getComputedStyle(button);
          const opacity = Number.parseFloat(style.opacity);
          return style.visibility !== "hidden" && opacity > 0.05;
        });
      },
      { timeout: timeoutMs, intervals: [50, 100, 200] },
    )
    .toBe(true);
}

/** Wait for card-travel ghost to clear, then a beat for combat float text. */
export async function waitForCardPlayFx(page: Page, options: { lingerMs?: number } = {}): Promise<void> {
  const lingerMs = options.lingerMs ?? 400;
  const ghosts = page.locator(".card-ghost-overlay");
  await ghosts
    .first()
    .waitFor({ state: "visible", timeout: 1500 })
    .catch(() => undefined);
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    if ((await ghosts.count()) === 0) break;
    await delay(50);
  }
  await delay(lingerMs);
}

/**
 * Play up to `maxCards` from hand with short gaps so multi-type combat texts overlap,
 * then linger before the caller ends the turn.
 */
export async function playDenseHand(
  page: Page,
  battle: BattlePage,
  options: { maxCards?: number; betweenCardsMs?: number; afterBurstMs?: number } = {},
): Promise<number> {
  const maxCards = options.maxCards ?? 8;
  const betweenCardsMs = options.betweenCardsMs ?? 180;
  const afterBurstMs = options.afterBurstMs ?? 900;
  let played = 0;

  for (let i = 0; i < maxCards; i++) {
    if (await battle.isBattleOver()) break;
    const handCount = await battle.handCount();
    if (handCount === 0) break;

    await waitForHandPlayable(page, 5_000).catch(() => false);
    // Always target the first remaining card — consume/play removes hand entries and shifts indices.
    const card = battle.hand.nth(0);
    if ((await card.count()) === 0) break;
    if (!(await card.isEnabled().catch(() => false))) break;

    await playHandCard(page, 0);
    played += 1;
    await delay(betweenCardsMs);
  }

  if (played > 0) {
    await waitForCardPlayFx(page, { lingerMs: afterBurstMs });
  }
  return played;
}

async function battleStageMarkCount(page: Page, stage: BattleStageMarkName): Promise<number> {
  const markName = battleStageMarkName(stage);
  return page.evaluate((name) => performance.getEntriesByName(name, "mark").length, markName);
}

/** Wait until mark count for a stage exceeds a pre-click baseline. */
export async function waitForNextBattleStageMark(
  page: Page,
  stage: BattleStageMarkName,
  beforeCount: number,
  timeoutMs = 20_000,
): Promise<void> {
  const markName = battleStageMarkName(stage);
  await page.waitForFunction(
    ({ name, before }) => performance.getEntriesByName(name, "mark").length > before,
    { name: markName, before: beforeCount },
    { timeout: timeoutMs },
  );
}

/**
 * End turn with perf-harness phases aligned to real pipeline stages.
 * Mark waits are baseline-relative so long sessions / mark caps cannot desync turnIndex.
 */
export async function runMeasuredEndTurn(
  page: Page,
  battle: BattlePage,
  phase: (name: string) => Promise<void>,
  _turnIndex?: number,
): Promise<void> {
  const endTurn = battle.endTurnBtn;

  if (await battle.isBattleOver()) return;
  await expect(endTurn).toBeEnabled({ timeout: 10_000 });

  const beforeDiscardStart = await battleStageMarkCount(page, "discard-start");
  const beforeDiscardEnd = await battleStageMarkCount(page, "discard-end");
  const beforeResolveStart = await battleStageMarkCount(page, "resolve-start");
  const beforeResolveEnd = await battleStageMarkCount(page, "resolve-end");
  const beforeEnemyStart = await battleStageMarkCount(page, "enemy-start");
  const beforeEnemyEnd = await battleStageMarkCount(page, "enemy-end");
  const beforeDrawStart = await battleStageMarkCount(page, "draw-start");
  const beforeDrawEnd = await battleStageMarkCount(page, "draw-end");

  await phase("end-turn-click");
  await endTurn.click({ force: true });
  await phase("discard-hand");
  await waitForNextBattleStageMark(page, "discard-start", beforeDiscardStart).catch(() => undefined);
  await waitForNextBattleStageMark(page, "discard-end", beforeDiscardEnd);

  await phase("enemy-resolve");
  await waitForNextBattleStageMark(page, "resolve-start", beforeResolveStart);
  await waitForNextBattleStageMark(page, "resolve-end", beforeResolveEnd);
  await waitForNextBattleStageMark(page, "enemy-start", beforeEnemyStart, 3_000).catch(() => undefined);
  await waitForNextBattleStageMark(page, "enemy-end", beforeEnemyEnd, 15_000).catch(() => undefined);

  await phase("draw-hand");
  const sawDraw = await waitForNextBattleStageMark(page, "draw-start", beforeDrawStart, 5_000)
    .then(() => true)
    .catch(() => false);
  if (sawDraw) {
    await waitForNextBattleStageMark(page, "draw-end", beforeDrawEnd);
  }

  await phase("player-turn-ready");
  await expect(endTurn).toBeEnabled({ timeout: 20_000 });
  await waitForHandPlayable(page, 20_000);
  await delay(150);
}
