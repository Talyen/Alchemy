// Minimal startup-only loading bar for the initial main menu reveal.
// One-shot fill from empty — real asset loading happens in the background and
// the screen is dismissed once the minimum gate elapses.
import { useState } from "react";

const LOADING_WORDS = [
  "Forging",
  "Growing",
  "Brewing",
  "Simmering",
  "Tinkering",
  "Prestidigitating",
  "Discombobulating",
];

export function StartupLoadingScreen() {
  const [loadingWord] = useState(() => LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)] ?? "Loading");

  // Pixel sizes match index.html's pre-React loader so the handoff does not resize.
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="h-[4px] w-[192px] overflow-hidden rounded-full bg-border">
        <div className="alchemy-startup-bar h-full w-full rounded-full" />
      </div>
      <p className="alchemy-loading-fade text-[12px] font-medium tracking-[0.18em] text-foreground/40 uppercase">
        {loadingWord}...
      </p>
    </div>
  );
}
