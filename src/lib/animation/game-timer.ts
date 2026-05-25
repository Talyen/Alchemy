// Centralized game timing utilities.
// delay() provides awaitable pauses that respect the animation-disabled flag.
// TimerGroup manages fire-and-forget timeout lifecycle so callers don't need refs.
import { isAnimationDisabled, ANIMATION_DISABLED_DURATION } from "@/lib/game-constants";

export function delay(ms: number): Promise<void> {
  const actual = isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : ms;
  return new Promise((resolve) => setTimeout(resolve, actual));
}

export class TimerGroup {
  private ids = new Set<ReturnType<typeof setTimeout>>();

  setTimeout(fn: () => void, ms: number): () => void {
    const id = setTimeout(() => {
      this.ids.delete(id);
      fn();
    }, ms);
    this.ids.add(id);
    return () => {
      this.ids.delete(id);
      clearTimeout(id);
    };
  }

  clearAll() {
    for (const id of this.ids) {
      clearTimeout(id);
    }
    this.ids.clear();
  }
}
