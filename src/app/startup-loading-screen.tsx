// Minimal startup-only loading bar for the initial main menu reveal.
// Width follows smoothed real progress from the boot gate (art, fonts, save).
import { useState } from "react";
import { LOADING_WORDS } from "@/app/loading-words";

interface Props {
  progress: number;
}

export function StartupLoadingScreen({ progress }: Props) {
  const [loadingWord] = useState(() => LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)] ?? "Loading");
  const fill = Math.min(1, Math.max(0, progress));

  // Pixel sizes match index.html's pre-React loader so the handoff does not resize.
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="h-[4px] w-[192px] overflow-hidden rounded-full bg-border">
        <div className="alchemy-startup-bar h-full w-full rounded-full" style={{ transform: `scaleX(${fill})` }} />
      </div>
      <p className="alchemy-loading-fade text-[12px] font-medium tracking-[0.18em] text-foreground/40 uppercase">
        {loadingWord}...
      </p>
    </div>
  );
}
