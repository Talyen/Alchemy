import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import type { CardRect } from "../../shared/types";

function isRectStable(rect: CardRect, lastRect: CardRect | null): boolean {
  if (!lastRect) return false;
  return (
    Math.abs(rect.x - lastRect.x) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
    Math.abs(rect.y - lastRect.y) < CARD_TRANSFER_CONFIG.rectEpsilonPx
  );
}

export interface StableHandCardRectDeps {
  measureHandCard: (cardKey: string) => CardRect | null;
  registerCancel: (onCancel: () => void) => () => void;
  scheduleTimeout: (onTimeout: () => void, ms: number) => () => void;
}

export function waitForStableHandCardRect(
  cardKey: string,
  fallback: CardRect,
  deps: StableHandCardRectDeps,
): Promise<CardRect> {
  return new Promise((resolve) => {
    let frameCount = 0;
    let stableFrames = 0;
    let lastRect: CardRect | null = null;
    let completed = false;
    let unregisterCancel = () => {};
    let clearDelay = () => {};
    let measureFrame: number | null = null;

    const finish = (rect: CardRect) => {
      if (completed) return;
      completed = true;
      unregisterCancel();
      clearDelay();
      if (measureFrame !== null) cancelAnimationFrame(measureFrame);
      resolve(rect);
    };

    const registeredCancel = deps.registerCancel(() => {
      finish(deps.measureHandCard(cardKey) ?? fallback);
    });
    unregisterCancel = registeredCancel;
    if (completed) {
      unregisterCancel();
      return;
    }

    const scheduledDelay = deps.scheduleTimeout(() => {
      finish(deps.measureHandCard(cardKey) ?? fallback);
    }, CARD_TRANSFER_CONFIG.stableRectTimeoutMs);
    clearDelay = scheduledDelay;
    if (completed) {
      clearDelay();
      return;
    }

    function tick() {
      if (completed) return;
      measureFrame = null;
      frameCount += 1;

      const rect = deps.measureHandCard(cardKey) ?? fallback;

      if (isRectStable(rect, lastRect)) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      lastRect = rect;

      if (
        stableFrames >= CARD_TRANSFER_CONFIG.requiredStableSlotFrames ||
        frameCount >= CARD_TRANSFER_CONFIG.maxSlotStabilizeFrames
      ) {
        finish(rect);
        return;
      }

      measureFrame = requestAnimationFrame(tick);
    }

    measureFrame = requestAnimationFrame(tick);
  });
}
