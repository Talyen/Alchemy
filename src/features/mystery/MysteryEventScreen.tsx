import { Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { effectColorPalette } from '@/shared/content/keywords';

export function MysteryEventScreen() {
  const navigate = useNavigate();
  const { continueMysteryEvent, mysteryEvent, openMysteryEvent } = useGame();

  if (!mysteryEvent) {
    return (
      <div className="h-full px-6 py-8" data-testid="screen-mystery-event">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">No mystery event is active.</p>
          <Button onClick={() => navigate('/run/destination')} variant="outline">
            Return to destination selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full px-6 py-8" data-testid="screen-mystery-event">
      <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-8">
        <Card className="w-full max-w-2xl p-8">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(245,196,102,0.12),transparent_36%),linear-gradient(180deg,rgba(29,24,16,0.92)_0%,rgba(15,11,8,0.98)_100%)]">
              <div className="absolute inset-x-1/2 top-[14%] h-24 w-36 -translate-x-1/2 rounded-[1.6rem_1.6rem_0.9rem_0.9rem] border border-[#b8833d] bg-[linear-gradient(180deg,#8e5a22_0%,#6d4119_100%)] shadow-[0_0_0_1px_rgba(255,214,149,0.15)_inset]" />
              <div className="absolute inset-x-1/2 top-[42%] h-28 w-44 -translate-x-1/2 rounded-[0.9rem_0.9rem_1.4rem_1.4rem] border border-[#a36c2f] bg-[linear-gradient(180deg,#6c4317_0%,#4b2d11_100%)] shadow-[0_16px_24px_rgba(0,0,0,0.28)]" />
              <div className="absolute inset-x-1/2 top-[46%] h-8 w-7 -translate-x-1/2 rounded-full border border-[#f5d27e] bg-[linear-gradient(180deg,#f3c85f_0%,#d9a53e_100%)]" />
              <div className="absolute bottom-8 text-xs font-semibold uppercase tracking-[0.28em] text-[rgba(245,227,191,0.68)]">
                Placeholder art
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight">{mysteryEvent.title}</h1>
              {mysteryEvent.status === 'opened' ? (
                <div className="flex items-center justify-center gap-2 text-lg font-semibold" style={{ color: effectColorPalette.gold }}>
                  <Coins size={18} />
                  <span>{mysteryEvent.goldFound} Gold found</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">An old chest sits in silence. There is only one way to find out what is inside.</p>
              )}
            </div>

            {mysteryEvent.status === 'opened' ? (
              <Button
                onClick={() => {
                  continueMysteryEvent();
                  navigate('/run/destination');
                }}
                size="lg"
              >
                Continue
              </Button>
            ) : (
              <Button onClick={openMysteryEvent} size="lg">
                Open
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}