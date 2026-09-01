import { useCallback, useMemo, useRef } from "react";
import { useBattleController } from "./use-battle-controller";

interface BattleCompletionHandlers {
  onBattleVictory: () => void;
  onBattleDefeat: () => void;
}

export function useBattleWiring({
  screen,
  setHoveredCardId,
}: {
  screen: Parameters<typeof useBattleController>[0]["screen"];
  setHoveredCardId: Parameters<typeof useBattleController>[0]["setHoveredCardId"];
}) {
  const battleCompletionRef = useRef<BattleCompletionHandlers>({
    onBattleVictory: () => {},
    onBattleDefeat: () => {},
  });
  const battleCompletionOps = useMemo(
    () => ({
      onBattleVictory: () => battleCompletionRef.current.onBattleVictory(),
      onBattleDefeat: () => battleCompletionRef.current.onBattleDefeat(),
    }),
    [],
  );
  const battle = useBattleController({
    screen,
    setHoveredCardId,
    onBattleVictory: battleCompletionOps.onBattleVictory,
    onBattleDefeat: battleCompletionOps.onBattleDefeat,
  });
  const setBattleCompletionHandlers = useCallback((handlers: BattleCompletionHandlers) => {
    battleCompletionRef.current = handlers;
  }, []);

  return { battle, setBattleCompletionHandlers };
}
