import { useEffect, useState } from "react";
import { LOADING_WORDS } from "@/app/loading-words";
import { LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

export function useSyncedLoadingWord() {
  // Sequential rotation with a random start: equally pleasant, no repeat-avoidance math.
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * LOADING_WORDS.length));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setWordIndex((prev) => (prev + 1) % LOADING_WORDS.length);
    }, LOADING_WORD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return { wordIndex, loadingWord: LOADING_WORDS[wordIndex] ?? "Loading" };
}
