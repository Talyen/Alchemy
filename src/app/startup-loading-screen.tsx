import { useEffect, useState } from "react";
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import {
  CONTENT_REFERENCE_VIEWPORT,
  STAGE_HEIGHT,
  INITIAL_LOAD_MIN_DURATION_MS,
  LOADING_WORD_FADE_MS,
  LOADING_WORD_INTERVAL_MS,
} from "@/lib/game-constants";
import { clamp01 } from "@/lib/math";
import { LOADING_WORDS } from "./loading-words";
import { StartupLoadingDecoration } from "./startup-loading-decoration";

function useSyncedLoadingWord() {
  // Sequential rotation starting with index 0 to match index.html phrase without snap.
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (shouldReduceMotion()) return;
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const splash = document.getElementById("startup-splash");
    if (splash) {
      splash.setAttribute("aria-valuenow", String(Math.round(fill * 100)));
    }
  }, [fill]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const phrase = document.getElementById("startup-splash-phrase");
    if (phrase) {
      phrase.textContent = `${loadingWord}...`;
    }
  }, [loadingWord]);

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
        <StartupLoadingDecoration />
        <span aria-hidden className="text-stone-700">
          Alchemy
        </span>
        <span
          aria-hidden
          className="alchemy-loading-logo-fill absolute inset-0 overflow-hidden"
          style={{ animationDuration: `${INITIAL_LOAD_MIN_DURATION_MS}ms` }}
        >
          <span
            className="alchemy-loading-logo-fill-text block w-full text-primary"
            style={{ animationDuration: `${INITIAL_LOAD_MIN_DURATION_MS}ms` }}
          >
            Alchemy
          </span>
        </span>
      </h1>
      <p
        key={wordIndex}
        className="alchemy-loading-word -mt-3 font-medium tracking-[0.18em] text-muted-foreground uppercase"
        // Inline duration wins over the .alchemy-loading-word shorthand; both
        // mirror LOADING_WORD_FADE_MS (parity asserted in lint-architecture-smoke).
        style={{
          animationDuration: `${LOADING_WORD_FADE_MS}ms`,
          fontSize: `calc(0.75 * var(--content-rem, 1rem) / ${CONTENT_REFERENCE_VIEWPORT.height / STAGE_HEIGHT})`,
        }}
      >
        {loadingWord}...
      </p>
    </div>
  );
}
