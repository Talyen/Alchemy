// Public card library barrel. The ordered chunks preserve the historical flat cardLibrary order.
import type { BattleCard } from "./types";
import { advancedCards } from "./cards/library/advanced-cards";
import { coreCards } from "./cards/library/core-cards";
import { specialtyCards } from "./cards/library/specialty-cards";

export const cardLibrary: BattleCard[] = [...coreCards, ...specialtyCards, ...advancedCards];

export {
  expectedCompanionTurnLine,
  formatCompanionTurnLineBase,
  formatCompanionTurnStartLine,
  type CompanionTurnLineContext,
} from "./cards/companion-turn-description";
