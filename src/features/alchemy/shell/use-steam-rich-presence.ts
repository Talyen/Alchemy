// Steam rich presence updates when screen, run phase, or character changes.
import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import { getSteamRichPresenceLabel, type RunPhase } from "@/lib/routing";
import { setSteamRichPresence } from "@/lib/platform";
import type { Screen } from "@/features/alchemy/shared/types";

export function useSteamRichPresence(screen: Screen, runPhase: RunPhase, characterId: CharacterId) {
  useEffect(() => {
    void setSteamRichPresence("steam_display", getSteamRichPresenceLabel(screen, runPhase, characterId));
  }, [screen, runPhase, characterId]);
}
