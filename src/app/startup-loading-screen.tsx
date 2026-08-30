import { useCallback, useEffect, useState } from "react";
import { LOADING_WORDS } from "@/app/loading-words";
import { LOADING_WORD_FADE_MS, LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

interface Props {
  progress: number;
}

export function StartupLoadingScreen({ progress }: Props) {
  const getNextLoadingWordIndex = useCallback((previousIndex: number) => {
    const wordCount = LOADING_WORDS.length as number;
    if (wordCount === 2) return previousIndex === 0 ? 1 : 0;
    const offset = 1 + Math.floor(Math.random() * (wordCount - 1));
    return (previousIndex + offset) % wordCount;
  }, []);
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * LOADING_WORDS.length));
  const fill = Math.min(1, Math.max(0, progress));
  const loadingWord = LOADING_WORDS[wordIndex] ?? "Loading";

  useEffect(() => {
    if (LOADING_WORDS.length <= 1) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setWordIndex(getNextLoadingWordIndex);
    }, LOADING_WORD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [getNextLoadingWordIndex]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="h-[4px] w-[192px] overflow-hidden rounded-full bg-border">
        <div className="alchemy-startup-bar h-full w-full rounded-full" style={{ transform: `scaleX(${fill})` }} />
      </div>
      <p
        key={wordIndex}
        className="alchemy-loading-word text-[12px] font-medium tracking-[0.18em] text-foreground/40 uppercase"
        style={{ animationDuration: `${LOADING_WORD_FADE_MS}ms` }}
      >
        {loadingWord}...
      </p>
    </div>
  );
}
