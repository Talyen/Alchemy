import { controllerInput } from "../controller-input";
import { expect, test } from "../../fixtures/e2e";
import type { Page } from "@playwright/test";
import { injectActiveBattle, makeCard, makeGoblinBattleState, withSavedGame } from "../../browser-helpers";
import { critical, slow } from "../../playwright-tags";

test("corner crystals retain capacity, destruction and temporary overflow effects", critical, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const cards = [
    makeCard({
      id: "mana-crystals",
      uid: 101,
      cost: 0,
      effects: [{ kind: "gain-max-mana", amount: 10 }],
    }),
    makeCard({ id: "slash", uid: 102, cost: 2, effects: [{ kind: "lose-max-mana", amount: 7 }] }),
    makeCard({
      id: "block",
      uid: 103,
      cost: 0,
      effects: [{ kind: "restore-mana", amount: 3, allowOverflow: true }],
    }),
  ];
  await injectActiveBattle(page, makeGoblinBattleState({ hand: cards, mana: 5, maxMana: 5, playerHealth: 30 }), {
    autoEndTurn: false,
  });
  const dock = page.getByTestId("mana-panel");
  await expect(dock.locator("[data-mana-index]")).toHaveCount(5);
  const relativePlacement = () =>
    dock.evaluate((element) => {
      const row = element.getBoundingClientRect();
      const pile = document.querySelector('[data-testid="draw-pile"]')!.getBoundingClientRect();
      return {
        x: row.x + row.width / 2 - (pile.x + pile.width / 2),
        y: pile.y - (row.y + row.height),
        width: row.width,
        height: row.height,
      };
    });
  const initial = await relativePlacement();
  await dock.evaluate((element) => {
    element.setAttribute("data-observed-animations", "");
    element.addEventListener("animationstart", (event) => {
      const animation = event as AnimationEvent;
      element.setAttribute(
        "data-observed-animations",
        element.getAttribute("data-observed-animations") + " " + animation.animationName,
      );
    });
  });
  await page.getByRole("button", { name: "Inspect Mana: 5 / 5" }).click();
  await expect(page.locator("[data-hand-slot]")).toHaveCount(3);
  await page.locator("[data-hand-slot] button").first().click();
  await expect(dock).toHaveAttribute("data-max-mana", "15");
  await expect(dock.locator("[data-mana-index]")).toHaveCount(9);
  await expect(dock.locator(".mana-dock-overflow")).toHaveText("+6");
  await expect(dock).toHaveAttribute("data-observed-animations", /manaDockGain/);
  await page.locator("[data-hand-slot] button").first().click();
  await expect(dock).toHaveAttribute("data-max-mana", "8");
  await expect(dock.locator("[data-mana-index]")).toHaveCount(8);
  await expect(dock).toHaveAttribute("data-observed-animations", /manaDockShard/);
  await page.locator("[data-hand-slot] button").first().click();
  // Gameplay may pace restoration; the dock must faithfully display the resulting total.
  await expect.poll(async () => Number(await dock.getAttribute("data-mana"))).toBeGreaterThan(9);
  const restoredMana = Number(await dock.getAttribute("data-mana"));
  await expect(dock.locator(".mana-dock-overflow")).toHaveText(`+${restoredMana - 9}`);
  await expect(page.getByRole("button", { name: `Inspect Mana: ${restoredMana} / 8` })).toBeVisible();
  const final = await relativePlacement();
  // The corner remains anchored when cards play and Mana capacity changes.
  expect(final.x).toBeCloseTo(initial.x, 3);
  expect(final.y).toBeCloseTo(initial.y, 3);
  expect(final.width).toBeCloseTo(initial.width, 3);
  expect(final.height).toBeCloseTo(initial.height, 3);
  const containment = await dock.locator("[data-mana-index]").evaluateAll((elements) => {
    const pile = document.querySelector('[data-testid="draw-pile"]')!.getBoundingClientRect();
    return elements.map((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom < pile.top;
    });
  });
  expect(containment.every(Boolean)).toBe(true);
  await expect
    .poll(() =>
      dock
        .locator("[data-mana-index]")
        .evaluateAll((elements) =>
          Math.min(
            ...elements
              .slice(1)
              .map(
                (element, index) =>
                  element.getBoundingClientRect().left - elements[index]!.getBoundingClientRect().right,
              ),
          ),
        ),
    )
    .toBeGreaterThan(5);
  await withSavedGame(page, async (resumed) => {
    const resumedDock = resumed.getByTestId("mana-panel");
    await expect(resumedDock).toHaveAttribute("data-mana", String(restoredMana));
    await expect(resumedDock.locator("[data-mana-exit]")).toHaveCount(0);
    await expect(resumedDock.locator("[data-effect]")).toHaveCount(0);
  });
});

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
  const y = Math.max(...slots.map((slot) => slot.y)) + Math.min(...slots.map((slot) => slot.height)) / 2;
  for (const order of [slots, [...slots].reverse()]) {
    for (const slot of order) {
      await page.mouse.move(slot.x, y);
      await expect(page.locator(`[data-hand-slot="${slot.key}"]`)).toHaveAttribute("data-hovered", "true");
      await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(1);
    }
  }
}

test("six and seven cards select in order and clicks follow the highlighted card", slow, async ({ page }) => {
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
  expect(
    await page.locator('[data-testid="battle-hand"]').evaluate((hand) => hand.contains(document.activeElement)),
  ).toBe(false);
  await sweep(page);
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(0);
  const keyboardCard = page.locator("[data-hand-slot] button").nth(2);
  await controllerInput(page).reach(keyboardCard);
  await keyboardCard.hover();
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-hand-slot]").nth(2)).toHaveAttribute("data-hovered", "true");
  await controllerInput(page).press("confirm");
  await expect(page.locator("[data-hand-slot]")).toHaveCount(5);
});

test("hover reconciles through a play, draw, and reflow with the pointer in the hand", critical, async ({ page }) => {
  await openHand(page, 7, true);
  const slot = (await geometry(page))[3]!;
  await page.mouse.move(slot.x, slot.y + slot.height / 2);
  await page.mouse.click(slot.x, slot.y + slot.height / 2);
  await expect(page.locator(`[data-hand-slot="${slot.key}"]`)).toHaveCount(0);
  await expect(page.locator("[data-hand-slot]")).toHaveCount(7);
  await expect(page.locator("[data-hand-hidden]")).toHaveCount(0);
  await expect(page.locator("[data-hand-slot][data-hovered='true']")).toHaveCount(1);
  await sweep(page);
});

for (const { width, height, gameSizePercent } of [
  { width: 1920, height: 1080, gameSizePercent: 100 },
  { width: 1280, height: 720, gameSizePercent: 120 },
  { width: 2560, height: 1080, gameSizePercent: 80 },
]) {
  test(`hand remains reachable and controls stay fixed at ${width} / ${gameSizePercent}%`, slow, async ({ page }) => {
    await page.setViewportSize({ width, height });
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
      page.getByRole("button", { name: "End Turn", exact: true }).evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y };
        }),
      );
    const initial = await positions();
    const scene = await page.getByTestId("battle-scene").boundingBox();
    expect(scene).toEqual({ x: 0, y: 0, width, height });
    const mana = await page.getByTestId("mana-panel").boundingBox();
    const endTurn = await page.getByRole("button", { name: "End Turn", exact: true }).boundingBox();
    const draw = await page.getByTestId("draw-pile").boundingBox();
    const discard = await page.getByTestId("discard-pile").boundingBox();
    expect(mana!.x + mana!.width / 2).toBeCloseTo(draw!.x + draw!.width / 2, 0);
    expect(mana!.y + mana!.height).toBeLessThan(draw!.y);
    expect(endTurn!.x + endTurn!.width / 2).toBeCloseTo(discard!.x + discard!.width / 2, 0);
    expect(endTurn!.y + endTurn!.height).toBeLessThan(discard!.y);
    expect(draw!.x).toBeGreaterThanOrEqual(0);
    expect(discard!.x + discard!.width).toBeLessThanOrEqual(width);
    expect(draw!.y + draw!.height).toBeCloseTo(discard!.y + discard!.height, 0);
    const hand = await page.getByTestId("battle-hand").boundingBox();
    expect(hand!.x + hand!.width / 2).toBeCloseTo(width / 2, 0);

    for (let count = 7; count >= 1; count--) {
      await expect(page.locator("[data-hand-slot]")).toHaveCount(count);
      await page.mouse.move(0, 0);
      const bounds = await page.locator("[data-hand-slot] button").evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
      for (const rect of bounds) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(width);
        expect((rect.top + rect.bottom) / 2).toBeLessThan(height);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(height + 1);
      }
      const current = await positions();
      current.forEach((position, index) => {
        expect(position.x).toBeCloseTo(initial[index]!.x, 0);
        expect(position.y).toBeCloseTo(initial[index]!.y, 0);
      });
      if (count === 7 || count === 1) await inspectOuterEdges(page);
      if (count > 1) {
        const slot = (await geometry(page))[Math.floor(count / 2)]!;
        await page.mouse.click(slot.x, slot.y + slot.height / 2);
      }
    }
    await page.mouse.move(0, 0);
    await controllerInput(page).activate(page.locator("[data-hand-slot] button").last());
    await expect(page.locator("[data-hand-slot]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "End Turn", exact: true })).toBeFocused();
  });
}
