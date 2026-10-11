import { resolveGameDelay } from "@/lib/animation/game-timer";

export function playHandSlotReflow(artwork: HTMLElement, deltaX: number, durationMs: number): void {
  const slot = artwork.parentElement;
  const scale = slot && slot.offsetWidth > 0 ? slot.getBoundingClientRect().width / slot.offsetWidth : 1;
  // Layout centers exclude the artwork's unfinished reflow. Carry that visible
  // displacement forward when another play or draw changes the hand mid-motion.
  const remainingX = slot ? (getElementCenterX(artwork) - getElementCenterX(slot)) / scale : 0;
  const offsetX = deltaX / scale + remainingX;
  if (Math.abs(offsetX) < 0.5) {
    // Opposing layout changes can cancel while the previous transition is still
    // displaced. Stop it at rest rather than letting that old offset jump back.
    artwork.style.transition = "none";
    artwork.style.transform = "";
    return;
  }

  artwork.style.transition = "none";
  artwork.style.transform = `translate3d(${offsetX}px, 0, 0)`;
  // Commit the inverted pose before starting the transition, including when
  // autoplay causes consecutive layout commits before the next animation frame.
  artwork.getBoundingClientRect();
  artwork.style.transition = `transform ${resolveGameDelay(durationMs)}ms var(--ease-out-expo)`;
  artwork.style.transform = "";
}

export function getElementCenterX(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
}
