import type { CcState } from "./types";

function hasActiveCc(cc: CcState): boolean {
  return cc.stunSkipTurns > 0 || cc.freezeSkipTurns > 0;
}

export function isStunFreezeBuildupBlocked(cc: CcState): boolean {
  return hasActiveCc(cc) || cc.cooldown > 0;
}
