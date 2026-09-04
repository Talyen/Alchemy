import { useCallback, useEffect, useState } from "react";
import { LOADING_WORDS } from "@/app/loading-words";
import { LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

const LETTER_COUNT = "Alchemy".length;
const LOOP_LENGTH = 2 * (LETTER_COUNT - 1);

export function useSyncedLoadingWord() {
  const pickNext = useCallback((previousIndex: number) => {
    const wordCount = LOADING_WORDS.length as number;
    if (wordCount === 2) return previousIndex === 0 ? 1 : 0;
    const offset = 1 + Math.floor(Math.random() * (wordCount - 1));
    return (previousIndex + offset) % wordCount;
  }, []);
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * LOADING_WORDS.length));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setWordIndex(pickNext);
      setTick((previous) => previous + 1);
    }, LOADING_WORD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pickNext]);

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return { wordIndex, loadingWord: LOADING_WORDS[wordIndex] ?? "Loading", litCount: LETTER_COUNT };
  }
  const position = tick % LOOP_LENGTH;
  const litCount = position <= LETTER_COUNT - 1 ? position + 1 : LOOP_LENGTH - position + 1;
  return { wordIndex, loadingWord: LOADING_WORDS[wordIndex] ?? "Loading", litCount };
}
