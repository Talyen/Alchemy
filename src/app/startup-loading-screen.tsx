import { LOADING_WORD_FADE_MS } from "@/lib/game-constants";
import { useSyncedLoadingWord } from "./use-synced-loading-word";

interface Props {
  progress: number;
}

const WORD = "Alchemy";

export function StartupLoadingScreen({ progress }: Props) {
  const fill = Math.min(1, Math.max(0, progress));
  const { wordIndex, loadingWord, litCount } = useSyncedLoadingWord();

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-background"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      aria-label="Loading Alchemy"
    >
      <h1 className="font-sans text-4xl font-black tracking-[0.15em] uppercase" aria-label="Alchemy">
        {WORD.split("").map((letter, i) => {
          const lit = i < litCount;
          return (
            <span
              key={i}
              aria-hidden
              className="inline-block"
              style={{
                color: lit ? "transparent" : "#44403c",
                background: lit ? "linear-gradient(180deg in oklch, #fde68a, #b45309)" : undefined,
                WebkitBackgroundClip: lit ? "text" : undefined,
                backgroundClip: lit ? "text" : undefined,
                textShadow: lit ? "0 0 22px hsl(42 100% 60% / 0.45)" : undefined,
                transform: lit ? "translateY(-2px)" : "translateY(0)",
                transition: "transform 300ms ease, color 300ms ease",
              }}
            >
              {letter}
            </span>
          );
        })}
      </h1>
      <p
        key={wordIndex}
        className="alchemy-loading-word text-[12px] font-medium tracking-[0.18em] uppercase"
        style={{ animationDuration: `${LOADING_WORD_FADE_MS}ms, 1100ms` }}
      >
        {loadingWord}...
      </p>
    </div>
  );
}
