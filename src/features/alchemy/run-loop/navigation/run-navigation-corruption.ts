// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import type { BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { setCorruptionResult } from "../../shared/stores/run-session-facade";
import { useAppStore } from "../../shared/stores/app-store";

export function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  setRunDeck: (deck: BattleCard[]) => void,
) {
  const { deck, result } = corruptDeckCard(runDeck, cardIndex);
  setRunDeck(deck);
  setCorruptionResult(result);
  useAppStore.getState().setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
  playUISound("musicBoxMystery");
}
