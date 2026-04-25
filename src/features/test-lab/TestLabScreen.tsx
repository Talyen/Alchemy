import { IconFlask2 } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { AnimatedScreenTitle } from '@/shared/ui/AnimatedScreenTitle';

export function TestLabScreen() {
  const navigate = useNavigate();

  return (
    <div className="h-full px-6 py-8" data-testid="screen-test-lab">
      <div className="flex h-full flex-col items-center justify-center gap-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/12 text-sky-300">
          <IconFlask2 size={40} />
        </div>
        <AnimatedScreenTitle ta="center">Test Lab</AnimatedScreenTitle>
        <p className="max-w-[420px] text-center text-muted-foreground">
          Reserved for future experiments and debug encounters.
        </p>
        <Button onClick={() => navigate('/')} variant="outline">
          Return to Main Menu
        </Button>
      </div>
    </div>
  );
}