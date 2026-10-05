import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";
import type { SynchronousResult } from "@/features/alchemy/shared/stores/run-session-command";

export function mutateGearWithFlush<T>(
  flush: () => void,
  mutate: (state: GearDraftView) => T & SynchronousResult<T>,
  gameSession: GameSession = defaultGameSession,
): T {
  const result = dispatchGearMutationWithRunHealthSync<T>({ mutate }, gameSession);
  if (result) flush();
  return result;
}

export function salvageGearWithFlush(
  flush: () => void,
  instanceId: string,
  gameSession: GameSession = defaultGameSession,
): boolean {
  const result = dispatchGearSalvageWithMaterialGrant((state) => state.salvage(instanceId), gameSession);
  if (result) flush();
  return Boolean(result);
}
