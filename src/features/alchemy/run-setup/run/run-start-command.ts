import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  isEditionCharacterAvailable,
  isEditionModeAvailable,
  isEditionDifficultyAvailable,
  IS_DEMO,
} from "@/lib/game-edition";
import { isCharacterUnlocked } from "@/lib/game-data";
import type { CharacterId } from "@/lib/game-data";
import type { RunActivity } from "@/lib/active-run-session";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { discoverCardIds } from "@/features/alchemy/shared/stores/session/profile-store";
import type { RunTransaction } from "@/features/alchemy/shared/stores/commands/run-session-command";
import { applyRunStartSnapshot } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import {
  createRunStartSnapshot,
  type RunStartInput,
  type RunStartSnapshot,
} from "@/features/alchemy/shared/run-flow/run-start";

type RunStartRequest = Pick<RunStartInput, "characterId" | "contentSystemType" | "difficultyId" | "draftedDeck">;
type RunIdentity = Pick<RunStartSnapshot, "characterId" | "contentSystemType">;

/** Only this run's own Wildcard draft may replace unfinished progress. */
export function canReplaceRunForStart(current: RunIdentity, activity: RunActivity["kind"], next: RunIdentity): boolean {
  return (
    activity === "inactive" ||
    (current.characterId === "wildcard" &&
      next.characterId === "wildcard" &&
      current.contentSystemType === next.contentSystemType &&
      (activity === "draft-deck" || activity === "difficulty-select"))
  );
}

export function isDifficultySelectContinuation(
  characterId: CharacterId | null,
  activity: RunActivity["kind"],
): boolean {
  return characterId === "wildcard" && activity === "difficulty-select";
}

/** Validate, prepare and apply a start in the same transaction. */
export function startRunInDraft(
  draft: RunTransaction,
  { characterId, contentSystemType, difficultyId, draftedDeck }: RunStartRequest,
  options: { discoverDeck?: boolean } = {},
): void {
  if (
    !isEditionCharacterAvailable(characterId) ||
    !isEditionModeAvailable(contentSystemType) ||
    (difficultyId != null && !isEditionDifficultyAvailable(difficultyId)) ||
    (IS_DEMO && !isCharacterUnlocked(characterId, draft.profile.finishedRunCharacters))
  ) {
    throw new Error("This run is unavailable");
  }
  const gearMaxHealthBonus = computeGearManifest(
    characterId,
    flattenGearInventories(snapshotTransactionValue(draft.gear.inventories)),
    draft.gear.loadouts,
  ).maxHealth;
  const snapshot = createRunStartSnapshot({
    characterId,
    contentSystemType,
    difficultyId,
    talentXP: draft.runProfile.talentXP,
    draftedDeck:
      draftedDeck ?? (characterId === "wildcard" ? snapshotTransactionValue(draft.run.activeRun.runDeck) : undefined),
    gearMaxHealthBonus,
    homesteadMaxHealthBonus: draft.runProfile.effects.runMaxHealthBonus,
  });
  if (!canReplaceRunForStart(draft.run.activeRun, draft.session.activity.kind, snapshot)) {
    throw new Error("Cannot replace an unfinished run");
  }
  applyRunStartSnapshot(draft, snapshot);
  if (options.discoverDeck || characterId === "wildcard") {
    discoverCardIds(
      draft,
      snapshot.runDeck.map((card) => card.id),
    );
  }
}
