import { vi, type Mock } from "vitest";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { BattlePresentationPort } from "@/features/alchemy/run-loop/battle/battle-presentation-port";
import type { BattleTurnSession, TurnOrchestration } from "@/features/alchemy/run-loop/battle/turn-orchestration";

type MockBattlePresentationPort = {
  [K in keyof BattlePresentationPort]: BattlePresentationPort[K] extends (...args: infer A) => infer R
    ? Mock<(...args: A) => R>
    : BattlePresentationPort[K];
};

export function makePresentationPort(overrides: Partial<MockBattlePresentationPort> = {}): MockBattlePresentationPort {
  return {
    hiddenHandCardKeys: [],
    cardTransferInProgress: false,
    spawnCardGhost: vi.fn(),
    showCombatTexts: vi.fn(),
    shakePlayer: vi.fn(),
    shakeEnemy: vi.fn(),
    shakeCompanion: vi.fn(),
    telegraphAttack: vi.fn(),
    telegraphCast: vi.fn(),
    resetHandTransferUi: vi.fn(),
    resetCardTransfers: vi.fn(),
    clearCardGhosts: vi.fn(),
    clearFloatingCombatTexts: vi.fn(),
    setCardTransfers: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    setCardTransferInProgress: vi.fn(),
    ...overrides,
  };
}

export function makeDrawSequenceDeps(overrides: Partial<HandDrawSequenceDeps> = {}): HandDrawSequenceDeps {
  return {
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    runIfSessionActive: (_session, action) => action(),
    ...overrides,
  };
}

export function makeBattleTurnSession(overrides: Partial<BattleTurnSession> = {}): BattleTurnSession {
  return {
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    ...overrides,
  };
}

export function makeTurnOrchestration(
  overrides: Partial<TurnOrchestration> = {},
  presentation: BattlePresentationPort = makePresentationPort(),
): TurnOrchestration {
  return {
    getDrawSequenceDeps: () => makeDrawSequenceDeps(),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
    scheduleAutoEndTurn: vi.fn(),
    getPresentation: () => presentation,
    ...overrides,
  };
}
