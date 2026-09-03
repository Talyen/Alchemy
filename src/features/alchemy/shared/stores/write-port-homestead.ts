import type { GameplayDraft } from "./run-session-command";
import type {
  BuildingId,
  FarmId,
  MaterialInventory as ProfileMaterialInventory,
  ResearchId,
} from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";
import * as homestead from "./homestead-actions";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { addRunMaterialsEarned } from "./write-port-run";

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

export function addMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials);
}

export function grantSalvageMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  if (draft.session.hasActiveRun) {
    awardMaterialsDuringRun(draft, materials);
  } else {
    addMaterials(draft, materials);
  }
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
