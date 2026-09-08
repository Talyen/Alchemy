import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DeckInspectButtonProps {
  count: number;
  disabled: boolean;
  onOpen: () => void;
}

export function DeckInspectButton({
  count,
  disabled,
  onOpen,
  compact = false,
}: DeckInspectButtonProps & { compact?: boolean }) {
  const label = `View Deck · ${count} cards`;
  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="icon"
      className={cn("text-muted-foreground", compact ? "h-11 w-11" : "h-12 w-12")}
      aria-label={label}
      aria-disabled={disabled}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (disabled) return;
        event.currentTarget.focus();
        onOpen();
      }}
    >
      <Layers className="h-6 w-6" />
    </Button>
  );
}
