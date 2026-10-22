import { characters, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
import type { RunRecap } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { current } from "immer";
import type { GameplayDraft } from "../../session/gameplay-command";
import { clearRunCurrenciesEarned, clearRunMaterialsEarned, cloneRunObtainedItem } from "./run-progress";
import { finalizeRunXP, setFinishedRunCharacters } from "./run-meta";
import { captureRunRecap } from "./run-recap";
import {
  setRunEndCurrencies,
  setRunEndMaterials,
  setRunEndItems,
  setRunEndLabyrinthFloor,
  setHasActiveRun,
  clearTransientSession,
} from "./run-session";

function captureRunEndResources(draft: GameplayDraft): void {
  const runState = draft.run.activeRun;
  // Source payouts already updated the stockpile and tally during the run.
  setRunEndMaterials(draft, { ...runState.runMaterialsEarned });
  setRunEndCurrencies(draft, { ...runState.runCurrenciesEarned });
  clearRunMaterialsEarned(draft);
  clearRunCurrenciesEarned(draft);
}

export function settleRunEnd(draft: GameplayDraft, ending: RunRecap["ending"]): boolean {
  const session = draft.session;

  if (session.activity.kind === "inactive") {
    return false;
  }

  const activeChar = draft.run.activeRun.characterId;
  const lockedCharacters = (Object.keys(characters) as CharacterId[]).filter(
    (id) => !isCharacterUnlocked(id, draft.profile.finishedRunCharacters),
  );
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  draft.session.runEndUnlockedCharacters = lockedCharacters.filter((id) =>
    isCharacterUnlocked(id, draft.profile.finishedRunCharacters),
  );

  captureRunEndResources(draft);
  captureRunRecap(draft, ending);
  finalizeRunXP(draft);
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  setHasActiveRun(draft, false);
  if (ending === "abandoned") clearAbandonedVisit(draft);
  return true;
}

function clearAbandonedVisit(draft: GameplayDraft): void {
  // Clear visit/claim state while retaining the completed recap. Snapshot before
  // reset so the retained fields do not depend on replaced draft branches.
  const session = current(draft.session);
  clearTransientSession(draft);
  Object.assign(draft.session, {
    runRecap: session.runRecap,
    runEndMaterials: session.runEndMaterials,
    runEndCurrencies: session.runEndCurrencies,
    runEndTalentXP: session.runEndTalentXP,
    runEndItems: session.runEndItems,
    runEndUnlockedCharacters: session.runEndUnlockedCharacters,
    runEndLabyrinthFloor: session.runEndLabyrinthFloor,
  });
}
