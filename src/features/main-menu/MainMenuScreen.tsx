import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { primaryLogo } from '@/shared/assets/registry';

export function MainMenuScreen() {
  const navigate = useNavigate();
  const { battle, currentCharacter, result } = useGame();
  const hasActiveRun = Boolean(currentCharacter && battle && !result);

  return (
    <div className="relative h-full" data-testid="screen-main-menu">
      <div className="relative flex h-full flex-col items-center justify-center gap-10 px-6">
        <img alt={primaryLogo.title} className="max-h-[44vh] max-w-[min(58vw,720px)] object-contain" src={primaryLogo.path} />

        <div className="flex min-w-[320px] flex-col gap-4">
          <Button className="w-full" onClick={() => navigate(hasActiveRun ? '/battle' : '/run/new')} size="lg">
            {hasActiveRun ? 'Resume Run' : 'Play'}
          </Button>
          <Button className="w-full" onClick={() => navigate('/collection')} size="lg">
            Collection
          </Button>
          <Button className="w-full" onClick={() => navigate('/talents')} size="lg">
            Talents
          </Button>
          <Button className="w-full" onClick={() => navigate('/options')} size="lg">
            Options
          </Button>
        </div>
      </div>
    </div>
  );
}
