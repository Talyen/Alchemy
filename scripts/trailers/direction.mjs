/** Travel above the entire hand; crossing the fan selects every intervening card. */
export function pointerPath(from, to, corridorY) {
  if (corridorY === null || Math.hypot(to.x - from.x, to.y - from.y) < 1) return [from, to];
  const path = [from];
  path.push({ x: from.x, y: corridorY }, { x: to.x, y: corridorY });
  path.push(to);
  return path.filter((point, index) => !index || point.x !== path[index - 1].x || point.y !== path[index - 1].y);
}

export function samplePointer(path, progress) {
  const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * progress;
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return {
        x: path[index].x + (path[index + 1].x - path[index].x) * t,
        y: path[index].y + (path[index + 1].y - path[index].y) * t,
      };
    }
    remaining -= length;
  }
  return path.at(-1);
}

function locatorFor(page, target) {
  const locator = target.role
    ? page.getByRole(target.role, { name: target.name, exact: true })
    : target.testId
      ? page.getByTestId(target.testId)
      : page.locator(target.selector);
  return locator.nth(target.index);
}

export async function prepareAction(page, action) {
  if (action.kind === "move-away") return { point: { x: 20, y: 80 }, kind: action.kind };
  let locator;
  if (action.target?.cardPriority) {
    for (const name of action.target.cardPriority) {
      const card = page.getByRole("button", { name: `Play ${name}`, exact: true }).nth(action.target.index);
      if (
        (await card.isVisible()) &&
        (await card.isEnabled()) &&
        (await card.evaluate((element) => !element.classList.contains("hand-card-unplayable")))
      ) {
        locator = card;
        break;
      }
    }
    if (!locator) throw new Error("No playable card in the directed priority list; adjust the shot's inputs");
  } else if (action.kind === "play-card" && !action.target) {
    const cards = page.locator("[aria-label^='Play ']");
    // Prefer the card the player just inspected, then another playable card.
    const candidates = await cards.all();
    const hovered = [];
    const remaining = [];
    for (const card of candidates) {
      if (await card.evaluate((element) => element.closest("[data-hand-slot]")?.hasAttribute("data-hovered")))
        hovered.push(card);
      else remaining.push(card);
    }
    for (const card of [...hovered, ...remaining])
      if (
        (await card.isEnabled()) &&
        (await card.isVisible()) &&
        (await card.evaluate((element) => !element.classList.contains("hand-card-unplayable")))
      ) {
        locator = card;
        break;
      }
    if (!locator) throw new Error("No playable card at the directed moment; adjust the shot's inputs");
  } else locator = locatorFor(page, action.target);
  if (!(await locator.isVisible()) || (action.kind !== "hover" && !(await locator.isEnabled())))
    throw new Error(`Unavailable action target: ${JSON.stringify(action)}`);
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("Action target has no bounds");
  const label = (await locator.getAttribute("aria-label")) ?? (await locator.textContent());
  const hand = await locator.evaluate((element) => {
    const slot = element.closest("[data-hand-slot]");
    if (!slot) return null;
    const bounds = slot.getBoundingClientRect();
    return {
      key: slot.getAttribute("data-hand-slot"),
      x: bounds.x + bounds.width / 2,
      y: Math.min(globalThis.innerHeight - 20, bounds.bottom - 20),
    };
  });
  const point = hand ? { x: hand.x, y: hand.y } : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (
    !(await locator.evaluate(
      (element, { point, hand }) => {
        const hit = globalThis.document.elementFromPoint(point.x, point.y);
        return (
          hit &&
          !hit.closest("[inert]") &&
          (hand ? Boolean(hit.closest("[data-hand-slot]")) : element === hit || element.contains(hit))
        );
      },
      { point, hand },
    ))
  )
    throw new Error(`Action target is covered: ${label}`);
  if (action.kind === "play-card" && !hand?.key) throw new Error("Play-card target is not in the hand");
  return {
    kind: action.kind,
    label,
    bounds,
    point,
    ...(hand?.key ? { inspectedCardKey: hand.key } : {}),
    ...(action.kind === "play-card" ? { cardKey: hand.key } : {}),
  };
}

export async function pointerCorridor(page) {
  return page.evaluate(() => {
    const slots = [...globalThis.document.querySelectorAll("[data-hand-slot]:not([data-hand-hidden])")];
    // Travel in the actual gap below status chips and above the whole fan.
    // A large fixed offset above the hand crosses newly earned status tooltips.
    const tops = slots.flatMap((slot) => [
      slot.parentElement.getBoundingClientRect().top,
      slot.querySelector("button").getBoundingClientRect().top,
    ]);
    if (!slots.length) return null;
    const corridor = Math.min(...tops) - 8;
    const statusBottom = Math.max(
      0,
      ...[
        ...globalThis.document.querySelectorAll('[data-testid="player-statuses"],[data-testid="enemy-statuses"]'),
      ].map((node) => node.getBoundingClientRect().bottom),
    );
    if (corridor <= statusBottom + 4) throw new Error("No clear pointer gap between statuses and the hand");
    return corridor;
  });
}

export async function performAction(page, prepared) {
  if (prepared.kind === "hover" || prepared.kind === "move-away") return;
  if (prepared.kind === "play-card") {
    // Anchor selection before the native click. Reflow must not select a
    // neighbor under the stationary pointer while the played card leaves.
    await page
      .locator(`[data-hand-slot=${JSON.stringify(prepared.cardKey)}] button`)
      .evaluate((button) => button.focus({ preventScroll: true }));
    await page.mouse.down();
    await page.mouse.up();
  } else await page.mouse.click(prepared.point.x, prepared.point.y);
}
