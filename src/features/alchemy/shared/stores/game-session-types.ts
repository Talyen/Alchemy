import type * as Audio from "@/lib/audio";
import type { SaveBackend } from "@/lib/platform-save-backend";

declare const gameSessionBrand: unique symbol;

/** An independent career, including permanent progression and its current run. */
export interface GameSession {
  readonly [gameSessionBrand]: true;
  dispose(): Promise<void>;
}

export interface SessionClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number;
  clearTimeout: (timer: ReturnType<typeof setTimeout> | number) => void;
}

type SessionAudio = Pick<
  typeof Audio,
  "playUISound" | "playGoldGain" | "playGoldSpend" | "playVictory" | "playRunVictory" | "playDefeat" | "stopAllSfx"
>;

export interface SessionFeedback extends SessionAudio {
  clearCardHover: () => void;
  clearBattleUi: () => void;
  clearSaveConfirmation: () => void;
  resetTransientUi: () => void;
}

export interface GameSessionOptions {
  saveBackend?: SaveBackend;
  runtimeInputs?: {
    clock?: SessionClock;
    generateRunSeed?: () => number;
    createInstanceId?: () => string;
  };
  feedback?: Partial<SessionFeedback>;
}
