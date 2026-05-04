// Victory reward screen — pick a card to add to the deck or skip.
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";

import { BattleCardButton } from "../ui/card-ui";
import { getHoverId } from "../utils";

export function RewardsScreen({
  rewardChoices,
  rewardGold,
  hoveredCardId,
  onHoverChange,
  shimmerState,
  onHoverShimmer,
  selectedRewardId,
  onSelectReward,
  onAddCard,
  onSkip,
}: {
  rewardChoices: BattleCard[];
  rewardGold: number;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
  selectedRewardId: string | null;
  onSelectReward: (cardId: string) => void;
  onAddCard: () => void;
  onSkip: () => void;
}) {
  const selectedRewardCard = rewardChoices.find((card) => card.id === selectedRewardId) ?? null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 className="text-4xl font-semibold text-foreground">Victory!</h1>
        <p className="mt-3 text-base text-muted-foreground">Choose a Card to add to your Deck</p>

        <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
          {rewardChoices.map((card) => {
            const hoverId = getHoverId("reward", card.id);

            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={hoveredCardId === hoverId}
                onHoverStart={() => {
                  onHoverChange(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
                onClick={() => onSelectReward(card.id)}
                ariaLabel={`Select ${card.title}`}
                tiltStrength={15}
                shimmerActive={shimmerState?.cardId === hoverId}
                shimmerToken={shimmerState?.token}
                className="w-[clamp(189px,18.7vh,286px)]"
                wrapperClassName="relative flex justify-center"
                selected={selectedRewardId === card.id}
              />
            );
          })}
        </div>

        <div className="mt-8 text-center text-lg font-medium text-yellow-300">
          <span className="inline-flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Found {rewardGold} Gold
          </span>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="min-w-40" disabled={!selectedRewardCard} onClick={onAddCard}>
            Add Card
          </Button>
          <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
