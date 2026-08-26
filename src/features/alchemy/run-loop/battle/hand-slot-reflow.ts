// FLIP-style horizontal reflow for a hand card slot after the flex fan rebalances.
import { ANIMATION_DISABLED_DURATION, isAnimationDisabled } from "@/lib/animation/animation-prefs";

export function playHandSlotReflow(slot: HTMLElement, deltaX: number, durationMs: number): () => void {
  if (Math.abs(deltaX) < 0.5) return () => {};

  const duration = isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : durationMs;

  slot.style.transition = "none";
  slot.style.transform = `translateX(${deltaX}px)`;

  let innerId: number | null = null;
  const outerId = requestAnimationFrame(() => {
    innerId = requestAnimationFrame(() => {
      slot.style.transition = `transform ${duration}ms var(--ease-out-expo)`;
      slot.style.transform = "";
    });
  });

  return () => {
    cancelAnimationFrame(outerId);
    if (innerId !== null) cancelAnimationFrame(innerId);
  };
}

export function getElementCenterX(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
}
