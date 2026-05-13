// Shake-state timing hook for battle panels and companions.
// Depends on React timers and combat feedback timing constants.
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { SHAKE_DURATION } from "@/lib/game-constants";

// Centralizes shake timers so the battle controller can trigger feedback without owning
// separate timeout cleanup for every panel.
export function useBattleShake() {
  const [enemyShaking, setEnemyShaking] = useState(false);
  const [playerShaking, setPlayerShaking] = useState(false);
  const [companionShaking, setCompanionShaking] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function trigger(setShaking: Dispatch<SetStateAction<boolean>>) {
    setShaking(true);
    const timeout = setTimeout(() => setShaking(false), SHAKE_DURATION);
    timeoutsRef.current.push(timeout);
  }

  useEffect(
    () => () => {
      for (const timeout of timeoutsRef.current) clearTimeout(timeout);
      timeoutsRef.current = [];
    },
    [],
  );

  return {
    enemyShaking,
    playerShaking,
    companionShaking,
    shakeEnemy: () => trigger(setEnemyShaking),
    shakePlayer: () => trigger(setPlayerShaking),
    shakeCompanion: () => trigger(setCompanionShaking),
  };
}
