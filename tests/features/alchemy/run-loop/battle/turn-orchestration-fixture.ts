import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { vi } from "vitest";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
export function makeDrawSequenceDeps(overrides: Partial<HandDrawSequenceDeps> = {}): HandDrawSequenceDeps {
  const lifetime = new PlaybackLifetime();
  return {
    playback: {
      beginDraw: () => lifetime.beginDraw(lifetime.id),
      get pendingDraws() {
        return lifetime.pendingDraws;
      },
      waitForFrame: async () => true,
      waitForDelay: async (_id: number, ms: number) => {
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
        return true;
      },
    },
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    ...overrides,
  };
}
