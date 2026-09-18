import { useEffect, useState } from "react";
import { INITIAL_LOAD_MIN_DURATION_MS, LOADING_WORD_FADE_MS, LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";
import { clamp01 } from "@/lib/math";
import { LOADING_WORDS } from "./loading-words";

function useSyncedLoadingWord() {
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

interface Props {
  progress: number;
}

export function StartupLoadingScreen({ progress }: Props) {
  const fill = clamp01(progress);
  const { wordIndex, loadingWord } = useSyncedLoadingWord();

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-background"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      aria-label="Loading Alchemy"
    >
      <h1 className="relative font-sans text-4xl font-black tracking-[0.15em] uppercase" aria-label="Alchemy">
        <span aria-hidden className="text-stone-700">
          Alchemy
        </span>
        <span
          aria-hidden
          className="alchemy-loading-logo-fill absolute inset-y-0 left-0 overflow-hidden"
          style={{ animationDuration: `${INITIAL_LOAD_MIN_DURATION_MS}ms` }}
        >
          <span className="w-max text-primary">Alchemy</span>
        </span>
      </h1>
      <p
        key={wordIndex}
        className="alchemy-loading-word -mt-3 text-[12px] font-medium tracking-[0.18em] text-muted-foreground uppercase"
        // Inline duration wins over the .alchemy-loading-word shorthand; both
        // mirror LOADING_WORD_FADE_MS (parity asserted in lint-architecture-smoke).
        style={{ animationDuration: `${LOADING_WORD_FADE_MS}ms` }}
      >
        {loadingWord}...
      </p>
    </div>
  );
}
