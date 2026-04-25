import { AnimatePresence, motion, useAnimationControls, useReducedMotion, useSpring } from 'motion/react';
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CombatantStatusCard, type CombatantStatusIcon } from '@/features/battle/CombatantStatusCard';

export type FloatingCombatText = {
  color: string;
  id: string;
  label: string;
};

type CombatantPanelProps = {
  attackPulse?: number;
  artPath?: string;
  currentHealth: number;
  floatingTextSide?: 'left' | 'right';
  floatingTexts?: FloatingCombatText[];
  frameHeight: string;
  frameWidth: string;
  highlightColor?: string | null;
  maxHealth: number;
  name: string;
  side?: 'enemy' | 'player';
  statusIcons?: CombatantStatusIcon[];
};

const artSpring = {
  damping: 28,
  mass: 0.56,
  stiffness: 250,
} as const;

const ART_TILT_X = 6;
const ART_TILT_Y = 8;

function withAlpha(color: string, alpha: string) {
  return color.startsWith('#') && color.length === 7 ? `${color}${alpha}` : color;
}

export function CombatantPanel({
  attackPulse = 0,
  artPath,
  currentHealth,
  floatingTextSide = 'right',
  floatingTexts = [],
  frameHeight,
  frameWidth,
  highlightColor = null,
  maxHealth,
  name,
  side = 'player',
  statusIcons = [],
}: CombatantPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const attackControls = useAnimationControls();
  const rotateX = useSpring(0, artSpring);
  const rotateY = useSpring(0, artSpring);
  const visibleStatuses = statusIcons.filter((entry) => entry.value > 0);
  const combatantId = name.toLowerCase().replaceAll(' ', '-');

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  useEffect(() => {
    if (attackPulse <= 0) {
      return;
    }

    void attackControls.start({
      x: [0, 14, -12, 8, -5, 0],
      transition: { duration: 0.34, ease: 'easeOut' },
    });
  }, [attackControls, attackPulse]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    rotateX.set((0.5 - y) * ART_TILT_X * 2);
    rotateY.set((x - 0.5) * ART_TILT_Y * 2);
  };

  return (
    <div className="flex flex-col items-center justify-end gap-[72px]" style={{ justifySelf: side === 'player' ? 'end' : 'start', minWidth: 0, width: frameWidth }}>
      <div data-testid={`combatant-${combatantId}-art`} style={{ display: 'flex', justifyContent: 'center', overflow: 'visible', position: 'relative', width: '100%' }}>
        {/* Tilt and attack feedback both live on the art wrapper so the motion stays localized. */}
        <motion.div
          animate={{ scale: hovered ? 1.01 : 1 }}
          onHoverEnd={() => {
            setHovered(false);
            resetTilt();
          }}
          onHoverStart={() => setHovered(true)}
          onPointerLeave={() => {
            setHovered(false);
            resetTilt();
          }}
          onPointerMove={handlePointerMove}
          style={{
            alignItems: 'center',
            aspectRatio: '1 / 1',
            backfaceVisibility: 'hidden',
            display: 'flex',
            height: 'auto',
            justifyContent: 'center',
            maxHeight: frameHeight,
            maxWidth: frameWidth,
            rotateX: prefersReducedMotion ? 0 : rotateX,
            rotateY: prefersReducedMotion ? 0 : rotateY,
            transformPerspective: 1200,
            width: '100%',
            willChange: 'transform',
          }}
          transition={artSpring}
        >
          <motion.div animate={attackControls} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            {artPath ? (
              <img
                alt={name}
                draggable={false}
                src={artPath}
                style={{
                  border: highlightColor ? `1px solid ${withAlpha(highlightColor, '8a')}` : '1px solid rgba(41, 41, 41, 0.62)',
                  borderRadius: 20,
                  boxShadow: highlightColor ? `0 0 0 1px ${withAlpha(highlightColor, '2c')}, 0 0 12px ${withAlpha(highlightColor, '22')}` : undefined,
                  display: 'block',
                  height: '100%',
                  marginInline: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center bottom',
                  transition: 'border-color 220ms ease, box-shadow 240ms ease',
                  width: 'auto',
                }}
              />
            ) : (
              <div
                style={{
                  alignItems: 'center',
                  border: highlightColor ? `1px solid ${withAlpha(highlightColor, '8a')}` : '1px solid rgba(41, 41, 41, 0.62)',
                  borderRadius: 20,
                  boxShadow: highlightColor ? `0 0 0 1px ${withAlpha(highlightColor, '2c')}, 0 0 12px ${withAlpha(highlightColor, '22')}` : undefined,
                  display: 'flex',
                  height: '100%',
                  justifyContent: 'center',
                  transition: 'border-color 220ms ease, box-shadow 240ms ease',
                  width: '100%',
                }}
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-xl font-semibold text-muted-foreground">
                    {name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Full character art placeholder
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      <HoverCard closeDelay={120} openDelay={70}>
        <div style={{ position: 'relative' }}>
          <HoverCardTrigger asChild>
            <div data-testid={`combatant-${combatantId}-status`} style={{ display: 'flex', justifyContent: 'center', marginTop: 4, width: '100%' }}>
              <CombatantStatusCard
                currentHealth={currentHealth}
                highlightColor={highlightColor}
                maxHealth={maxHealth}
                name={name}
                statusIcons={statusIcons}
                width={frameWidth}
              />
            </div>
          </HoverCardTrigger>

          <AnimatePresence>
            {floatingTexts.map((entry, index) => (
              <motion.div
                animate={{ opacity: 1, x: 0, y: -10 }}
                exit={{ opacity: 0, x: floatingTextSide === 'right' ? 22 : -22, y: -28 }}
                initial={{ opacity: 0, x: floatingTextSide === 'right' ? -12 : 12, y: 8 }}
                key={entry.id}
                style={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  top: 28 + index * 24,
                  [floatingTextSide === 'right' ? 'left' : 'right']: 'calc(100% + 14px)',
                  zIndex: 60,
                }}
                transition={{ duration: 0.72, ease: 'easeOut' }}
              >
                <p className="text-xl font-black" style={{ color: entry.color, fontSize: 'clamp(12px, 1.7vw, 18px)', textShadow: '0 1px 6px rgba(0, 0, 0, 0.55)', whiteSpace: 'nowrap' }}>
                  {entry.label}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <HoverCardContent className="w-80 space-y-2">
          <p className="text-sm font-bold">
              Status Effects
          </p>
            {visibleStatuses.length > 0 ? (
              visibleStatuses.map((status) => {
                const Icon = status.icon;

                return (
                  <div className="space-y-1" key={`${name}-${status.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: status.color }}>
                        <Icon size={15} stroke={2} />
                        <span>{status.label}</span>
                      </p>
                      <p className="text-sm font-bold">
                        {status.value} {status.value === 1 ? 'stack' : 'stacks'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {status.description}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No active status effects.
              </p>
            )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}