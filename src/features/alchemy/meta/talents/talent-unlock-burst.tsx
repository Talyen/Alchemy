// Keyword-colored burst ring and sparks when a talent node is allocated.
import { useState, type CSSProperties } from "react";

import { TALENT_UNLOCK_ANIMATION_MS } from "@/lib/game-constants";

const SPARK_COUNT = 24;
const SPARK_DURATION_MIN_RATIO = 0.55;
const SPARK_DURATION_MAX_RATIO = 1.45;
const SPARK_MAX_DELAY_MS = 70;

interface TalentUnlockBurstProps {
  accentColor: string;
}

export function TalentUnlockBurst({ accentColor }: TalentUnlockBurstProps) {
  const [sparks] = useState(() =>
    Array.from({ length: SPARK_COUNT }, () => {
      const durationRatio =
        SPARK_DURATION_MIN_RATIO + Math.random() * (SPARK_DURATION_MAX_RATIO - SPARK_DURATION_MIN_RATIO);
      return {
        angle: Math.random() * 360,
        durationMs: Math.round(TALENT_UNLOCK_ANIMATION_MS * durationRatio),
        delayMs: Math.round(Math.random() * SPARK_MAX_DELAY_MS),
      };
    }),
  );

  return (
    <div
      className="talent-unlock-burst pointer-events-none absolute inset-0 z-40"
      style={{ "--burst-color": accentColor } as CSSProperties}
      aria-hidden
    >
      <div className="talent-unlock-ring absolute -inset-[15%] rounded-full" />
      {sparks.map((spark, i) => (
        <span
          key={i}
          className="talent-unlock-spark"
          style={
            {
              "--spark-angle": `${spark.angle}deg`,
              "--spark-duration": `${spark.durationMs}ms`,
              "--spark-delay": `${spark.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
