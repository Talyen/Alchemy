import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/material-rewards";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRecap } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { current } from "immer";
import type { GameplayDraft } from "../gameplay-command";
import { addGold } from "./run-gold";
import { addMaterialsToStockpile } from "./run-homestead";
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

function awardRunEndMaterials(draft: GameplayDraft): MaterialInventory {
  const runState = draft.run.activeRun;
  const runProfile = draft.runProfile;
  const rooms = Math.max(0, runState.roomsEncountered);
  const wishGoldRooms = Math.ceil(rooms / 2);
  const gold =
    (runProfile.effects.endRunGoldPerRoom ?? 0) * rooms + (runProfile.effects.endRunWishPerRoom ?? 0) * wishGoldRooms;
  if (gold > 0) addGold(draft, gold);
  const runCollected = runState.runMaterialsEarned;
  const homesteadBonus = applyEndOfRunHomesteadBonuses(emptyInventory(), runProfile.effects, runState.roomsEncountered);
  addMaterialsToStockpile(draft, homesteadBonus);
  setRunEndMaterials(draft, addInventory(runCollected, homesteadBonus));
  setRunEndCurrencies(draft, { ...runState.runCurrenciesEarned });
  clearRunMaterialsEarned(draft);
  clearRunCurrenciesEarned(draft);
  return homesteadBonus;
}

export function settleRunEnd(draft: GameplayDraft, ending: RunRecap["ending"]): MaterialInventory | null {
  const session = draft.session;

  if (session.activity.kind === "inactive") {
    return null;
  }

  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const homesteadBonus = awardRunEndMaterials(draft);
  captureRunRecap(draft, ending);
  finalizeRunXP(draft);
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  setHasActiveRun(draft, false);
  if (ending === "abandoned") clearAbandonedVisit(draft);
  return homesteadBonus;
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
    runEndLabyrinthFloor: session.runEndLabyrinthFloor,
  });
}
