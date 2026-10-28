import { type ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArtPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/actor-panel";
import { CompanionPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/companion-panel";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { useStore } from "zustand";
import type { BattlePresentationStore } from "../battle-presentation-store";

type ShakingArtPanelProps = Omit<
  ComponentProps<typeof ArtPanel>,
  "impactCue" | "attackToken" | "castToken" | "dodgeToken" | "shimmerActive" | "shimmerToken" | "onHoverShimmer"
> & {
  presentation: BattlePresentationStore;
  side: "player" | "enemy";
  shimmerId: string;
};

export function ShakingArtPanel({ presentation, side, shimmerId, ...props }: ShakingArtPanelProps) {
  const feedback = useStore(
    presentation,
    useShallow((s) => ({
      impactCue: side === "player" ? s.playerImpactCue : s.enemyImpactCue,
      attackToken: side === "player" ? s.playerAttackToken : s.enemyAttackToken,
      castToken: side === "player" ? s.playerCastToken : s.enemyCastToken,
      dodgeToken: side === "player" ? s.playerDodgeToken : s.enemyDodgeToken,
    })),
  );
  const shimmer = useUiStore(
    useShallow((s) => ({
      shimmerActive: s.shimmerState?.cardId === shimmerId,
      shimmerToken: s.shimmerState?.cardId === shimmerId ? s.shimmerState.token : undefined,
      onHoverShimmer: s.maybeTriggerShimmer,
    })),
  );
  return <ArtPanel {...props} side={side} shimmerId={shimmerId} {...feedback} {...shimmer} />;
}

export function ShakingCompanionPanel({
  presentation,
  ...props
}: Omit<ComponentProps<typeof CompanionPanel>, "shaking"> & { presentation: BattlePresentationStore }) {
  const shaking = useStore(presentation, (s) => s.companionShaking);
  return <CompanionPanel {...props} shaking={shaking} />;
}
