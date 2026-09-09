import { Repeat } from "lucide-react";
import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";

export function BattleAutoplayToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <ChromeIconButton
      variant={enabled ? "primary" : "ghost"}
      onClick={onToggle}
      aria-label="Autoplay"
      aria-pressed={enabled}
      data-testid="autoplay-toggle"
    >
      <Repeat className="h-6 w-6" />
    </ChromeIconButton>
  );
}
