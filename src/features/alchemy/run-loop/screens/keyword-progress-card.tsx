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
  totalXP,
  animate,
  size = "md",
}: {
  kw: KeywordId;
  totalXP: number;
  animate: boolean;
  size?: "md" | "lg";
}) {
  const { displayLevel, progressPercent } = getTalentKeywordProgress(totalXP, 0);
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
        value={animate ? progressPercent : 0}
        className={cn("h-1.5", large ? "mt-2.5" : "mt-2")}
        fillStyle={{
          transition: animate ? "width 1000ms ease-out" : "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
    </div>
  );
}
