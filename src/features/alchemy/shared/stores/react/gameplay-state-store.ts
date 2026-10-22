import { defaultGameSession } from "@/app/application-session";
import type { GameplayState } from "../session/gameplay-state";
import { sessionGameplayStore } from "../session/session-gameplay-store";
import { useStore } from "zustand";
export type { GameplayState } from "../session/gameplay-state";

/** Application adapter. Session controllers use the explicit session hook. */
export const useGameplayStateStore = Object.assign(
  <T>(selector: (state: GameplayState) => T): T =>
    useStore(sessionGameplayStore(defaultGameSession).presentation, selector),
  sessionGameplayStore(defaultGameSession).committed,
);
