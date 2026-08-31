import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getTalentKeywordProgress,
  keywordDefinitions,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { keywordIcons } from "@/features/alchemy/shared/config";

const XP_REVEAL_DURATION_MS = 1000;

export function KeywordProgressCard({
  kw,
  runXP,
  totalXP,
  animate,
  size = "md",
}: {
  kw: KeywordId;
  runXP: number;
  totalXP: number;
  animate: boolean;
  size?: "md" | "lg";
}) {
  const startXP = Math.max(totalXP - runXP, 0);
  const endXP = totalXP;
  const animationKey = `${animate}:${startXP}:${endXP}`;
  const [animationState, setAnimationState] = useState<{ key: string; xp: number } | null>(null);

  useEffect(() => {
    if (!animate || startXP === endXP) {
      return;
    }

    let startTime: number | null = null;
    let rafId: number;

    const step = (timestamp: number) => {
      startTime ??= timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / XP_REVEAL_DURATION_MS);
      const current = startXP + (endXP - startXP) * progress;
      setAnimationState({ key: animationKey, xp: current });
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [animate, startXP, endXP, animationKey]);

  const displayXP = animate && animationState?.key === animationKey ? animationState.xp : startXP;
  const { displayLevel, progressPercent, xpForNext, xpRemaining } = getTalentKeywordProgress(displayXP, 0);
  const progressCurrent = Math.max(0, Math.floor(xpForNext - xpRemaining));
  const Icon = keywordIcons[kw];
  const def = keywordDefinitions[kw];
  const large = size === "lg";

  return (
    <div className={cn("rounded-shell-compact border border-border/70 text-left surface-muted", large ? "p-4" : "p-3")}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn("flex items-center", large ? "gap-2" : "gap-1.5")}>
          {Icon ? <Icon className={cn(large ? "h-6 w-6" : "h-5 w-5", def?.colorClass)} /> : null}
          <span className={cn(large ? "text-lg" : "text-base", "font-semibold", def?.colorClass)}>
            {def?.label ?? kw}
          </span>
        </div>
        <span className={cn(large ? "text-lg" : "text-base", "font-semibold", def?.colorClass)}>Lv{displayLevel}</span>
      </div>
      <Progress
        size="sm"
        value={progressPercent}
        className={cn("h-1.5", large ? "mt-2.5" : "mt-2")}
        fillStyle={{
          transition: "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
      <div
        className={cn(
          "flex items-center justify-between font-medium text-muted-foreground tabular-nums",
          large ? "mt-1.5 text-xs" : "mt-1.5 text-[11px]",
        )}
      >
        <span>+{runXP} XP</span>
        <span>
          {progressCurrent}/{xpForNext}
        </span>
      </div>
    </div>
  );
}
