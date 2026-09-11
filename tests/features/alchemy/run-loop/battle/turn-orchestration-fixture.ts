import { vi } from "vitest";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
type BattleTurnSession = Pick<ReturnType<typeof createBattleSession>, "isCurrentBattleSession" | "checkBattleEnd">;

export function makeDrawSequenceDeps(overrides: Partial<HandDrawSequenceDeps> = {}): HandDrawSequenceDeps {
  return {
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    ...overrides,
  };
}

export function makeBattleTurnSession(overrides: Partial<BattleTurnSession> = {}): BattleTurnSession {
  return {
    isCurrentBattleSession: () => true,
    checkBattleEnd: vi.fn(() => false),
    ...overrides,
  };
}
