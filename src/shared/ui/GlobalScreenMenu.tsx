import {
  IconBook2,
  IconBolt,
  IconDoorExit,
  IconFlask2,
  IconListDetails,
  IconMenu2,
  IconSettings,
  IconSmartHome,
  IconStars,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '@/app/providers/GameProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MenuAction = {
  danger?: boolean;
  hidden?: boolean;
  icon: typeof IconSmartHome;
  label: string;
  onSelect: () => void;
};

export function GlobalScreenMenu() {
  const navigate = useNavigate();
  const { battle, battleWins, currentCharacter, endRunEarly, result, skipCombatDevMode } = useGame();
  const hasRunState = Boolean(currentCharacter || battle || result);
  const canSkipCombat = Boolean(import.meta.env.DEV && battle && battle.status === 'player-turn' && !result);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const actions: MenuAction[] = [
    { icon: IconSmartHome, label: 'Main Menu', onSelect: () => navigate('/') },
    { icon: IconSettings, label: 'Options', onSelect: () => navigate('/options') },
    { icon: IconBook2, label: 'Collection', onSelect: () => navigate('/collection') },
    { icon: IconStars, label: 'Talents', onSelect: () => navigate('/talents') },
    { icon: IconListDetails, label: 'Bestiary', onSelect: () => navigate('/bestiary') },
    { icon: IconFlask2, label: 'Test Lab', onSelect: () => navigate('/test-lab') },
    {
      hidden: !canSkipCombat,
      icon: IconBolt,
      label: 'Skip Combat (Dev Mode)',
      onSelect: () => {
        skipCombatDevMode();
        navigate(battleWins + 1 >= 3 ? '/run/end' : '/battle/reward');
      },
    },
    {
      danger: true,
      hidden: !hasRunState,
      icon: IconDoorExit,
      label: 'End Run',
      onSelect: () => {
        endRunEarly();
        navigate('/run/end');
      },
    },
  ];

  return (
    <div className="absolute right-6 top-6 z-40" ref={menuRef}>
      <Button aria-expanded={open} aria-label="Screen menu" className="h-12 w-12 rounded-full p-0" onClick={() => setOpen((current) => !current)} size="icon">
        <IconMenu2 size={22} />
      </Button>

      {open ? (
        <Card className="absolute right-0 mt-3 w-60 p-2" role="menu">
          <div className="flex flex-col gap-1">
            {actions.map((action) => {
              if (action.hidden) {
                return null;
              }

              const Icon = action.icon;

              return (
                <button
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-white/5',
                    action.danger && 'text-[#ff8d86] hover:bg-[rgba(255,71,87,0.08)]',
                  )}
                  key={action.label}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}