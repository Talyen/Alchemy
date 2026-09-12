import { expect, test } from "../../fixtures/e2e";
import type { Page } from "@playwright/test";
import { gridLabyrinthMapFixture } from "../../fixtures/labyrinth-map";
import { injectLabyrinthRun, makeCard } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";

interface ArtworkProbe {
  pause: () => void;
  release: () => void;
  samples: number;
  failures: string[];
}

type ProbeWindow = Window & { artworkProbe: ArtworkProbe };

async function installArtworkProbe(page: Page) {
  await page.evaluate(() => {
    let hold: Promise<void> | null = null;
    let release: (() => void) | undefined;
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (this.isConnected && hold) await hold;
    };
    const probe: ArtworkProbe = {
      pause: () => {
        hold = new Promise<void>((resolve) => {
          release = resolve;
        });
      },
      release: () => {
        hold = null;
        release?.();
      },
      samples: 0,
      failures: [],
    };
    (window as unknown as ProbeWindow).artworkProbe = probe;
    let leftMap = false;
    const sample = () => {
      const map = document.querySelector('[aria-label="Labyrinth map"]');
      if (!map) leftMap = true;
      if (map && leftMap) {
        for (const image of map.querySelectorAll('[data-state="cleared"] img')) {
          const style = getComputedStyle(image);
          probe.samples += 1;
          if (
            (!/grayscale\((1|100%)\)/.test(style.filter) || Number(style.opacity) > 0.601) &&
            probe.failures.length < 10
          ) {
            probe.failures.push(`filter=${style.filter}, opacity=${style.opacity}`);
          }
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function pauseArtwork(page: Page) {
  await page.evaluate(() => (window as unknown as ProbeWindow).artworkProbe.pause());
}

async function releasePendingScreen(page: Page) {
  const pending = page.locator(".page-enter[data-artwork-pending]");
  await expect(pending).toHaveCount(1);
  await expect(pending).toHaveCSS("visibility", "hidden");
  await expect(pending).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => (window as unknown as ProbeWindow).artworkProbe.release());
  await expect(pending).toHaveCount(0);
}

for (const type of ["combat", "mystery", "shop"] as const) {
  test(
    `${type} round-trip waits for artwork and never flashes completed map rooms in color`,
    critical,
    async ({ page }) => {
      const map = gridLabyrinthMapFixture();
      const target = map.nodes["labyrinth-floor-1-n0"]!;
      target.type = type;
      if (type !== "combat") delete target.enemyId;
      await injectLabyrinthRun(page, {
        labyrinthMap: map,
        deck: Array.from({ length: 6 }, () =>
          makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 500 }] }),
        ),
        runOverrides: { rng: { seed: 42, counters: { rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 } } },
      });
      await expect(page.locator(".page-enter[data-artwork-pending]")).toHaveCount(0);
      await installArtworkProbe(page);
      await page.locator(`[data-labyrinth-node="${target.id}"] button`).click();
      await pauseArtwork(page);
      await page
        .getByRole("button", {
          name: type === "combat" ? "Fight" : type === "mystery" ? "Investigate" : "Enter",
          exact: true,
        })
        .click();
      await releasePendingScreen(page);

      if (type === "combat") {
        await expect(page.getByTestId("battle-scene")).toBeVisible();
        await expect(page.getByRole("button", { name: "Play Slash", exact: true }).first()).toBeVisible();
        await pauseArtwork(page);
        await new BattlePage(page).playCardNamed("Slash");
        await releasePendingScreen(page);
        await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
        await pauseArtwork(page);
        await page.locator('[aria-label^="Select "]').first().click();
      } else if (type === "mystery") {
        await page.getByTestId("mystery-choice").first().click();
        await expect(page.getByRole("heading", { name: "Reward", exact: true })).toBeVisible();
        await pauseArtwork(page);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
      } else {
        await pauseArtwork(page);
        await page.getByRole("button", { name: "Leave", exact: true }).click();
      }

      await releasePendingScreen(page);
      await expect(page.getByRole("region", { name: "Labyrinth map" })).toBeVisible();
      await expect(page.locator(`[data-labyrinth-node="${target.id}"]`)).toHaveAttribute("data-state", "cleared");
      await expect
        .poll(() => page.evaluate(() => (window as unknown as ProbeWindow).artworkProbe.samples))
        .toBeGreaterThan(0);
      expect(await page.evaluate(() => (window as unknown as ProbeWindow).artworkProbe.failures)).toEqual([]);
    },
  );
}
