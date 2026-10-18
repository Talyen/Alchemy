import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import { Progress } from "@/components/ui/progress";
import { cn, formatLargeAmount } from "@/lib/utils";
import {
  getTalentKeywordProgress,
  keywordDefinitions,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { keywordIcons } from "@/features/alchemy/shared/config";

export function KeywordProgressCard({
  kw,
  totalXP,
  gainedXP,
  animate,
  size = "md",
}: {
  kw: KeywordId;
  totalXP: number;
  gainedXP: number;
  animate: boolean;
  size?: "md" | "lg";
}) {
  const i18n = useGameTranslation();
  const { displayLevel, progressPercent, xpForNext, xpRemaining } = getTalentKeywordProgress(totalXP, 0);
  const Icon = keywordIcons[kw];
  const def = keywordDefinitions[kw];
  const large = size === "lg";

  return (
    <div className={cn("rounded-shell-compact border border-border/70 text-left surface-muted", large ? "p-4" : "p-3")}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn("flex items-center", large ? "gap-2" : "gap-1.5")}>
          {Icon ? <Icon className={cn(large ? "h-6 w-6" : "h-5 w-5", def?.colorClass)} /> : null}
          <span className={cn(large ? "text-lg" : "text-base", "font-semibold", def?.colorClass)}>
            {i18n.displayText(def?.label ?? kw)}
          </span>
        </div>
        <span className={cn(large ? "text-lg" : "text-base", "font-semibold", def?.colorClass)}>
          <GameMessage
            id="ui.keyword-progress-card.s1"
            defaultValue="Lv<part0/>"
            parts={{ part0: i18n.displayText(displayLevel) }}
          />
        </span>
      </div>
      <Progress
        aria-label={i18n.text("ui.keyword-progress-card.2", "{{value0}} level {{value1}} progress", {
          value0: i18n.displayText(def?.label ?? kw),
          value1: i18n.displayText(displayLevel),
        })}
        size="sm"
        value={animate ? progressPercent : 0}
        className={cn("h-1.5", large ? "mt-2.5" : "mt-2")}
        fillStyle={{
          transition: animate ? "width 1000ms ease-out" : "none",
          backgroundColor: def?.shineColors?.[0] ?? undefined,
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-sm tabular-nums">
        <span className={cn("font-semibold", def?.colorClass)}>+{formatLargeAmount(gainedXP, i18n.locale)}</span>
        <span className="text-muted-foreground">
          {formatLargeAmount(xpForNext - xpRemaining, i18n.locale)}/{formatLargeAmount(xpForNext, i18n.locale)}
        </span>
      </div>
    </div>
  );
}
