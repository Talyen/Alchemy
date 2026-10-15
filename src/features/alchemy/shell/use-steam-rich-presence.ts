import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import { getSteamRichPresenceToken, type RunPhase, type Screen } from "@/lib/routing";
import { setSteamRichPresence } from "@/lib/platform";

export function useSteamRichPresence(screen: Screen, runPhase: RunPhase, characterId: CharacterId) {
  useEffect(() => {
    let active = true;
    void (async () => {
      await setSteamRichPresence("hero", characterId);
      if (active) await setSteamRichPresence("steam_display", getSteamRichPresenceToken(screen, runPhase));
    })().catch((error: unknown) => console.warn("Steam presence update failed", error));
    return () => {
      active = false;
    };
  }, [screen, runPhase, characterId]);
}
