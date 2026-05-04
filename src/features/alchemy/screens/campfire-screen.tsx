// Campfire rest screen — restores a percentage of max HP.
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { campfire } from "@/lib/game-data";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY, CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";

export function CampfireScreen({
  playerHealth,
  maxHp,
  onContinue,
}: {
  playerHealth: number;
  maxHp: number;
  onContinue: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [displayHp, setDisplayHp] = useState(playerHealth);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const timeout = setTimeout(onContinue, CAMPFIRE_CONTINUE_DELAY);
      return () => clearTimeout(timeout);
    }
  }, [done, onContinue]);

  function handleRest() {
    setResting(true);
    const targetHp = Math.min(maxHp, playerHealth + Math.floor(maxHp * CAMPFIRE_HEAL_FRACTION));
    setDisplayHp(targetHp);
    setTimeout(() => setDone(true), CAMPFIRE_ANIMATION_MS);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 text-center">
      <h1 className="text-4xl font-semibold text-foreground">Campfire</h1>
      <p className="-mt-6 text-base text-muted-foreground">Rest to Restore 30% HP</p>

      <img src={campfire} alt="Campfire" className="w-full max-w-[400px] rounded-[22px] object-contain" />

      {!resting ? (
        <Button size="lg" onClick={handleRest}>
          Rest
        </Button>
      ) : (
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">HP</span>
            <span className="text-muted-foreground">{displayHp} / {maxHp}</span>
          </div>
          <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-red-500"
              style={{
                width: `${(displayHp / maxHp) * 100}%`,
                transition: resting ? "width 1200ms linear" : "none",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
