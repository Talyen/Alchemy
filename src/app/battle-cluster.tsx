import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import {
  BattleEndTurnButton,
  type BattleEndTurnButtonProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/end-turn-button";
import { useRef, useState } from "react";
import { Repeat, SkipForward } from "lucide-react";
import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";
import { GoldDisplay } from "@/features/alchemy/shared/ui/display-elements";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
import { BattleBoonInspectButton } from "@/features/alchemy/run-loop/screens/battle-screen/boon-inspect";
import { DeckInspectButton, type DeckInspectButtonProps } from "@/features/alchemy/shared/ui/deck-inspect-button";
import { HamburgerTrigger } from "@/features/alchemy/shared/ui/navigation";
import { useBattleClusterState } from "@/features/alchemy/shared/stores/use-run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

function BattleAutoplayToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  useGameTranslation();
  return (
    <ChromeIconButton
      variant={enabled ? "primary" : "ghost"}
      onClick={onToggle}
      aria-label={gameText("ui.battle-cluster.1", "Autoplay")}
      aria-pressed={enabled}
      data-testid="autoplay-toggle"
    >
      <Repeat className="h-6 w-6" />
    </ChromeIconButton>
  );
}

function BattleSkipCombatButton({ onSkip, disabled }: { onSkip: () => void; disabled: boolean }) {
  useGameTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <>
      <ChromeIconButton
        ref={triggerRef}
        aria-label={gameText("ui.battle-cluster.2", "Skip Combat")}
        disabled={disabled}
        onClick={onSkip}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <SkipForward className="h-6 w-6" />
      </ChromeIconButton>
      <PortaledTooltip
        triggerRef={triggerRef}
        visible={!disabled && (hovered || focused)}
        placement="below"
        allowFlip={false}
        horizontalInset={8}
      >
        {gameText("ui.battle-cluster.3", "Skip Combat")}
      </PortaledTooltip>
    </>
  );
}

export interface BattleClusterProps {
  endTurn: Omit<BattleEndTurnButtonProps, "battleState" | "hasActiveBattle" | "blocked">;
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
  endTurn,
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
  useGameTranslation();
  const { gold, hasWishOptions, battleState, hasActiveBattle } = useBattleClusterState();
  return (
    <div inert={inert} className="absolute top-4 right-4 z-[80] flex items-center gap-2">
      <GoldDisplay gold={gold} testId="battle-gold" />
      {deckInspection ? <DeckInspectButton {...deckInspection} /> : null}
      <BattleAutoplayToggle enabled={isAutoplayEnabled} onToggle={toggleAutoplayEnabled} />
      {hasInspectBoons ? <BattleBoonInspectButton open={boonInspectOpen} onToggle={toggleBoonInspect} /> : null}
      <BattleEndTurnButton
        {...endTurn}
        battleState={battleState}
        hasActiveBattle={hasActiveBattle}
        blocked={inert || gameMenuOpen || boonInspectOpen}
      />
      {isAlchemyDevBuild() ? (
        <BattleSkipCombatButton onSkip={onSkipCombat} disabled={gameMenuOpen || boonInspectOpen || hasWishOptions} />
      ) : null}
      <HamburgerTrigger
        onClick={onOpenGameMenu}
        label={gameText("ui.battle-cluster.4", "Open game menu")}
        active={gameMenuOpen}
      />
    </div>
  );
}
