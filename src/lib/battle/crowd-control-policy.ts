import type { CcState } from "./types";

export type ActiveCcKeyword = "stun" | "freeze";

export function getActiveCcKeyword(cc: CcState): ActiveCcKeyword | null {
  if (cc.stunSkipTurns > 0) return "stun";
  if (cc.freezeSkipTurns > 0) return "freeze";
  return null;
}

export function isCcControlled(cc: CcState): boolean {
  return getActiveCcKeyword(cc) !== null;
}

export function isStunFreezeBuildupBlocked(cc: CcState): boolean {
  return isCcControlled(cc) || cc.cooldown > 0;
}
