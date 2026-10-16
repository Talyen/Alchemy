import { useGameTranslation } from "@/components/use-game-translation";

import { Layers } from "lucide-react";
import { ChromeIconButton } from "./chrome-icon-button";

export interface DeckInspectButtonProps {
  count: number;
  disabled: boolean;
  onOpen: () => void;
}

export function DeckInspectButton({ count, disabled, onOpen }: DeckInspectButtonProps) {
  const i18n = useGameTranslation();
  const label = i18n.text("deck.inspect", "View Deck · {{count}} cards", { count: count });
  return (
    <ChromeIconButton
      aria-label={i18n.displayText(label)}
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
