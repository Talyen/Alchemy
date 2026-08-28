import { isAnimationDisabled, ANIMATION_DISABLED_DURATION } from "@/lib/animation/animation-prefs";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, resolveGameDelay(ms)));
}

export function resolveGameDelay(ms: number): number {
  return isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : ms;
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
