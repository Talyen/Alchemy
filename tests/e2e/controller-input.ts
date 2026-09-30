import { expect, type Locator, type Page } from "@playwright/test";

// These are Steam Input's intended outputs, not an emulation of Steam or a device.
export const controllerKeys = {
  confirm: "Enter",
  back: "Escape",
  previous: "F7",
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
    const targetHandle = await target.elementHandle();
    if (!targetHandle) throw new Error(`Target element not found: ${target}`);
    await page.evaluate(() => {
      (window as unknown as { __reachVisited?: Set<Element> }).__reachVisited = new Set();
    });
    try {
      for (let step = 0; step <= limit; step++) {
        const { isTarget, cycled, label } = await page.evaluate((t) => {
          const active = document.activeElement;
          const visited = (window as unknown as { __reachVisited: Set<Element> }).__reachVisited;
          const isTarget = active === t;
          const cycled = active && active !== document.body ? visited.has(active) : false;
          if (active && active !== document.body) visited.add(active);
          const label = active
            ? active.getAttribute("aria-label") ||
              active.getAttribute("name") ||
              active.textContent?.trim().slice(0, 40) ||
              active.tagName.toLowerCase()
            : "document body";
          return { isTarget, cycled, label };
        }, targetHandle);
        if (isTarget) return;
        history.push(label);
        if (cycled) {
          throw new Error(`Focus cycled before reaching ${target}. Recent focus: ${history.slice(-12).join(" → ")}`);
        }
        if (step === limit) break;
        await press(direction);
      }
      throw new Error(
        `Could not reach ${target} in ${limit} ${direction} presses. Recent focus: ${history.slice(-12).join(" → ")}`,
      );
    } finally {
      await targetHandle.dispose();
      await page.evaluate(() => {
        delete (window as unknown as { __reachVisited?: Set<Element> }).__reachVisited;
      });
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
