import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { sessionRuntime } from "./session-runtime";

function createSessionGameplayStore(gameSession: GameSession) {
  const runtime = sessionRuntime(gameSession);
  const committedStore = runtime.gameplay.reads;
  // Retain the immutable pre-action reference until local acknowledgement. Domain
  // reads still use the committed store; only player-facing hooks wait for saving.
  let cachedLive: GameplayState | undefined;
  let cachedBase: GameplayState | undefined;
  let cachedPresentation: GameplayState = committedStore.getState();
  const presentationStore = {
    getState: () => {
      const live = committedStore.getState();
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
    getInitialState: committedStore.getInitialState,
    subscribe: (listener: (state: GameplayState, previous: GameplayState) => void) => {
      let previous = presentationStore.getState();
      const notify = () => {
        const current = presentationStore.getState();
        const before = previous;
        previous = current;
        listener(current, before);
      };
      const gameplay = committedStore.subscribe(notify);
      const progress = runtime.progressCompletion.subscribe(notify);
      return runtime.track(() => {
        gameplay();
        progress();
      });
    },
  };
  return { committed: committedStore, presentation: presentationStore };
}

const stores = new WeakMap<GameSession, ReturnType<typeof createSessionGameplayStore>>();

/** One projection cache per career; subscriptions are released on session disposal. */
export function sessionGameplayStore(gameSession: GameSession) {
  sessionRuntime(gameSession);
  let store = stores.get(gameSession);
  if (!store) {
    store = createSessionGameplayStore(gameSession);
    stores.set(gameSession, store);
  }
  return store;
}
