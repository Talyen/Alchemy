import { useStore } from "zustand";
import { defaultGameSession } from "@/app/application-session";
import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { sessionRuntime } from "./session-runtime";
export type { GameplayState } from "./gameplay-state";

const runtime = sessionRuntime(defaultGameSession);
const applicationStore = runtime.gameplay;
// Retain the immutable pre-action reference until local acknowledgement. Domain
// reads still use the committed store; only player-facing hooks wait for saving.
let cachedLive: GameplayState | undefined;
let cachedBase: GameplayState | undefined;
let cachedPresentation: GameplayState = applicationStore.getState();
const presentationStore = {
  getState: () => {
    const live = applicationStore.getState();
    if (!runtime.progressCompletion.active || runtime.progressCompletion.read().kind === "idle") return live;
    const base = runtime.presentationBase;
    if (cachedLive !== live || cachedBase !== base) {
      cachedLive = live;
      cachedBase = base;
      cachedPresentation = {
        ...base,
        run: { ...base.run, navigation: live.run.navigation },
        profile: {
          ...base.profile,
          collectionTab: live.profile.collectionTab,
          collectionPages: live.profile.collectionPages,
        },
        session: { ...base.session, selectedLabyrinthNodeId: live.session.selectedLabyrinthNodeId },
      };
    }
    return cachedPresentation;
  },
  getInitialState: applicationStore.getInitialState,
  subscribe: (listener: () => void) => {
    const gameplay = applicationStore.subscribe(listener);
    const progress = runtime.progressCompletion.subscribe(listener);
    return () => {
      gameplay();
      progress();
    };
  },
};
export const useGameplayStateStore = Object.assign(
  <T>(selector: (state: GameplayState) => T): T => useStore(presentationStore, selector),
  applicationStore,
);

export function readGameplayState(gameSession: GameSession): GameplayState {
  return sessionRuntime(gameSession).gameplay.getState();
}

export function subscribeGameplayCommits(listener: (revision: number) => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.gameplay.subscribe((state) => listener(state.revision)));
}
