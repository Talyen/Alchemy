// Mystery session write port — event + card-choice transient fields.
import type { BattleCard } from "@/lib/game-data";
import type { MysteryEvent } from "@/lib/mystery";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

export function setMysteryEvent(event: MysteryEvent | null) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setMysteryEvent(event));
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setMysteryCardChoices(choices));
}
