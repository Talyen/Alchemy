// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import type { BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import type { RunSessionStoreState } from "../stores/store-access";

export function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  setRunDeck: (deck: BattleCard[]) => void,
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>,
  runSession: Pick<RunSessionStoreState, "setCorruptionResult">,
) {
  const { deck, result } = corruptDeckCard(runDeck, cardIndex);
  setRunDeck(deck);
  runSession.setCorruptionResult(result);
  setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
  playUISound("musicBoxMystery");
}
