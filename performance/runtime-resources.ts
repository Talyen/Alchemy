import type { Page } from "@playwright/test";

/** Observe detached media without changing media output or retaining completed cues. */
export async function installRuntimeResourceProbe(page: Page) {
  await page.addInitScript(() => {
    const live = new Map<HTMLMediaElement, { started: number; stopped?: number }>();
    const originalRemove = HTMLMediaElement.prototype.removeAttribute;
    HTMLMediaElement.prototype.removeAttribute = function (name) {
      originalRemove.call(this, name);
      if (name.toLowerCase() === "src") live.delete(this);
    };
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.loop && this.src.includes("/sounds/")) {
        live.set(this, { started: performance.now() });
        for (const event of ["ended", "error", "pause"])
          this.addEventListener(
            event,
            () => {
              const cue = live.get(this);
              if (cue) cue.stopped = performance.now();
            },
            { once: true },
          );
      }
      return originalPlay.call(this).catch((error) => {
        const cue = live.get(this);
        if (cue) cue.stopped = performance.now();
        throw error;
      });
    };
    (
      window as unknown as {
        __alchemyResourceProbe: () => {
          activeSfx: number;
          retainedSfx: number;
          overdueSfx: number;
          ownedAnimations: number;
        };
      }
    ).__alchemyResourceProbe = () => ({
      activeSfx: [...live.keys()].filter((element) => !element.paused && !element.ended).length,
      retainedSfx: live.size,
      overdueSfx: [...live].filter(
        ([element, cue]) =>
          (cue.stopped !== undefined && performance.now() - cue.stopped > 2000) ||
          (Number.isFinite(element.duration) && performance.now() - cue.started > (element.duration + 2) * 1000),
      ).length,
      ownedAnimations: document.querySelectorAll(".card-ghost-overlay, [data-testid='armory-transfer-overlay']").length,
    });
  });
}

export function requireSettledResources(sample: { overdueSfx?: number; ownedAnimations?: number }) {
  if ((sample.overdueSfx ?? 0) > 0 || (sample.ownedAnimations ?? 0) > 0)
    throw new Error(`Unreleased action resources: ${JSON.stringify(sample)}`);
}
