import type { CompanionId } from "@/lib/game-data";
import type {
  BuildingId,
  FarmId,
  MaterialInventory as ProfileMaterialInventory,
  ResearchId,
} from "@/lib/homestead/types";
import type { GameplayDraft } from "../run-session-command";
import * as homestead from "../homestead-actions";
import { rebindLiveRunMeta } from "./live-meta";
import { addRunMaterialsEarned } from "./run-progress";

// ── Homestead ────────────────────────────────────────────────────────────────
// Dual-write refresher: `runProfile.materialInventory` is the stockpile;
// `run.activeRun.runMaterialsEarned` tallies what the live run earned.
// `awardMaterialsDuringRun` writes both; `addMaterialsToStockpile` writes the
// stockpile only (homestead end-of-run bonuses, meta salvage).

function grantMaterials(
  draft: GameplayDraft,
  materials: ProfileMaterialInventory,
  options: { trackRunEarned?: boolean } = {},
): void {
  homestead.addMaterials(draft.runProfile, materials);
  if (options.trackRunEarned) addRunMaterialsEarned(draft, materials);
}

export function awardMaterialsDuringRun(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials, { trackRunEarned: true });
}

export function setMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  homestead.setMaterials(draft.runProfile, materials);
}

// Stockpile-only grant: homestead end-of-run bonuses and meta salvage. Run-earned
// materials must use `awardMaterialsDuringRun` so the run tally stays accurate
// (enforced by `alchemy/no-run-earned-add-materials`).
export function addMaterialsToStockpile(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials);
}

function rebindOnSuccess(ok: boolean, draft: GameplayDraft): boolean {
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  return rebindOnSuccess(homestead.constructBuilding(draft.runProfile, id), draft);
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  return rebindOnSuccess(homestead.plantFarm(draft.runProfile, id), draft);
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  return rebindOnSuccess(homestead.completeResearch(draft.runProfile, id), draft);
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  return rebindOnSuccess(homestead.bondCompanion(draft.runProfile, id), draft);
}
