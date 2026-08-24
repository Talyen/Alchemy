// Shared heal chrome used by campfire rest.
import { Progress } from "@/components/ui/progress";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
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
    <div className="w-full rounded-shell-inner px-4 py-3 surface-muted">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-lg font-semibold", keywordDefinitions.health.colorClass)}>Health</p>
        <p className="hp-number-pop text-base font-medium text-muted-foreground">
          {displayHealth} / {maxHealth}
        </p>
      </div>
      <Progress
        value={(progressHealth / maxHealth) * 100}
        fillStyle={{ transition: "none" }}
        className="mt-2.5 h-3 bg-background/80 [&>div]:bg-destructive"
      />
    </div>
  );
}
