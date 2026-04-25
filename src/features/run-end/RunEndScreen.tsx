import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { CardView } from '@/entities/cards/CardView';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function RunEndScreen() {
  const navigate = useNavigate();
  const { battleWins, currentCharacter, resetRun, result, roomsVisited, runEndUnlockedCards } = useGame();

  if (!result) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-run-end">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <AnimatedScreenTitle ta="center">End of Run</AnimatedScreenTitle>
          <p className="text-muted-foreground">There is no completed run to summarize yet.</p>
          <Button onClick={() => navigate('/')} variant="outline">Return to main menu</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-8" data-testid="screen-run-end">
      <div className="mx-auto flex h-full max-w-6xl flex-col justify-center gap-8">
        <AnimatedScreenTitle ta="center">End Run Rewards</AnimatedScreenTitle>
        <p className="mx-auto max-w-[680px] text-center text-sm text-muted-foreground">
          {currentCharacter ? `${currentCharacter.name} finished the run with ${battleWins} victories across ${roomsVisited} rooms.` : result.summary}
        </p>
        <p className="text-center text-lg font-semibold">
          {result.summary}
        </p>

        {runEndUnlockedCards.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {runEndUnlockedCards.map((card) => (
              <div className="flex flex-col items-center gap-4" key={card.id}>
                <div className="w-[220px]">
                  <CardView card={card} />
                </div>
                <p className="font-semibold">{card.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Reach at least 3 rooms in a run to unlock 3 new cards.
          </p>
        )}

        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={() => {
              resetRun();
              navigate('/run/new');
            }}
            size="lg"
          >
            Start another run
          </Button>
          <Button
            onClick={() => {
              resetRun();
              navigate('/');
            }}
            size="lg"
            variant="outline"
          >
            Return to main menu
          </Button>
        </div>
      </div>
    </div>
  );
}