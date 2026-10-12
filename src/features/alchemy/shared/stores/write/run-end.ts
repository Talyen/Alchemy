import { characters, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRecap } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { GameplayDraft } from "../gameplay-command";
import type { RunTransaction } from "../run-session-command";
import { openRunTransaction } from "../transaction-internal";
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
  // Source payouts already updated the stockpile and tally during the run.
  setRunEndMaterials(draft, { ...runState.runMaterialsEarned });
  setRunEndCurrencies(draft, { ...runState.runCurrenciesEarned });
  clearRunMaterialsEarned(draft);
  clearRunCurrenciesEarned(draft);
  return emptyInventory();
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
