// Keyword talent XP progress card shown on run victory and defeat screens.
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getTalentKeywordProgress,
  keywordDefinitions,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { keywordIcons } from "@/features/alchemy/shared/config";

export function KeywordProgressCard({
  kw,
  runXP,
  totalXP,
  animate,
}: {
  kw: KeywordId;
  runXP: number;
  totalXP: number;
  animate: boolean;
}) {
  const { progressPercent, xpForNext, xpRemaining } = getTalentKeywordProgress(totalXP, 0);
  const Icon = keywordIcons[kw];
  const def = keywordDefinitions[kw];

  return (
    <div className="surface-muted rounded-shell-compact border border-border/70 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className={cn("h-3.5 w-3.5", def?.colorClass)} /> : null}
          <span className={cn("text-xs font-semibold", def?.colorClass)}>{def?.label ?? kw}</span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">+{runXP}</span>
      </div>
      <Progress
        size="sm"
        value={animate ? progressPercent : 0}
        className="mt-2"
        fillStyle={{
          transition: animate ? "width 1000ms ease-out" : "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
      <p className="mt-1 text-right text-xs font-semibold text-muted-foreground">
        {xpForNext - xpRemaining}/{xpForNext}
      </p>
    </div>
  );
}
