// Static card definitions. Cards are split into ordered data chunks to keep source files small.
// Pool/persistence helpers live in cards/card-pools.ts and cards/hydrate-card.ts.
import type { BattleCard } from "./types";
import { cardLibraryPart1 } from "./cards/card-library-part-1";
import { cardLibraryPart2 } from "./cards/card-library-part-2";
import { cardLibraryPart3 } from "./cards/card-library-part-3";
import { cardLibraryPart4 } from "./cards/card-library-part-4";
import { cardLibraryPart5 } from "./cards/card-library-part-5";
import { cardLibraryPart6 } from "./cards/card-library-part-6";

export const cardLibrary: BattleCard[] = [
  cardLibraryPart1,
  cardLibraryPart2,
  cardLibraryPart3,
  cardLibraryPart4,
  cardLibraryPart5,
  cardLibraryPart6,
].flat();

export { expectedCompanionTurnLine, formatCompanionTurnLineBase } from "./cards/companion-turn-description";
