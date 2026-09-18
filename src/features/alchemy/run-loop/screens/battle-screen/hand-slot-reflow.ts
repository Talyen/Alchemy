import { resolveGameDelay } from "@/lib/animation/game-timer";

export function playHandSlotReflow(slot: HTMLElement, deltaX: number, durationMs: number): () => void {
  if (Math.abs(deltaX) < 0.5) return () => {};

  const duration = resolveGameDelay(durationMs);

  slot.style.transition = "none";
  slot.style.transform = `translate3d(${deltaX}px, 0, 0)`;

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
