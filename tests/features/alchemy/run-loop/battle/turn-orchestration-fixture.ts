import { vi } from "vitest";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
export function makeDrawSequenceDeps(overrides: Partial<HandDrawSequenceDeps> = {}): HandDrawSequenceDeps {
  return {
    beginDraw: () => () => {},
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    ...overrides,
  };
}
