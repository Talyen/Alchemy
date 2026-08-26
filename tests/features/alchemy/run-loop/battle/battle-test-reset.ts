import { afterEach, beforeEach } from "vitest";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { createRunRngState } from "@/lib/run-rng";
import { resetRunBattleSlice, resetRunProgressSlice, setRunProgress } from "../../../../helpers/run-domain-store-test";

export function resetBattlePresentationAndRun(): void {
  useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
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
