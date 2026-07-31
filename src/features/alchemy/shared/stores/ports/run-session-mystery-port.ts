// Mystery session write port — event + card-choice transient fields.
import type { BattleCard } from "@/lib/game-data";
import type { MysteryEvent } from "@/lib/mystery";
import { getRunTransientStore } from "../run-transient-store";
import { dispatchRunSessionCommand } from "../run-session-command";

export function setMysteryEvent(event: MysteryEvent | null) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setMysteryEvent(event));
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setMysteryCardChoices(choices));
}
