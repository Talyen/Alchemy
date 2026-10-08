import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/material-rewards";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRecap } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { GameplayDraft } from "../gameplay-command";
import type { RunTransaction } from "../run-session-command";
import { openRunTransaction } from "../transaction-internal";
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
} from "./run-session";

export function awardRunEndMaterials(draft: GameplayDraft): MaterialInventory {
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

export function settleRunEnd(
  options:
    | {
        awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
        finalizeRunXP: (transaction: RunTransaction) => void;
      }
    | undefined,
  draft: GameplayDraft,
  ending: RunRecap["ending"],
): MaterialInventory {
  const session = draft.session;

  if (session.activity.kind === "inactive") {
    return emptyInventory();
  }

  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const scope = options ? openRunTransaction(draft) : null;
  let homesteadBonus: MaterialInventory;
  try {
    homesteadBonus = options && scope ? options.awardRunEndMaterials(scope.transaction) : awardRunEndMaterials(draft);
    captureRunRecap(draft, ending);
    if (options && scope) options.finalizeRunXP(scope.transaction);
    else finalizeRunXP(draft);
  } finally {
    scope?.close();
  }
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  setHasActiveRun(draft, false);
  return homesteadBonus;
}
