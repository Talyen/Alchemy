import { expect, type Page } from "@playwright/test";
import { startAtDestination } from "../tests/e2e/battle-setup";
import { DestinationPage } from "../tests/pages/destination-page";
import { waitForHandPlayable } from "./battle-helpers";
import {
  trackFailedAssetRequests,
  writeBattleArtDiagnostics,
  formatArtDiagnosticFailure,
  MIN_PAINT_PX,
} from "./battle-art-diagnostics";

interface PerfDeckCard {
  id: string;
}

/**
 * Bootstrap a combat with real animations and wait until actors + hand are interactable.
 * Explicitly disables auto-end so the measured window stays on player-driven turns.
 */
export async function startPerfBattle(
  page: Page,
  deck: PerfDeckCard[],
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const tracker = trackFailedAssetRequests(page);
  try {
    await startAtDestination(
      page,
      { runDeck: deck, autoEndTurn: false, runPlayerHealth: 80, runMaxHealth: 80, ...overrides },
      { forceDestination: "Normal Combat" },
    );
    await new DestinationPage(page).pick("Normal Combat");

    await waitForBattleReady(page, 30_000, tracker.failures);
  } finally {
    tracker.dispose();
  }
}

/** Battle scene, both combatants, hand playable, and production art painted. */
export async function waitForBattleReady(
  page: Page,
  timeoutMs = 30_000,
  failedAssetRequests: Array<{ url: string; status: number }> = [],
): Promise<void> {
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByTestId("player-health")).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByTestId("enemy-health")).toBeVisible({ timeout: timeoutMs });
  await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: timeoutMs });
  await waitForHandPlayable(page, timeoutMs);
  await waitForBattleArtLoaded(page, timeoutMs, failedAssetRequests);
}

async function waitForBattleArtLoaded(
  page: Page,
  timeoutMs: number,
  failedAssetRequests: Array<{ url: string; status: number }>,
): Promise<void> {
  try {
    await expect
      .poll(
        async () => {
          const result = await page.evaluate((minPaint) => {
            const selectors = [
              '[data-testid="battle-player-art-panel"] img',
              '[data-testid="battle-enemy-art-panel"] img',
              '[aria-label^="Play "] img',
            ];
            const imgs = selectors
              .flatMap((sel) => Array.from(document.querySelectorAll<HTMLImageElement>(sel)))
              .slice(0, 8);
            if (imgs.length < 2) return { ok: false, reason: `only ${imgs.length} images` };

            return Promise.all(
              imgs.map(async (img) => {
                const src = img.currentSrc || img.src || "";
                if (!src || src.startsWith("data:image/gif")) {
                  return { ok: false, reason: `gif/empty src` };
                }
                try {
                  await img.decode();
                } catch {
                  // fall through to naturalWidth / paint checks
                }
                const rect = img.getBoundingClientRect();
                if (img.naturalWidth <= 0) return { ok: false, reason: "naturalWidth=0" };
                if (rect.width < minPaint || rect.height < minPaint) {
                  return { ok: false, reason: `paint ${Math.round(rect.width)}x${Math.round(rect.height)}` };
                }
                return { ok: true, reason: "" };
              }),
            ).then((rows) => {
              const bad = rows.find((r) => !r.ok);
              return bad ?? { ok: true, reason: "" };
            });
          }, MIN_PAINT_PX);
          return result.ok ? 1 : 0;
        },
        { timeout: timeoutMs, intervals: [100, 200, 400] },
      )
      .toBe(1);
  } catch (error) {
    const { dir, diagnostics } = await writeBattleArtDiagnostics(page, { failedAssetRequests });
    throw new Error(`${formatArtDiagnosticFailure(diagnostics, dir)}\n\n${String(error)}`, { cause: error });
  }
}
