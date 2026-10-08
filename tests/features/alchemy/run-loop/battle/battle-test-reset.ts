import { afterEach, beforeEach } from "vitest";
import { battlePresentation } from "@/app/battle-presentation";
import { createRunRngState } from "@/lib/rng";
import { resetRunBattleSlice, resetRunProgressSlice, setRunProgress } from "../../../../helpers/run-domain-store-test";

export function resetBattlePresentationAndRun(): void {
  battlePresentation.getState().resetPresentation();
  resetRunBattleSlice();
  resetRunProgressSlice();
  setRunProgress({ rng: createRunRngState(() => 0.5) });
}

export function installImmediateRafForTests(): void {
  const raf = globalThis.requestAnimationFrame;
  beforeEach(() => {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = raf;
  });
}
