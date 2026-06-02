// Typed store accessors for injectable handlers (tests pass mocks; production uses Zustand getState).
import { useUiStore } from "./ui-store";
import { useRunSessionStore } from "./run-session-store";

export type RunSessionStoreState = ReturnType<typeof useRunSessionStore.getState>;

export type UiStoreAccess = () => ReturnType<typeof useUiStore.getState>;
export type RunSessionStoreAccess = () => RunSessionStoreState;

export const defaultUiStoreAccess: UiStoreAccess = () => useUiStore.getState();
export const defaultRunSessionStoreAccess: RunSessionStoreAccess = () => useRunSessionStore.getState();
