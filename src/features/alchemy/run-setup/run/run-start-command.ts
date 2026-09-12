import { computeTalentEffects, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { applyRunStartSnapshot, grantStartGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunStartSnapshot, type RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";

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

export interface ApplyRunStartResult {
  isFreshStart: boolean;
  startGoldGranted: number;
}

export function applyRunStartToDraft(
  draft: GameplayDraft,
  snapshot: RunStartSnapshot,
  options: ApplyRunStartOptions = {},
): ApplyRunStartResult {
  const isFreshStart = draft.session.activity.kind === "inactive";
  // Only completing this run's starter draft may re-apply its start snapshot.
  if (
    !isFreshStart &&
    !(
      draft.run.activeRun.characterId === "wildcard" &&
      snapshot.characterId === "wildcard" &&
      draft.run.activeRun.contentSystemType === snapshot.contentSystemType &&
      !draft.battle.hasActiveBattle &&
      (draft.session.activity.kind === "draft-deck" || draft.session.activity.kind === "difficulty-select")
    )
  ) {
    throw new Error("Cannot replace an unfinished run");
  }
  applyRunStartSnapshot(draft, snapshot);
  const startGoldGranted = isFreshStart ? snapshot.startGoldGrant : 0;
  if (startGoldGranted > 0) {
    grantStartGold(draft, startGoldGranted);
  }
  if (options.discoverDeck || snapshot.characterId === "wildcard") {
    discoverCardIds(
      draft,
      snapshot.freshDeck.map((card) => card.id),
    );
  }
  return { isFreshStart, startGoldGranted };
}
