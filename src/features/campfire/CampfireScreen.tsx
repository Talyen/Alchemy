import { IconCampfire } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function CampfireScreen() {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const { player, restAtCampfire } = useGame();
  const [isResting, setIsResting] = useState(false);
  const [displayHealth, setDisplayHealth] = useState(0);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!player || isResting) {
      return;
    }

    setDisplayHealth(player.health);
  }, [isResting, player]);

  if (!player) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-campfire">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <AnimatedScreenTitle ta="center">Campfire</AnimatedScreenTitle>
          <p className="text-muted-foreground">No active run is available.</p>
          <Button onClick={() => navigate('/')} variant="outline">Return to Main Menu</Button>
        </div>
      </div>
    );
  }

  const restoreAmount = Math.max(1, Math.round(player.maxHealth * 0.3));
  const targetHealth = Math.min(player.maxHealth, player.health + restoreAmount);
  const shownHealth = displayHealth || player.health;
  const shownHealthPercent = Math.max(0, Math.min(100, (shownHealth / player.maxHealth) * 100));

  return (
    <div className="h-full px-6 py-8" data-testid="screen-campfire">
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-8">
        <Card className="w-full p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-orange-400/30 bg-orange-400/12 text-orange-300">
            <IconCampfire size={44} stroke={1.9} />
            </div>
            <AnimatedScreenTitle ta="center">Campfire</AnimatedScreenTitle>
            <p className="max-w-[520px] text-sm text-muted-foreground">
              Rest to recover 30% of your max health. You will heal from {player.health} to {targetHealth} HP.
            </p>

            <div className="w-full max-w-xl space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>Health</span>
                <span>
                  {Math.round(shownHealth)} / {player.maxHealth}
                </span>
              </div>
              <div className="h-5 overflow-hidden rounded-full border border-[#ff7076]/45 bg-[rgba(52,11,15,0.96)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#c72a33_0%,#ff6b57_100%)] transition-[width] duration-150"
                  style={{ width: `${shownHealthPercent}%` }}
                />
              </div>
            </div>

            <Button
              data-testid="campfire-restore-button"
              disabled={isResting}
              onClick={() => {
                if (isResting) {
                  return;
                }

                setIsResting(true);

                const animationStart = performance.now();
                const animationDuration = 950;

                const tick = (now: number) => {
                  const progress = Math.min((now - animationStart) / animationDuration, 1);
                  const eased = 1 - (1 - progress) * (1 - progress);
                  const nextHealth = player.health + (targetHealth - player.health) * eased;

                  setDisplayHealth(nextHealth);

                  if (progress < 1) {
                    frameRef.current = requestAnimationFrame(tick);
                    return;
                  }

                  restAtCampfire();
                  timeoutRef.current = setTimeout(() => {
                    navigate('/run/destination');
                  }, 320);
                };

                frameRef.current = requestAnimationFrame(tick);
              }}
              size="lg"
            >
              Rest
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}