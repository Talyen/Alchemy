// Mystery session write port — event + card-choice transient fields.
import type { BattleCard } from "@/lib/game-data";
import type { MysteryEvent } from "@/lib/mystery";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

export function setMysteryEvent(event: MysteryEvent | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setMysteryEvent(event));
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setMysteryCardChoices(choices));
}
