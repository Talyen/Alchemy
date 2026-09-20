import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import type { SynchronousResult } from "@/features/alchemy/shared/stores/run-session-command";
import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";

export function mutateGearWithFlush<T>(
  flush: () => void,
  mutate: (state: GearDraftView) => T & SynchronousResult<T>,
): T {
  const result = dispatchGearMutationWithRunHealthSync<T>({ mutate });
  if (result) flush();
  return result;
}

export function salvageGearWithFlush(flush: () => void, instanceId: string): boolean {
  const result = dispatchGearSalvageWithMaterialGrant((state) => state.salvage(instanceId));
  if (result) flush();
  return Boolean(result);
}
