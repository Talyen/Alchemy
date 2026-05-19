import { useState, useCallback, type CSSProperties } from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";

import { cardBack, wolfCompanion } from "@/lib/game-data";
import { Button } from "@/components/ui/button";
import { cardSurfaceClass, staticCardTransform } from "@/features/alchemy/config";
import { clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent } from "@/features/alchemy/utils";
import { cn } from "@/lib/utils";

type CardFlipExperimentProps = {
  onBack: () => void;
};

const CARD_W = 210;
const CARD_H = CARD_W * (4 / 3);

export function CardFlipExperiment({ onBack }: CardFlipExperimentProps) {
  const [flipped, setFlipped] = useState(false);
  const [stiffness, setStiffness] = useState(180);
  const [damping, setDamping] = useState(18);
  const [perspective, setPerspective] = useState(900);

  const handleReset = useCallback(() => {
    setFlipped(false);
    setStiffness(180);
    setDamping(18);
    setPerspective(900);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
      <div className="flex w-full max-w-xl items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-base font-semibold text-foreground">CSS 3D Card Flip</h2>
        <div className="w-20" />
      </div>

      <div className="flex flex-1 items-center justify-center" style={{ perspective: `${perspective}px` }}>
        <div
          className="tilt-surface"
          style={
            {
              width: CARD_W,
              height: CARD_H,
              "--card-base-transform": staticCardTransform,
            } as CSSProperties
          }
          onMouseMove={setTiltFromEvent}
          onMouseLeave={clearTiltFromEvent}
          data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
          onClick={() => setFlipped((f) => !f)}
        >
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness, damping }}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
              <img
                src={wolfCompanion}
                alt="Card Front"
                className={cn("h-full w-full object-cover", cardSurfaceClass)}
              />
            </div>
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <img src={cardBack} alt="Card Back" className={cn("h-full w-full object-cover", cardSurfaceClass)} />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="w-full max-w-md rounded-xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm">
        <div className="mb-4 flex gap-2">
          <Button onClick={() => setFlipped((f) => !f)} className="flex-1">
            {flipped ? "Show Front" : "Show Back"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </div>

        <div className="space-y-3">
          <Slider label="Stiffness" value={stiffness} min={50} max={800} step={10} onChange={setStiffness} />
          <Slider label="Damping" value={damping} min={5} max={50} step={1} onChange={setDamping} />
          <Slider label="Perspective" value={perspective} min={300} max={3000} step={50} onChange={setPerspective} />
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-amber-500"
      />
      <span className="w-14 text-right text-sm font-mono text-foreground">{value}</span>
    </div>
  );
}
