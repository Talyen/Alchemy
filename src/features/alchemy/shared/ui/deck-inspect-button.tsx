import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { Layers } from "lucide-react";
import { ChromeIconButton } from "./chrome-icon-button";

export interface DeckInspectButtonProps {
  count: number;
  disabled: boolean;
  onOpen: () => void;
}

export function DeckInspectButton({ count, disabled, onOpen }: DeckInspectButtonProps) {
  useGameTranslation();
  const label = gameText("deck.inspect", "View Deck · {{count}} cards", { count: count });
  return (
    <ChromeIconButton
      aria-label={displayText(label)}
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
