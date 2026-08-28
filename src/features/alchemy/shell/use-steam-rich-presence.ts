import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import { getSteamRichPresenceLabel, type RunPhase, type Screen } from "@/lib/routing";
import { setSteamRichPresence } from "@/lib/platform";

export function useSteamRichPresence(screen: Screen, runPhase: RunPhase, characterId: CharacterId) {
  useEffect(() => {
    void setSteamRichPresence("steam_display", getSteamRichPresenceLabel(screen, runPhase, characterId));
  }, [screen, runPhase, characterId]);
}
