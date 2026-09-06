import { expect, test, type Page } from "@playwright/test";
import { injectActiveBattle, makeCard, makeGoblinBattleState, failOnRuntimeErrors } from "./helpers";
import { critical, slow } from "./playwright-tags";

test.setTimeout(60_000);

async function openHand(page: Page, count = 7, draw = false) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      hand: Array.from({ length: count }, (_, index) =>
        makeCard({
          uid: index + 1,
          cost: 0,
          effects:
            draw && index === 3
              ? [{ kind: "draw-cards", amount: 1 }]
              : [{ kind: "player-status", status: "block", amount: 1 }],
        }),
      ),
      deck: draw ? [makeCard({ uid: 20, cost: 0 })] : [],
    }),
    { autoEndTurn: false },
  );
  await expect(page.locator("[data-hand-slot]")).toHaveCount(count);
  await expect(page.getByTestId("battle-hand")).toBeVisible();
}

async function geometry(page: Page) {
  return page.locator("[data-hand-slot]").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top,
        height: rect.height,
        key: (element as HTMLElement).dataset.handSlot!,
        cardWidth: (element.querySelector("button")!.offsetWidth * rect.width) / (element as HTMLElement).offsetWidth,
      };
    }),
  );
}

async function inspectOuterEdges(page: Page) {
  const slots = await geometry(page);
  for (const [slot, direction] of [
    [slots[0]!, -1],
    [slots.at(-1)!, 1],
  ] as const) {
    const y = slot.y + slot.height / 2;
    await page.mouse.move(slot.x, y);
    await page.mouse.move(slot.x + direction * slot.cardWidth * 0.51, y);
    await expect(page.locator(`[data-hand-slot="${slot.key}"]`)).toHaveAttribute("data-hovered", "true");
  }
}

async function sweep(page: Page) {
  const slots = await geometry(page);
  for (const fraction of [0.15, 0.5, 0.85]) {
    const y = Math.max(...slots.map((slot) => slot.y)) + Math.min(...slots.map((slot) => slot.height)) * fraction;
    for (const order of [slots, [...slots].reverse()]) {
      for (const slot of order) {
        await page.mouse.move(slot.x, y, { steps: 5 });
        await expect(page.locator(`[data-hand-slot="${slot.key}"]`)).toHaveAttribute("data-hovered", "true");
        await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(1);
      }
    }
  }
}

test("six and seven cards select in order and clicks follow the highlighted card", critical, async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  await openHand(page);
  await inspectOuterEdges(page);
  await sweep(page);
  const slots = await geometry(page);
  const selected = slots[3]!;
  await page.mouse.move(selected.x, selected.y + selected.height / 2);
  await expect(page.locator(`[data-hand-slot="${selected.key}"]`)).toHaveAttribute("data-hovered", "true");
  await page.mouse.move(selected.x, selected.y - 5);
  await expect(page.locator(`[data-hand-slot="${selected.key}"]`)).toHaveAttribute("data-hovered", "true");
  await page.mouse.click(selected.x, selected.y + selected.height / 2);
  await expect(page.locator(`[data-hand-slot="${selected.key}"]`)).toHaveCount(0);
  await expect(page.locator("[data-hand-slot]")).toHaveCount(6);
  await sweep(page);
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(0);
  const keyboardCard = page.locator("[data-hand-slot] button").nth(2);
  await keyboardCard.focus();
  await expect(page.locator("[data-hand-slot]").nth(2)).toHaveAttribute("data-hovered", "true");
  await keyboardCard.press("Enter");
  await expect(page.locator("[data-hand-slot]")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("hover reconciles through a play, draw, and reflow with the pointer in the hand", critical, async ({ page }) => {
  const errors = failOnRuntimeErrors(page);
  await openHand(page, 7, true);
  const slot = (await geometry(page))[3]!;
  await page.mouse.move(slot.x, slot.y + slot.height / 2);
  await page.mouse.click(slot.x, slot.y + slot.height / 2);
  await expect(page.locator(`[data-hand-slot="${slot.key}"]`)).toHaveCount(0);
  await expect(page.locator("[data-hand-slot]")).toHaveCount(7);
  await expect(page.locator("[data-hand-hidden]")).toHaveCount(0);
  await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(1);
  await sweep(page);
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
]) {
  for (const gameSizePercent of [80, 100, 120]) {
    test(
      `hand fits and controls stay fixed at ${viewport.width} / ${gameSizePercent}%`,
      slow,
      async ({ page }, testInfo) => {
        const errors = failOnRuntimeErrors(page);
        await page.setViewportSize(viewport);
        await page.addInitScript(
          (size) =>
            localStorage.setItem(
              "alchemy-device-display-v1",
              JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
            ),
          gameSizePercent,
        );
        await openHand(page);
        const positions = () =>
          page
            .locator('[data-testid="draw-pile"], [data-testid="discard-pile"], [data-testid="mana-panel"]')
            .or(page.getByRole("button", { name: "End Turn", exact: true }))
            .evaluateAll((elements) =>
              elements.map((el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x, y: r.y };
              }),
            );
        const initial = await positions();
        await testInfo.attach("seven-card-hand", { body: await page.screenshot(), contentType: "image/png" });
        for (let count = 7; count >= 1; count--) {
          await expect(page.locator("[data-hand-slot]")).toHaveCount(count);
          await page.mouse.move(0, 0);
          const bounds = await page.locator("[data-hand-slot] button").evaluateAll((elements) =>
            elements.map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            }),
          );
          const left = await page.getByTestId("mana-panel").locator("..").boundingBox();
          const right = await page.getByTestId("discard-pile").locator("../..").boundingBox();
          for (const rect of bounds) {
            expect(rect.left).toBeGreaterThan(left!.x + left!.width);
            expect(rect.right).toBeLessThan(right!.x);
            expect(rect.bottom).toBeLessThanOrEqual(viewport.height + 1);
            expect(rect.top).toBeGreaterThanOrEqual(0);
          }
          const current = await positions();
          current.forEach((position, index) => {
            expect(position.x).toBeCloseTo(initial[index]!.x, 0);
            expect(position.y).toBeCloseTo(initial[index]!.y, 0);
          });
          if (count >= 6) await sweep(page);
          if (count === 1) await inspectOuterEdges(page);
          if (count > 1) {
            const slot = (await geometry(page))[Math.floor(count / 2)]!;
            await page.mouse.click(slot.x, slot.y + slot.height / 2);
          }
        }
        expect(errors).toEqual([]);
      },
    );
  }
}
