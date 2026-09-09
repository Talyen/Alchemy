import { Layers } from "lucide-react";
import { ChromeIconButton } from "./chrome-icon-button";

export interface DeckInspectButtonProps {
  count: number;
  disabled: boolean;
  onOpen: () => void;
}

export function DeckInspectButton({ count, disabled, onOpen }: DeckInspectButtonProps) {
  const label = `View Deck · ${count} cards`;
  return (
    <ChromeIconButton
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
    </ChromeIconButton>
  );
}
