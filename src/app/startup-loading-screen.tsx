// Minimal startup-only loading bar for the initial main menu reveal.
// Uses a looping indeterminate fill animation — real asset loading happens in
// the background and the screen is dismissed once everything is decoded.
// Syncs animation-delay to performance.now() so that StrictMode's
// unmount/remount cycle doesn't restart the bar from zero.
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
const loadingWord = LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)];
const CYCLE_MS = 1200;

export function StartupLoadingScreen() {
  const [animDelay] = useState(() => `${-(performance.now() % CYCLE_MS)}ms`);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background">
      <div className="h-1 w-48 overflow-hidden rounded-full bg-border">
        <div className="alchemy-startup-bar h-full w-full rounded-full" style={{ animationDelay: animDelay }} />
      </div>
      <p className="alchemy-loading-fade text-xs font-medium tracking-[0.18em] text-muted-foreground/60 uppercase">
        {loadingWord}...
      </p>
    </div>
  );
}
