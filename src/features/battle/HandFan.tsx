import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { CardView } from '@/entities/cards/CardView';
import type { CardDefinition } from '@/entities/cards/types';
import { useElementSize } from '@/shared/hooks/use-element-size';

type HandCard = {
  card: CardDefinition;
  instanceId: string;
  playable: boolean;
};

type HandFanProps = {
  cards: HandCard[];
  discardAnchorRef: RefObject<HTMLElement | null>;
  drawAnchorRef: RefObject<HTMLElement | null>;
  onHoveredCardChange?: (card: CardDefinition | null) => void;
  onPlayCard: (instanceId: string) => void;
};

const CARD_RATIO = 375 / 524;
const CARD_TOP = 88;
const handSpring = {
  damping: 30,
  mass: 0.72,
  stiffness: 320,
  type: 'spring',
} as const;
const GLOBAL_CARD_SCALE = 0.9;

type AnchorPosition = {
  x: number;
  y: number;
};

function getFanRotation(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  const midpoint = (total - 1) / 2;

  return (index - midpoint) * 5.4;
}

function getFanOffsetY(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  const midpoint = (total - 1) / 2;
  const distance = Math.abs(index - midpoint);

  return distance * 14;
}

function getFanSpread(total: number, cardWidth: number, availableWidth: number) {
  if (total <= 1) {
    return 0;
  }

  const usableWidth = Math.max(availableWidth - cardWidth, cardWidth);
  const maxSpread = usableWidth / (total - 1);

  return Math.max(cardWidth * 0.32, Math.min(cardWidth * 0.72, maxSpread));
}

function getAnchorPosition(
  anchorRef: RefObject<HTMLElement | null>,
  containerRect: DOMRect,
  containerWidth: number,
  fallback: AnchorPosition,
) {
  const anchorElement = anchorRef.current;

  if (!anchorElement) {
    return fallback;
  }

  const anchorRect = anchorElement.getBoundingClientRect();

  return {
    x: anchorRect.left + anchorRect.width / 2 - (containerRect.left + containerWidth / 2),
    y: anchorRect.top + anchorRect.height / 2 - containerRect.top - CARD_TOP,
  };
}

export function HandFan({ cards, discardAnchorRef, drawAnchorRef, onHoveredCardChange, onPlayCard }: HandFanProps) {
  const { ref: containerRef, width } = useElementSize<HTMLDivElement>();
  const prefersReducedMotion = useReducedMotion();
  const previousIdsRef = useRef<string[]>([]);
  const hoverResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorPositions, setAnchorPositions] = useState<{ discard: AnchorPosition; draw: AnchorPosition } | null>(null);
  const baseWidth = cards.length > 0 ? width / Math.min(cards.length, 4.2) : 250;
  const scaledWidth = (Number.isFinite(baseWidth) && baseWidth > 0 ? baseWidth : 250) * GLOBAL_CARD_SCALE;
  const cardWidth = Math.max(193, Math.min(245, scaledWidth));
  const cardHeight = cardWidth / CARD_RATIO;
  const spread = getFanSpread(cards.length, cardWidth, width || cardWidth * cards.length);
  const fallbackDrawAnchor = useMemo(
    () => ({ x: -Math.max((width || cardWidth * 2) / 2 - cardWidth * 0.36, cardWidth * 0.54), y: cardHeight * 0.62 }),
    [cardHeight, cardWidth, width],
  );
  const fallbackDiscardAnchor = useMemo(
    () => ({ x: Math.max((width || cardWidth * 2) / 2 - cardWidth * 0.36, cardWidth * 0.54), y: cardHeight * 0.62 }),
    [cardHeight, cardWidth, width],
  );
  const currentIds = cards.map((entry) => entry.instanceId);
  const previousIds = previousIdsRef.current;
  const enteringIds = currentIds.filter((instanceId) => !previousIds.includes(instanceId));
  const hasDrawReflow = enteringIds.length > 0 && previousIds.length > 0;

  const measureAnchors = useCallback(() => {
    const containerElement = containerRef.current;

    if (!containerElement) {
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const containerWidth = containerRect.width || width || cardWidth * Math.max(cards.length, 1);

    setAnchorPositions({
      discard: getAnchorPosition(discardAnchorRef, containerRect, containerWidth, fallbackDiscardAnchor),
      draw: getAnchorPosition(drawAnchorRef, containerRect, containerWidth, fallbackDrawAnchor),
    });
  }, [cardWidth, cards.length, discardAnchorRef, drawAnchorRef, fallbackDiscardAnchor, fallbackDrawAnchor, width]);

  useLayoutEffect(() => {
    measureAnchors();
  }, [measureAnchors]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      measureAnchors();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    if (drawAnchorRef.current) {
      resizeObserver.observe(drawAnchorRef.current);
    }

    if (discardAnchorRef.current) {
      resizeObserver.observe(discardAnchorRef.current);
    }

    window.addEventListener('resize', measureAnchors);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureAnchors);
    };
  }, [discardAnchorRef, drawAnchorRef, measureAnchors]);

  useEffect(() => {
    previousIdsRef.current = currentIds;
  }, [currentIds]);

  useEffect(
    () => () => {
      if (hoverResetTimeoutRef.current) {
        clearTimeout(hoverResetTimeoutRef.current);
      }
    },
    [],
  );

  const hoveredIndex = hoveredId ? cards.findIndex((entry) => entry.instanceId === hoveredId) : -1;

  const fanLayout = useMemo(
    () =>
      cards.map((entry, index) => {
        const midpoint = (cards.length - 1) / 2;

        return {
          instanceId: entry.instanceId,
          rotate: getFanRotation(index, cards.length),
          x: (index - midpoint) * spread,
          y: getFanOffsetY(index, cards.length),
        };
      }),
    [cards, spread],
  );

  return (
    <div
      ref={containerRef}
      onPointerLeave={() => {
        if (hoverResetTimeoutRef.current) {
          clearTimeout(hoverResetTimeoutRef.current);
        }

        hoverResetTimeoutRef.current = setTimeout(() => {
          setHoveredId(null);
          onHoveredCardChange?.(null);
          hoverResetTimeoutRef.current = null;
        }, 70);
      }}
      style={{
        minHeight: cardHeight + CARD_TOP + 52,
        overflow: 'visible',
        paddingBottom: 0,
        paddingTop: 0,
        position: 'relative',
        width: '100%',
      }}
    >
      <AnimatePresence initial={false}>
        {cards.map((entry, index) => {
          const layout = fanLayout[index];
          const isHovered = hoveredId === entry.instanceId;
          const distanceFromHovered = hoveredIndex === -1 ? null : Math.abs(index - hoveredIndex);
          const hoverSpreadX =
            hoveredIndex === -1 || hoveredIndex === index
              ? 0
              : index < hoveredIndex
                ? distanceFromHovered === 1
                  ? -18
                  : distanceFromHovered === 2
                    ? -8
                    : 0
                : distanceFromHovered === 1
                  ? 18
                  : distanceFromHovered === 2
                    ? 8
                    : 0;
          const hoverSpreadY = hoveredIndex === -1 || hoveredIndex === index ? 0 : distanceFromHovered === 1 ? 10 : distanceFromHovered === 2 ? 4 : 0;
          const restingScale = entry.playable ? 1 : 0.8;
          const enterIndex = enteringIds.indexOf(entry.instanceId);
          const transitionDelay = hasDrawReflow ? (enterIndex >= 0 ? enterIndex * 0.045 : index * 0.014) : 0;
          const drawAnchor = anchorPositions?.draw ?? fallbackDrawAnchor;
          const discardAnchor = anchorPositions?.discard ?? fallbackDiscardAnchor;

          return (
            <motion.div
              animate={{
                filter: entry.playable ? 'none' : 'grayscale(0.95) saturate(0.3) brightness(0.72)',
                opacity: 1,
                rotate: isHovered ? 0 : layout.rotate,
                scale: isHovered && entry.playable ? (prefersReducedMotion ? 1.015 : 1.045) : restingScale,
                x: layout.x + hoverSpreadX,
                y: isHovered && entry.playable ? (prefersReducedMotion ? -38 : -52) : layout.y + hoverSpreadY,
              }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      rotate: 0,
                      scale: 0.72,
                      x: discardAnchor.x,
                      y: discardAnchor.y,
                    }
              }
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      rotate: 0,
                      scale: 0.78,
                      x: drawAnchor.x,
                      y: drawAnchor.y,
                    }
              }
              key={entry.instanceId}
              onHoverEnd={() => {
                if (hoverResetTimeoutRef.current) {
                  clearTimeout(hoverResetTimeoutRef.current);
                }

                hoverResetTimeoutRef.current = setTimeout(() => {
                  setHoveredId((current) => (current === entry.instanceId ? null : current));
                  onHoveredCardChange?.(null);
                  hoverResetTimeoutRef.current = null;
                }, 70);
              }}
              onHoverStart={() => {
                if (hoverResetTimeoutRef.current) {
                  clearTimeout(hoverResetTimeoutRef.current);
                  hoverResetTimeoutRef.current = null;
                }

                if (!entry.playable) {
                  onHoveredCardChange?.(null);
                  return;
                }

                setHoveredId(entry.instanceId);
                onHoveredCardChange?.(entry.card);
              }}
              style={{
                left: '50%',
                marginLeft: -(cardWidth / 2),
                overflow: 'visible',
                position: 'absolute',
                top: CARD_TOP,
                transformOrigin: 'center 92%',
                willChange: 'transform',
                width: cardWidth,
                zIndex: isHovered ? cards.length + 160 : index + 1,
              }}
              transition={{ ...handSpring, delay: transitionDelay }}
            >
              {/* Disabled cards stay smaller and desaturated so the playable hand reads at a glance. */}
              <CardView
                card={entry.card}
                disabled={!entry.playable}
                interactive={entry.playable}
                onClick={() => {
                  if (!entry.playable) {
                    return;
                  }

                  onPlayCard(entry.instanceId);
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}