import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { readGearMaxHealthBonus } from "@/features/alchemy/shared/stores/gear-store";
import { discoverCardIds, setEncounteredEnemyIds } from "@/features/alchemy/shared/stores/profile-store";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { applyRunStartSnapshot, clearTransientSession } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunStartSnapshot, type RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { grantStartGold } from "@/features/alchemy/shared/stores/gold-purse";
import { parkForegroundRunInDraft } from "@/features/alchemy/shared/stores/run-park-restore";
import { touchRunRecency } from "@/features/alchemy/shared/stores/parked-runs";

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
  const runProfile = readRunProfile();
  return createRunStartSnapshot({
    characterId,
    contentSystemType,
    difficultyId,
    talentStartGold,
    talentXP,
    ...(draftedDeck === undefined ? {} : { draftedDeck }),
    gearMaxHealthBonus: readGearMaxHealthBonus(characterId),
    homesteadMaxHealthBonus: runProfile.effects.runMaxHealthBonus,
  });
}

/** Draft-only run-start mutation; event handlers own the surrounding command and effects. */
export function applyRunStartToDraft(
  draft: GameplayDraft,
  snapshot: RunStartSnapshot,
  options: ApplyRunStartOptions = {},
): void {
  const switching = draft.session.hasActiveRun && draft.run.activeRun.contentSystemType !== snapshot.contentSystemType;
  const isFreshStart = !draft.session.hasActiveRun || switching;
  if (switching) {
    parkForegroundRunInDraft(draft);
    clearTransientSession(draft);
  }
  applyRunStartSnapshot(draft, snapshot);
  if (isFreshStart) {
    grantStartGold(draft, snapshot.startGoldGrant);
  }
  draft.run.runRecency = touchRunRecency(draft.run.runRecency, snapshot.contentSystemType);
  delete draft.run.parkedRuns[snapshot.contentSystemType];
  if (options.discoverDeck || snapshot.characterId === "wildcard") {
    discoverCardIds(
      draft,
      snapshot.freshDeck.map((card) => card.id),
    );
  }
  if (options.resetEncounteredEnemies) setEncounteredEnemyIds(draft, []);
}
