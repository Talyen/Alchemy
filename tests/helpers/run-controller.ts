import type { ContentNavigationRunPort, ContentNavigationTalentPort } from "@/features/alchemy/shared/stores/run-reads";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { computeTalentEffects } from "@/lib/game-data/talents";

export function makeRunController(): ContentNavigationRunPort {
  const run = readActiveRun();
  return {
    contentSystemType: run.contentSystemType,
    lastOfferedDestinations: run.lastOfferedDestinations,
    destinationRoundsSinceOffered: run.destinationRoundsSinceOffered,
  };
}

export function makeTalentController(): ContentNavigationTalentPort {
  const profile = readRunProfile();
  return {
    talentXP: profile.talentXP,
    talentEffects: computeTalentEffects(profile.unlockedTalents),
  };
}
