// Thin React wiring around createRunTeardown.
import { useMemo } from "react";
import { createRunTeardown, type RunTeardownDeps } from "@/features/alchemy/run-loop/run/create-run-teardown";

export function useRunTeardown({ cancelPending, setHasActiveBattle, clearCardHover, navigateTo }: RunTeardownDeps) {
  return useMemo(
    () =>
      createRunTeardown({
        cancelPending,
        setHasActiveBattle,
        clearCardHover,
        navigateTo,
      }),
    [cancelPending, setHasActiveBattle, clearCardHover, navigateTo],
  );
}
