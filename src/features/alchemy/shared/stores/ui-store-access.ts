// Injectable ui-store accessor for handlers (tests pass mocks; production uses Zustand getState).
import { useUiStore } from "./ui-store";

export type UiStoreAccess = () => ReturnType<typeof useUiStore.getState>;

export const defaultUiStoreAccess: UiStoreAccess = () => useUiStore.getState();
