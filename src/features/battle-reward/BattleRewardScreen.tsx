import { IconCoins } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardView } from '@/entities/cards/CardView';
import type { CardDefinition } from '@/entities/cards/types';
import { effectColorPalette } from '@/shared/content/keywords';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function BattleRewardScreen() {
  const navigate = useNavigate();
  const { claimBattleReward, rewardChoices, rewardGoldAmount, skipBattleReward } = useGame();
  const [selectedCardId, setSelectedCardId] = useState<CardDefinition['id'] | null>(null);

  useEffect(() => {
    setSelectedCardId(null);
  }, [rewardChoices]);

  const selectedCard = rewardChoices.find((card) => card.id === selectedCardId) ?? null;

  if (rewardChoices.length === 0) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-battle-reward">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <AnimatedScreenTitle ta="center">Victory!</AnimatedScreenTitle>
          <p className="text-muted-foreground">No reward is currently waiting.</p>
          <Button onClick={() => navigate('/run/destination')}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-8" data-testid="screen-battle-reward">
      <div className="mx-auto flex h-full max-w-6xl flex-col justify-center gap-8">
        <AnimatedScreenTitle ta="center">Victory!</AnimatedScreenTitle>
        <div className="flex items-center justify-center gap-2">
          <IconCoins color={effectColorPalette.gold} size={18} stroke={2.2} />
          <span className="text-lg font-extrabold" style={{ color: effectColorPalette.gold }}>
            {rewardGoldAmount} Gold
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {rewardChoices.map((card) => (
            <Card data-testid={`reward-choice-${card.id}`} key={card.id} onClick={() => setSelectedCardId(card.id)} className="cursor-pointer p-5">
              <div className="flex flex-col items-center gap-4">
                <div className="w-[238px]">
                  <CardView card={card} />
                </div>
                <p className="font-semibold">{card.title}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <Button
            disabled={!selectedCardId}
            onClick={() => {
              if (!selectedCardId) {
                return;
              }

              claimBattleReward(selectedCardId);
              navigate('/run/destination');
            }}
            size="lg"
          >
            Continue
          </Button>
          <Button
            onClick={() => {
              skipBattleReward();
              navigate('/run/destination');
            }}
            size="lg"
            variant="outline"
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}