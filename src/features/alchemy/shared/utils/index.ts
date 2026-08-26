// Convenience barrel for alchemy utility helpers.
// Controllers and UI import from here to avoid deep utility paths.
export { tokenizeDescription, getHoverId } from "./string";
export {
  getCombatTextColorClass,
  getCombatImpactVisual,
  getCombatTextIcon,
  getPlayerStatusChips,
  getEnemyStatusChips,
} from "./battle";
export { DEFAULT_TILT_STRENGTH, getCardRect, setTiltFromEvent, clearTiltFromEvent } from "./dom";
export { formatEnemyAttackLines } from "./enemy";
export { isAlchemyDevBuild, shouldSkipStartupLoadingGate } from "./dev-mode";
export { getActiveCcKeyword, type ActiveCcKeyword } from "./cc-presentation";
