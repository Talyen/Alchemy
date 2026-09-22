import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addMaterialsToStockpile,
  addGold,
  clearRunCurrenciesEarned,
  clearRunMaterialsEarned,
  setRunEndCurrencies,
  setRunEndMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/material-rewards";

/**
 * Canonical list of run-earned material grant sites: every
 * awardMaterialsDuringRun grant outside the write port lives in one of
 * these files. The architecture guard test enforces this list. The
 * `alchemy/no-run-earned-add-materials` lint owns the separate
 * stockpile-grant allowlist (write port, this file, gear meta-salvage).
 */
export const AWARD_MATERIALS_CALL_SITES = [
  "src/features/alchemy/run-loop/navigation/mystery-flow.ts",
  "src/features/alchemy/run-loop/run/reward-commands.ts",
  "src/features/alchemy/run-loop/run/victory-commands.ts",
  "src/features/alchemy/shared/stores/gear-session-command.ts",
] as const;

/**
 * Merges run-collected materials with homestead end-of-run bonuses into
 * `session.runEndMaterials`, snapshots the salvaged-currency tally into
 * `session.runEndCurrencies`, and clears both tallies. Returns ONLY the
 * homestead bonus portion; the run total lives in `session.runEndMaterials`.
 */
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
