import { useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import { cn, formatLargeAmount } from "@/lib/utils";

import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";
import { HomesteadResourceArtwork } from "@/features/alchemy/shared/ui/material-icons";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/portaled-tooltip";

export function BattleGoldCounter({ gold }: { gold: number }) {
  const [previousGold, setPreviousGold] = useState(gold);
  const [increaseToken, setIncreaseToken] = useState(0);
  if (gold !== previousGold) {
    setPreviousGold(gold);
    if (gold > previousGold) setIncreaseToken((token) => token + 1);
  }

  return (
    <div
      key={increaseToken}
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-amber-200 tabular-nums",
        increaseToken > 0 && "battle-gold-increase",
      )}
      aria-label={`Gold: ${gold}`}
      data-testid="battle-gold"
    >
      <HomesteadResourceArtwork resource="gold" size="md" alt="" />
      <span>{formatLargeAmount(gold)}</span>
    </div>
  );
}

export function BattleSkipCombatButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <>
      <ChromeIconButton
        ref={triggerRef}
        aria-label="Skip Combat"
        disabled={disabled}
        onClick={onSkip}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <SkipForward className="h-6 w-6" />
      </ChromeIconButton>
      <PortaledTooltip triggerRef={triggerRef} visible={!disabled && (hovered || focused)}>
        Skip Combat
      </PortaledTooltip>
    </>
  );
}
