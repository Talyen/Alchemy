// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import type { BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { setCorruptionResult } from "../../shared/stores/run-session-actions";

export function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  setRunDeck: (deck: BattleCard[]) => void,
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>,
) {
  const { deck, result } = corruptDeckCard(runDeck, cardIndex);
  setRunDeck(deck);
  setCorruptionResult(result);
  setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
  playUISound("musicBoxMystery");
}
