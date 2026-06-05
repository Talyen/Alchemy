import { readBattleStore } from "../../shared/stores/run-session-read";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";

/** Domain battle state plus presentation VFX actions used by turn/card-play orchestration. */
export function getBattleSessionStore() {
  return { ...readBattleStore(), ...useBattlePresentationStore.getState() };
}
