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

export function grantMaterials(
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

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  const ok = homestead.constructBuilding(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  const ok = homestead.plantFarm(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  const ok = homestead.completeResearch(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  const ok = homestead.bondCompanion(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}
