import { useCallback, useEffect, useState } from "react";
import { LOADING_WORDS } from "@/app/loading-words";
import { LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

export function useSyncedLoadingWord() {
  const pickNext = useCallback((previousIndex: number) => {
    const wordCount = LOADING_WORDS.length as number;
    if (wordCount === 2) return previousIndex === 0 ? 1 : 0;
    const offset = 1 + Math.floor(Math.random() * (wordCount - 1));
    return (previousIndex + offset) % wordCount;
  }, []);
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * LOADING_WORDS.length));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setWordIndex(pickNext);
    }, LOADING_WORD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [pickNext]);

  return { wordIndex, loadingWord: LOADING_WORDS[wordIndex] ?? "Loading" };
}
