import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';

export function DestinationScreen() {
  const navigate = useNavigate();
  const { destinationChoices, enterCampfire, resolveDestination } = useGame();

  if (destinationChoices.length === 0) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-destination">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <Button onClick={() => navigate('/battle')} variant="outline">
            Return to battle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-8" data-testid="screen-destination">
      <div className="flex h-full items-center justify-center">
        <div className="grid w-full max-w-[880px] gap-4 md:grid-cols-3">
          {destinationChoices.map((destination) => (
            <Button
              aria-label={destination.title}
              className="h-20 text-base font-semibold"
              key={destination.id}
              onClick={() => {
                if (destination.id === 'campfire') {
                  enterCampfire();
                  navigate('/run/campfire');
                  return;
                }

                resolveDestination(destination.id);

                if (destination.id === 'merchant-shop') {
                  navigate('/run/shop');
                  return;
                }

                if (destination.id === 'mystery') {
                  navigate('/run/mystery');
                  return;
                }

                navigate('/battle');
              }}
              style={{
                background: `${destination.accent}18`,
                border: `1px solid ${destination.accent}66`,
                color: destination.accent,
              }}
              variant="outline"
            >
              {destination.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}