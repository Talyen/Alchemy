import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BattleAutoplayToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={enabled ? "primary" : "outline"}
      size="icon"
      className={cn("h-10 w-10", !enabled && "text-muted-foreground")}
      onClick={onToggle}
      aria-label="Autoplay"
      aria-pressed={enabled}
      data-testid="autoplay-toggle"
    >
      <Repeat className="h-5 w-5" />
    </Button>
  );
}
