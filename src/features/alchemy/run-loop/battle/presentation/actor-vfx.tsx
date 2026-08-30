import type { ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArtPanel } from "@/features/alchemy/shared/ui/battle/actor-panel";
import { CombatTextRail } from "@/features/alchemy/shared/ui/battle/combat-text";
import { CompanionPanel } from "@/features/alchemy/shared/ui/battle/companion-panel";
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
  "shaking" | "impactCue" | "attackToken" | "castToken" | "shimmerActive" | "shimmerToken" | "onHoverShimmer"
> & {
  side: "player" | "enemy";
  shimmerId: string;
};

export function ShakingArtPanel({ side, shimmerId, ...props }: ShakingArtPanelProps) {
  const { shaking, impactCue, attackToken, castToken } = useBattlePresentationStore(
    useShallow((s) => ({
      shaking: side === "player" ? s.playerShaking : s.enemyShaking,
      impactCue: side === "player" ? s.playerImpactCue : s.enemyImpactCue,
      attackToken: side === "player" ? s.playerAttackToken : s.enemyAttackToken,
      castToken: side === "player" ? s.playerCastToken : s.enemyCastToken,
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
      impactCue={impactCue}
      attackToken={attackToken}
      castToken={castToken}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      onHoverShimmer={onHoverShimmer}
    />
  );
}

export function ShakingCompanionPanel(props: Omit<ComponentProps<typeof CompanionPanel>, "shaking">) {
  const shaking = useBattlePresentationStore((s) => s.companionShaking);
  return <CompanionPanel {...props} shaking={shaking} />;
}
