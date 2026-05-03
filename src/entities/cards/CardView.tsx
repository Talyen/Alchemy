import { motion, useReducedMotion, useSpring } from 'motion/react';
import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CardDefinition } from '@/entities/cards/types';
import { cardArtById } from '@/shared/assets/registry';
import { keywordDefinitions } from '@/shared/content/keywords';

type CardViewProps = {
  card: CardDefinition;
  disabled?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  onHoverEnd?: () => void;
  onHoverStart?: () => void;
};

const cardSpring = {
  damping: 26,
  mass: 0.48,
  stiffness: 260,
} as const;

const TILT_LIMIT_X = 8;
const TILT_LIMIT_Y = 10;
const GLINT_COOLDOWN_MS = 3000;

function escapeKeywordMatcher(label: string) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getReferencedKeywordDefinitions(card: CardDefinition) {
  const cardText = `${card.title}\n${card.description}`;

  return Object.values(keywordDefinitions).filter((definition) => {
    if (card.keywords.includes(definition.id)) {
      return true;
    }

    return new RegExp(`\\b${escapeKeywordMatcher(definition.label)}\\b`, 'i').test(cardText);
  });
}

export function CardView({
  card,
  disabled = false,
  interactive = false,
  onClick,
  onHoverEnd,
  onHoverStart,
}: CardViewProps) {
  const art = cardArtById[card.artKey];
  const referencedKeywordDefinitions = getReferencedKeywordDefinitions(card);
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [glintVersion, setGlintVersion] = useState(0);
  const rotateX = useSpring(0, cardSpring);
  const rotateY = useSpring(0, cardSpring);
  const lastGlintAtRef = useRef(-GLINT_COOLDOWN_MS);
  const tiltEnabled = !prefersReducedMotion && !disabled;

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const triggerGlint = () => {
    if (prefersReducedMotion || disabled) {
      return;
    }

    const now = Date.now();

    if (now - lastGlintAtRef.current < GLINT_COOLDOWN_MS) {
      return;
    }

    lastGlintAtRef.current = now;
    setGlintVersion((current) => current + 1);
  };

  const handleHoverStart = () => {
    if (disabled) {
      return;
    }

    setHovered(true);
    triggerGlint();
    onHoverStart?.();
  };

  const handleHoverEnd = () => {
    setHovered(false);
    resetTilt();
    onHoverEnd?.();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    rotateX.set((0.5 - y) * TILT_LIMIT_X * 2);
    rotateY.set((x - 0.5) * TILT_LIMIT_Y * 2);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onClick) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full" style={{ minWidth: 0, overflow: 'visible' }}>
            <div className="relative" style={{ aspectRatio: '375 / 524', minWidth: 0, overflow: 'visible' }}>
              <motion.div
                initial={false}
                animate={{
                  filter: disabled ? 'grayscale(0.92) saturate(0.38) brightness(0.72)' : hovered ? 'saturate(1.06) brightness(1.02)' : 'none',
                  opacity: disabled ? 0.82 : 1,
                  scale: hovered ? 1.01 : 1,
                }}
                data-card-id={card.id}
                data-testid={`card-${card.id}`}
                onBlur={handleHoverEnd}
                onClick={onClick}
                onFocus={handleHoverStart}
                onHoverEnd={handleHoverEnd}
                onHoverStart={handleHoverStart}
                onKeyDown={handleKeyDown}
                onPointerMove={handlePointerMove}
                role={interactive ? 'button' : undefined}
                style={{
                  backfaceVisibility: 'hidden',
                  cursor: interactive ? 'pointer' : 'default',
                  height: '100%',
                  overflow: 'visible',
                  position: 'relative',
                  rotateX: tiltEnabled ? rotateX : 0,
                  rotateY: tiltEnabled ? rotateY : 0,
                  transformPerspective: 1200,
                  width: '100%',
                  willChange: 'transform, filter, opacity',
                }}
                tabIndex={interactive ? 0 : undefined}
                transition={cardSpring}
                whileTap={interactive ? { scale: 0.985 } : undefined}
              >
                <div
                  className="absolute inset-0 overflow-hidden rounded-[22px]"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.18), transparent 42%), rgba(13, 11, 12, 0.98)',
                    border: hovered ? '1px solid rgba(246, 239, 228, 0.48)' : '1px solid rgba(246, 239, 228, 0.28)',
                    boxShadow: hovered
                      ? '0 18px 34px rgba(7, 7, 9, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.08) inset'
                      : '0 14px 26px rgba(7, 7, 9, 0.34), 0 0 0 1px rgba(255, 255, 255, 0.06) inset',
                    pointerEvents: 'none',
                    transform: 'translateZ(0)',
                  }}
                >
                  <img
                    alt={card.title}
                    decoding="async"
                    draggable={false}
                    loading={interactive ? 'eager' : 'lazy'}
                    src={art?.path}
                    style={{
                      display: 'block',
                      height: '100%',
                      inset: 0,
                      objectFit: 'cover',
                      objectPosition: 'center center',
                      pointerEvents: 'none',
                      position: 'absolute',
                      transition: 'transform 220ms ease, filter 220ms ease',
                      transform: hovered ? 'scale(1.03)' : 'scale(1)',
                      width: '100%',
                    }}
                  />

                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        hovered
                          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 28%, rgba(0, 0, 0, 0.14) 100%)'
                          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 28%, rgba(0, 0, 0, 0.16) 100%)',
                    }}
                  />

                  <div
                    className="absolute inset-0"
                    style={{
                      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 18px 32px rgba(255, 255, 255, 0.04), inset 0 -20px 30px rgba(0, 0, 0, 0.16)',
                    }}
                  />

                  {glintVersion > 0 ? (
                    <div className="absolute inset-0 overflow-hidden">
                      <motion.div
                        animate={{ opacity: [0, 0.12, 0.3, 0], x: ['-165%', '165%'] }}
                        initial={{ opacity: 0, rotate: 18, x: '-165%' }}
                        key={glintVersion}
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.08) 34%, rgba(255, 255, 255, 0.52) 50%, rgba(255, 255, 255, 0.08) 66%, rgba(255, 255, 255, 0) 100%)',
                          filter: 'blur(1px)',
                          height: '180%',
                          left: '-24%',
                          position: 'absolute',
                          top: '-38%',
                          width: '44%',
                        }}
                        transition={{ duration: 1.05, ease: 'easeInOut' }}
                      />
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[320px] px-0 py-0" side="top" sideOffset={10}>
          <div className="space-y-3 px-4 py-3 text-[#f4eee4]">
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-[0.08em] text-[#f8f2e7]">{card.title}</p>
              <p className="whitespace-pre-line text-sm leading-[1.5] text-[#ddd4c5]">{card.description}</p>
            </div>

            {referencedKeywordDefinitions.length > 0 ? (
              <div className="space-y-2">
                {referencedKeywordDefinitions.map((definition) => (
                  <div className="space-y-0.5" key={`${card.id}-${definition.id}`}>
                    <p className="text-sm font-extrabold" style={{ color: definition.color }}>
                      {definition.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{definition.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
