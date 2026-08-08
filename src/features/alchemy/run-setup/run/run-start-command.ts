import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { appendUniqueMany } from "@/lib/utils";
import { readGearMaxHealthBonus } from "@/features/alchemy/shared/stores/gear-store";
import { setDiscoveredCardIds, setEncounteredEnemyIds } from "@/features/alchemy/shared/stores/profile-store";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { applyRunStartSnapshot } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunStartSnapshot, type RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";

interface CreateRunStartSnapshotInput {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null;
  draftedDeck?: BattleCard[];
  talentStartGold: number;
  talentXP: TalentXP;
}

interface ApplyRunStartOptions {
  discoverDeck?: boolean;
  resetEncounteredEnemies?: boolean;
}

/** Resolve meta-progression inputs before opening the gameplay command. */
export function createConfiguredRunStartSnapshot({
  characterId,
  contentSystemType,
  difficultyId,
  draftedDeck,
  talentStartGold,
  talentXP,
}: CreateRunStartSnapshotInput): RunStartSnapshot {
  return createRunStartSnapshot({
    characterId,
    contentSystemType,
    difficultyId,
    talentStartGold,
    talentXP,
    ...(draftedDeck === undefined ? {} : { draftedDeck }),
    gearMaxHealthBonus: readGearMaxHealthBonus(characterId),
    homesteadMaxHealthBonus: readRunProfile().effects.runMaxHealthBonus,
  });
}

/** Draft-only run-start mutation; event handlers own the surrounding command and effects. */
export function applyRunStartToDraft(
  draft: GameplayDraft,
  snapshot: RunStartSnapshot,
  options: ApplyRunStartOptions = {},
): void {
  applyRunStartSnapshot(draft, snapshot);
  if (options.discoverDeck || snapshot.characterId === "wildcard") {
    setDiscoveredCardIds(draft, (current) =>
      appendUniqueMany(
        current,
        snapshot.freshDeck.map((card) => card.id),
      ),
    );
  }
  if (options.resetEncounteredEnemies) setEncounteredEnemyIds(draft, []);
}
