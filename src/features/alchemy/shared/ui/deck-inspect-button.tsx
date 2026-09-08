import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHoverVisible } from "./use-hover-visible";
import { PortaledTooltip } from "./portaled-tooltip";

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
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  const label = `View Deck · ${count} cards`;
  return (
    <>
      <Button
        ref={triggerRef}
        variant={compact ? "ghost" : "outline"}
        size="icon"
        className={cn("text-muted-foreground", compact ? "h-11 w-11" : "h-12 w-12")}
        aria-label={label}
        aria-disabled={disabled}
        aria-haspopup="dialog"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocusCapture}
        onBlur={onBlurCapture}
        onClick={(event) => {
          if (disabled) return;
          event.currentTarget.focus();
          onMouseLeave();
          onOpen();
        }}
      >
        <Layers className="h-6 w-6" />
      </Button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <p>{label}</p>
        {disabled ? <p>Available between actions on your turn.</p> : null}
      </PortaledTooltip>
    </>
  );
}
