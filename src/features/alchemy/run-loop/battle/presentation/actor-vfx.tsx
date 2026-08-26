// Actor VFX leaves: combat text, shake, hurt flash, attacker lunge. Isolated so BattleActors layout does not
// re-render on every presentation tick.
import type { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArtPanel, CompanionPanel, CombatTextRail } from "@/features/alchemy/shared/ui/battle-ui";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattlePresentationStore } from "../battle-presentation-store";

export function CombatTextRailSide({ side }: { side: "player" | "enemy" }) {
  const entries = useBattlePresentationStore(
    useShallow((s) => s.floatingCombatTexts.filter((text) => text.target === side)),
  );
  return <CombatTextRail entries={entries} />;
}

type ShakingArtPanelProps = Omit<
  ComponentProps<typeof ArtPanel>,
  "shaking" | "hurtFlashToken" | "attackToken" | "shimmerActive" | "shimmerToken" | "onHoverShimmer"
> & {
  side: "player" | "enemy";
  shimmerId: string;
};

export function ShakingArtPanel({ side, shimmerId, ...props }: ShakingArtPanelProps) {
  const { shaking, hurtFlashToken, attackToken } = useBattlePresentationStore(
    useShallow((s) => ({
      shaking: side === "player" ? s.playerShaking : s.enemyShaking,
      hurtFlashToken: side === "player" ? s.playerHurtFlashToken : s.enemyHurtFlashToken,
      attackToken: side === "player" ? s.playerAttackToken : s.enemyAttackToken,
    })),
  );
  const { shimmerActive, shimmerToken, onHoverShimmer } = useUiStore(
    useShallow((s) => ({
      shimmerActive: s.shimmerState?.cardId === shimmerId,
      shimmerToken: s.shimmerState?.cardId === shimmerId ? s.shimmerState.token : undefined,
      onHoverShimmer: s.maybeTriggerShimmer,
    })),
  );
  return (
    <ArtPanel
      {...props}
      side={side}
      shimmerId={shimmerId}
      shaking={shaking}
      hurtFlashToken={hurtFlashToken}
      attackToken={attackToken}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      onHoverShimmer={onHoverShimmer}
    />
  );
}

export function ShakingCompanionPanel(props: Omit<ComponentProps<typeof CompanionPanel>, "shaking" | "attackToken">) {
  const { shaking, attackToken } = useBattlePresentationStore(
    useShallow((s) => ({
      shaking: s.companionShaking,
      attackToken: s.companionAttackToken,
    })),
  );
  return <CompanionPanel {...props} shaking={shaking} attackToken={attackToken} />;
}
