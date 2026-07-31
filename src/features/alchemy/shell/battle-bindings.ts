// Battle presentation bindings passed from the run controller to the battle screen route.
import type { BattleRefs, CardTransfer } from "@/features/alchemy/shared/types";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export interface BattleControllerBindings {
  battleScreenData: BattleScreenData;
  refs: BattleRefs;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  playableHandCardKeys: Set<string>;
}
