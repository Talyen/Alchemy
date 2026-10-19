import { resolveGameDelay } from "@/lib/animation/game-timer";

export interface HandSlotReflow {
  artwork: HTMLElement;
  deltaX: number;
}

export function playHandSlotReflows(reflows: readonly HandSlotReflow[], durationMs: number): void {
  if (reflows.length === 0) return;
  // Read every interrupted pose before changing any sibling. A hand change
  // otherwise alternates layout reads and style writes once per card.
  const poses = reflows.map(({ artwork, deltaX }) => {
    const slot = artwork.parentElement;
    const scale = slot && slot.offsetWidth > 0 ? slot.getBoundingClientRect().width / slot.offsetWidth : 1;
    // Layout centers exclude the artwork's unfinished reflow. Carry that visible
    // displacement forward when another play or draw changes the hand mid-motion.
    const remainingX = slot ? (getElementCenterX(artwork) - getElementCenterX(slot)) / scale : 0;
    const offsetX = deltaX / scale + remainingX;
    return { artwork, offsetX };
  });
  const moving = poses.filter(({ offsetX }) => Math.abs(offsetX) >= 0.5);
  for (const { artwork, offsetX } of poses) {
    if (Math.abs(offsetX) < 0.5) {
      // Opposing layout changes can cancel while the previous transition is still
      // displaced. Stop it at rest rather than letting that old offset jump back.
      artwork.style.transition = "none";
      artwork.style.transform = "";
      continue;
    }

    artwork.style.transition = "none";
    artwork.style.transform = `translate3d(${offsetX}px, 0, 0)`;
  }
  // One flush commits all inverted poses, including consecutive commits before
  // the next animation frame. Starting transitions earlier would skip that pose.
  moving[0]?.artwork.getBoundingClientRect();
  for (const { artwork } of moving) {
    artwork.style.transition = `transform ${resolveGameDelay(durationMs)}ms var(--ease-out-expo)`;
    artwork.style.transform = "";
  }
}

export function getElementCenterX(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
}
