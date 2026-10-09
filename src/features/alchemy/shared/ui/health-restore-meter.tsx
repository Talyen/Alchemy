import { Progress } from "@/components/ui/progress";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { battleCardWidthClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

export function HealthRestoreMeter({
  displayHealth,
  maxHealth,
  progressHealth,
}: {
  displayHealth: number;
  maxHealth: number;
  progressHealth: number;
}) {
  return (
    <div className={cn("max-w-full rounded-shell-inner px-5 py-3.5 surface-muted", battleCardWidthClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-lg font-semibold", keywordDefinitions.health.colorClass)}>Health</p>
        <p className="text-base font-medium text-muted-foreground tabular-nums">
          {displayHealth} / {maxHealth}
        </p>
      </div>
      <Progress
        aria-label="Health"
        value={(progressHealth / maxHealth) * 100}
        fillStyle={{ transition: "none" }}
        className="mt-1.5 h-3 bg-background/80 [&>div]:bg-destructive"
      />
    </div>
  );
}
