import { INITIAL_LOAD_MIN_DURATION_MS, LOADING_WORD_FADE_MS } from "@/lib/game-constants";
import { useSyncedLoadingWord } from "./use-synced-loading-word";

interface Props {
  progress: number;
}

export function StartupLoadingScreen({ progress }: Props) {
  const fill = Math.min(1, Math.max(0, progress));
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
      <h1
        className="alchemy-loading-logo-pulse relative font-sans text-4xl font-black tracking-[0.15em] uppercase"
        aria-label="Alchemy"
      >
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
        style={{ animationDuration: `${LOADING_WORD_FADE_MS}ms` }}
      >
        {loadingWord}...
      </p>
    </div>
  );
}
