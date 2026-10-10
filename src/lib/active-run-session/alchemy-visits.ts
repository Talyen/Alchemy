import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard, KeywordId } from "@/lib/game-data";
export interface TransmutationChoice {
  keyword: KeywordId;
  candidates: BattleCard[];
}

interface TransmutationSelection {
  choices: TransmutationChoice[];
  sourceIndex: number | null;
  source: BattleCard | null;
  keyword: KeywordId | null;
  offerIndex: number | null;
}

export type TransmutationSelectionCommand =
  | { kind: "source"; index: number; card: BattleCard }
  | { kind: "keyword"; keyword: KeywordId }
  | { kind: "outcome"; index: number }
  | { kind: "back"; to: "source" | "keyword" };

export interface AlchemyVisit {
  offers: BattleCard[];
  result: BattleCard | null;
  original: BattleCard | null;
  completed: boolean;
  transmutation?: TransmutationSelection | undefined;
}
export function emptyAlchemyVisit(): AlchemyVisit {
  return { offers: [], result: null, original: null, completed: false };
}

export function hydrateAlchemyVisit(visit: AlchemyVisit | null | undefined): AlchemyVisit | null {
  return visit
    ? {
        ...visit,
        offers: visit.offers.map(hydrateCard),
        ...(visit.transmutation
          ? {
              transmutation: {
                ...visit.transmutation,
                choices: visit.transmutation.choices.map((choice) => ({
                  ...choice,
                  candidates: choice.candidates.map(hydrateCard),
                })),
                source: visit.transmutation.source ? hydrateCard(visit.transmutation.source) : null,
              },
            }
          : {}),
        original: visit.original ? hydrateCard(visit.original) : null,
        result: visit.result ? hydrateCard(visit.result) : null,
      }
    : null;
}
