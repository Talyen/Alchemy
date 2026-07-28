// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { setCorruptionResult } from "../../shared/stores/run-session-facade";
import { useProfileStore } from "../../shared/stores/profile-store";

export function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  rng: () => number,
  setRunDeck: (deck: BattleCard[]) => void,
) {
  const { deck, result } = corruptDeckCard(runDeck, cardIndex, cardLibrary, rng);
  setRunDeck(deck);
  setCorruptionResult(result);
  useProfileStore.getState().setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
  playUISound("musicBoxMystery");
}
