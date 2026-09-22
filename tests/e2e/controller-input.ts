import { expect, type ElementHandle, type Locator, type Page } from "@playwright/test";

// These are Steam Input's intended outputs, not an emulation of Steam or a device.
export const controllerKeys = {
  confirm: "Enter",
  back: "Escape",
  previous: "Shift+Tab",
  next: "Tab",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
} as const;

export function controllerInput(page: Page) {
  async function press(action: keyof typeof controllerKeys) {
    await page.keyboard.press(controllerKeys[action]);
  }

  async function reach(target: Locator, limit = 30, direction: "next" | "previous" = "next") {
    await expect(target).toBeVisible();
    await expect.poll(() => target.evaluate((element) => !element.matches(":disabled"))).toBe(true);
    await expect.poll(() => target.evaluate((element) => !element.closest("[inert]"))).toBe(true);
    const history: string[] = [];
    const visited: ElementHandle[] = [];
    try {
      for (let step = 0; step <= limit; step++) {
        if (await target.evaluate((element) => element === document.activeElement)) return;
        if (step === limit) break;
        await press(direction);
        const active = page.locator(":focus");
        const label = (await active.count()) ? await active.ariaSnapshot() : "document body";
        history.push(label);
        const handle = (await page.evaluateHandle(() => document.activeElement)).asElement();
        if (handle) {
          for (const previous of visited) {
            if (await handle.evaluate((element, other) => element === other, previous)) {
              await handle.dispose();
              throw new Error(
                `Focus cycled before reaching ${target}. Recent focus: ${history.slice(-12).join(" → ")}`,
              );
            }
          }
          visited.push(handle);
        }
      }
      throw new Error(
        `Could not reach ${target} in ${limit} ${direction} presses. Recent focus: ${history.slice(-12).join(" → ")}`,
      );
    } finally {
      await Promise.all(visited.map((element) => element.dispose()));
    }
  }

  async function activate(target: Locator, limit = 30) {
    await expect(target).toBeEnabled();
    await reach(target, limit);
    await press("confirm");
  }

  async function point(target: Locator) {
    const bounds = await target.boundingBox();
    if (!bounds) throw new Error(`No visible bounds for ${target}`);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }

  return {
    press,
    reach,
    activate,
    point,
    click: async () => {
      await page.mouse.down();
      await page.mouse.up();
    },
    scroll: (delta: number) => page.mouse.wheel(0, delta),
  };
}
