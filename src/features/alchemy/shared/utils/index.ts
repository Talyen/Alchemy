// Convenience barrel for alchemy utility helpers.
// Depends on local utility submodules only.
// Controllers and UI import from here to avoid deep utility paths.
export { tokenizeDescription, getHoverId } from "./string";
export {
  getCombatTextColorClass,
  getCombatTextIcon,
  getPlayerStatusChips,
  getEnemyStatusChips,
  getBattleCardPlayTarget,
} from "./battle";
export { DEFAULT_TILT_STRENGTH, getCardRect, setTiltFromEvent, clearTiltFromEvent } from "./dom";
export { formatEnemyAttackLines } from "./enemy";
export { isAlchemyDevBuild, shouldSkipStartupLoadingGate } from "./dev-mode";
export { getActiveCcKeyword, isPlayerCcControlled, type ActiveCcKeyword } from "./cc-presentation";
