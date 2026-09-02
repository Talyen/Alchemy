import { computeTalentEffects, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  applyRunStartSnapshot,
  clearTransientSession,
  grantStartGold,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunStartSnapshot, type RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { parkForegroundRunInDraft } from "@/features/alchemy/shared/stores/run-park-restore";
import { omitParkedMode, touchRunRecency } from "@/features/alchemy/shared/stores/parked-runs";

interface CreateRunStartSnapshotInput {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null;
  draftedDeck?: BattleCard[];
}

interface ApplyRunStartOptions {
  discoverDeck?: boolean;
}

export function createDraftRunStartSnapshot(
  draft: GameplayDraft,
  { characterId, contentSystemType, difficultyId, draftedDeck }: CreateRunStartSnapshotInput,
): RunStartSnapshot {
  const talentXP = draft.runProfile.talentXP;
  const talentStartGold = computeTalentEffects(draft.runProfile.unlockedTalents).startGold;
  const gearMaxHealthBonus = computeGearManifest(
    characterId,
    flattenGearInventories(draft.gear.inventories),
    draft.gear.loadouts,
  ).maxHealth;
  const homesteadMaxHealthBonus = draft.runProfile.effects.runMaxHealthBonus;
  return createRunStartSnapshot({
    characterId,
    contentSystemType,
    difficultyId,
    talentStartGold,
    talentXP,
    ...(draftedDeck === undefined ? {} : { draftedDeck }),
    gearMaxHealthBonus,
    homesteadMaxHealthBonus,
  });
}

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
  draft.run.parkedRuns = omitParkedMode(draft.run.parkedRuns, snapshot.contentSystemType);
  if (options.discoverDeck || snapshot.characterId === "wildcard") {
    discoverCardIds(
      draft,
      snapshot.freshDeck.map((card) => card.id),
    );
  }
}
