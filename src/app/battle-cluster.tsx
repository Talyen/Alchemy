import { useRef, useState } from "react";
import { Repeat, SkipForward } from "lucide-react";
import { cn, formatLargeAmount } from "@/lib/utils";
import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";
import { cardHoverScaleClass } from "@/features/alchemy/shared/config";
import { HomesteadResourceArtwork } from "@/features/alchemy/shared/ui/material-icons";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
import { BattleBoonInspectButton } from "@/features/alchemy/run-loop/screens/battle-screen/boon-inspect";
import { DeckInspectButton, type DeckInspectButtonProps } from "@/features/alchemy/shared/ui/deck-inspect-button";
import { HamburgerTrigger } from "@/features/alchemy/shared/ui/navigation";
import { useBattleClusterState } from "@/features/alchemy/shared/stores/run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

function BattleGoldCounter({ gold }: { gold: number }) {
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
        "flex h-11 items-center gap-1.5 rounded-md px-2 text-xl font-semibold text-amber-200 tabular-nums",
        cardHoverScaleClass,
        increaseToken > 0 && "battle-gold-increase",
      )}
      aria-label={`Gold: ${gold}`}
      role="img"
      data-testid="battle-gold"
    >
      <HomesteadResourceArtwork resource="gold" size="md" alt="" />
      <span>{formatLargeAmount(gold)}</span>
    </div>
  );
}

function BattleAutoplayToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
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

function BattleSkipCombatButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
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

export interface BattleClusterProps {
  inert: boolean;
  deckInspection?: DeckInspectButtonProps | undefined;
  isAutoplayEnabled: boolean;
  toggleAutoplayEnabled: () => void;
  hasInspectBoons: boolean;
  boonInspectOpen: boolean;
  toggleBoonInspect: () => void;
  gameMenuOpen: boolean;
  onOpenGameMenu: (rect?: DOMRect) => void;
  onSkipCombat: () => void;
}

export function BattleCluster({
  inert,
  deckInspection,
  isAutoplayEnabled,
  toggleAutoplayEnabled,
  hasInspectBoons,
  boonInspectOpen,
  toggleBoonInspect,
  gameMenuOpen,
  onOpenGameMenu,
  onSkipCombat,
}: BattleClusterProps) {
  const { gold, hasWishOptions } = useBattleClusterState();
  return (
    <div inert={inert} className="absolute top-4 right-4 z-[80] flex items-center gap-2">
      <BattleGoldCounter gold={gold} />
      {deckInspection ? <DeckInspectButton {...deckInspection} /> : null}
      <BattleAutoplayToggle enabled={isAutoplayEnabled} onToggle={toggleAutoplayEnabled} />
      {hasInspectBoons ? <BattleBoonInspectButton open={boonInspectOpen} onToggle={toggleBoonInspect} /> : null}
      {isAlchemyDevBuild() ? (
        <BattleSkipCombatButton onSkip={onSkipCombat} disabled={gameMenuOpen || boonInspectOpen || hasWishOptions} />
      ) : null}
      <HamburgerTrigger onClick={onOpenGameMenu} label="Open game menu" active={gameMenuOpen} />
    </div>
  );
}
