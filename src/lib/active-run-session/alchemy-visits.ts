import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard } from "@/lib/game-data";
export interface AlchemyVisit {
  offers: BattleCard[];
  result: BattleCard | null;
  original: BattleCard | null;
  completed: boolean;
}
export function emptyAlchemyVisit(): AlchemyVisit {
  return { offers: [], result: null, original: null, completed: false };
}

export function hydrateAlchemyVisit(visit: AlchemyVisit | null | undefined): AlchemyVisit | null {
  return visit
    ? {
        ...visit,
        offers: visit.offers.map(hydrateCard),
        original: visit.original ? hydrateCard(visit.original) : null,
        result: visit.result ? hydrateCard(visit.result) : null,
      }
    : null;
}
