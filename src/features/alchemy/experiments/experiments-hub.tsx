import { ArrowLeft, FlipHorizontal, Layers } from "lucide-react";
import { useState } from "react";

import { CardFlipExperiment } from "./card-flip-experiment";
import { DrawDiscardExperiment } from "./draw-discard-experiment";

type ExperimentsHubProps = {
  onBack: () => void;
};

export function ExperimentsHub({ onBack }: ExperimentsHubProps) {
  const [active, setActive] = useState<string | null>(null);

  if (active === "flip") return <CardFlipExperiment onBack={() => setActive(null)} />;
  if (active === "draw") return <DrawDiscardExperiment onBack={() => setActive(null)} />;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-6">
      <div className="flex w-full max-w-lg items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-base font-semibold text-foreground">Experiments</h2>
        <div className="w-16" />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => setActive("flip")}
            className="flex w-80 items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-5 text-left backdrop-blur-sm transition-colors hover:border-border/80 hover:bg-card/80"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FlipHorizontal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Card Flip</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                3D flip animation with spring physics + tilt surface
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActive("draw")}
            className="flex w-80 items-center gap-4 rounded-xl border border-border/50 bg-card/60 p-5 text-left backdrop-blur-sm transition-colors hover:border-border/80 hover:bg-card/80"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Draw / Discard</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Battle-style draw pile, hand, and discard pile with animated transfers
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
