import { useBattleStore } from "../stores/battle-store";
import { useBattlePresentationStore } from "../stores/battle-presentation-store";

/** Domain battle state plus presentation VFX actions used by turn/card-play orchestration. */
export function getBattleSessionStore() {
  return { ...useBattleStore.getState(), ...useBattlePresentationStore.getState() };
}
