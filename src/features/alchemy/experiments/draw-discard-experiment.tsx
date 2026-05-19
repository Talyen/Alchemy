// Temporary draw/discard animation prototype for validating battle-card transfer timing and geometry.
import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";

import { cardBack, pileDiscardArt, pileDrawArt, wolfCompanion } from "@/lib/game-data";
import { HAND_FAN_ROTATION_DEGREES, HAND_FAN_VERTICAL_STEP_PX } from "@/lib/game-constants";
import { Button } from "@/components/ui/button";
import { cardSurfaceClass } from "@/features/alchemy/config";
import { getAudioContext, loadSoundBuffer, resumeAudioContext } from "@/lib/audio-buffer-cache";
import { cn } from "@/lib/utils";

function playSfx() {
  resumeAudioContext();
  loadSoundBuffer("card-draw-2.ogg").then((buffer: AudioBuffer | null) => {
    if (!buffer) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  });
}

type DrawDiscardExperimentProps = {
  onBack: () => void;
};

const CARD_W = 210;
const CARD_H = CARD_W * (4 / 3);
const CARD_GAP = 40;
const PILE_SCALE = 140 / CARD_W;
const DRAW_DURATION_SECONDS = 0.55;
const DISCARD_DURATION_SECONDS = 0.45;
const ANIMATION_COMPLETION_BUFFER_MS = 120;
const REQUIRED_STABLE_SLOT_FRAMES = 2;
const MAX_SLOT_STABILIZE_FRAMES = 12;
const HAND_SHIFT_TRANSITION = { type: "spring", stiffness: 350, damping: 26 } as const;

interface LocalCardPosition {
  x: number;
  y: number;
}

interface CardTransferAnim {
  id: number;
  from: LocalCardPosition;
  to: LocalCardPosition;
  fromScale: number;
  toScale: number;
  fromRotation: number;
  toRotation: number;
  rotateY: number[];
  duration: number;
  speedMultiplier: number;
}

interface FrameHandle {
  first: number | null;
  second: number | null;
}

function getContainerScale(container: HTMLDivElement) {
  const cr = container.getBoundingClientRect();
  return {
    x: cr.width / container.offsetWidth || 1,
    y: cr.height / container.offsetHeight || 1,
  };
}

// Converts viewport-space DOM rects into the unscaled local coordinate system used by absolute cards.
function getElementCenterAsCardTopLeft(container: HTMLDivElement, element: HTMLElement): LocalCardPosition {
  const cr = container.getBoundingClientRect();
  const er = element.getBoundingClientRect();
  const scale = getContainerScale(container);
  return {
    x: (er.left + er.width / 2 - cr.left) / scale.x - CARD_W / 2,
    y: (er.top + er.height / 2 - cr.top) / scale.y - CARD_H / 2,
  };
}

// Mirrors the hand's flex-row x placement as a fallback when the DOM slot cannot be measured.
function getHandCardX(handCenter: number, index: number, count: number) {
  const totalW = CARD_W + (count - 1) * (CARD_W - CARD_GAP);
  const leftEdge = handCenter - totalW / 2;
  return leftEdge + index * (CARD_W - CARD_GAP);
}

// Provides a deterministic fallback landing slot if visual DOM measurement is unavailable.
function getLayout(container: HTMLDivElement) {
  const hc = container.querySelector("[data-hand-container]") as HTMLElement | null;
  let handY = container.offsetHeight - 60 - CARD_H;
  if (hc) {
    handY = hc.offsetTop + hc.offsetHeight - CARD_H;
  }
  return { handCenter: container.offsetWidth / 2, handY };
}

// Reads the untransformed flex layout slot for a hand card as a secondary fallback.
function getHandCardLayoutSlot(container: HTMLDivElement, cardName: string): LocalCardPosition | null {
  const hc = container.querySelector("[data-hand-container]") as HTMLElement | null;
  const cardEl = Array.from(container.querySelectorAll("[data-hand-card]")).find(
    (el) => (el as HTMLElement).dataset.handCardId === cardName,
  ) as HTMLElement | undefined;

  if (!hc || !cardEl) return null;

  return {
    x: hc.offsetLeft + cardEl.offsetLeft,
    y: hc.offsetTop + cardEl.offsetTop,
  };
}

// Reads the rendered visual card position, including scale and fan transforms, for exact handoff matching.
function getHandCardVisualSlot(container: HTMLDivElement, cardName: string): LocalCardPosition | null {
  const cardEl = Array.from(container.querySelectorAll("[data-hand-card]")).find(
    (el) => (el as HTMLElement).dataset.handCardId === cardName,
  ) as HTMLElement | undefined;

  if (!cardEl) return null;
  return getElementCenterAsCardTopLeft(container, cardEl);
}

export function DrawDiscardExperiment({ onBack }: DrawDiscardExperimentProps) {
  const [drawCount, setDrawCount] = useState(12);
  const [handCards, setHandCards] = useState<string[]>(() => Array.from({ length: 4 }, (_, i) => `card-${i}`));
  const [discardCount, setDiscardCount] = useState(3);
  const nextCardId = useRef(handCards.length);
  const [anim, setAnim] = useState<CardTransferAnim | null>(null);
  const [ghostCards, setGhostCards] = useState<Set<string>>(new Set());
  const [lockedCards, setLockedCards] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);

  const queueRef = useRef<Array<() => void>>([]);
  const processingRef = useRef(false);
  const drawCountRef = useRef(drawCount);
  const handLenRef = useRef(handCards.length);
  const handCardsRef = useRef(handCards);
  const finishAnimRef = useRef<(() => void) | null>(null);
  const drawMeasureFrameRef = useRef<number | null>(null);
  const handoffFrameRef = useRef<FrameHandle>({ first: null, second: null });
  const completionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    drawCountRef.current = drawCount;
  }, [drawCount]);
  useEffect(() => {
    handCardsRef.current = handCards;
    handLenRef.current = handCards.length;
  }, [handCards]);
  useEffect(
    () => () => {
      if (drawMeasureFrameRef.current !== null) cancelAnimationFrame(drawMeasureFrameRef.current);
      if (handoffFrameRef.current.first !== null) cancelAnimationFrame(handoffFrameRef.current.first);
      if (handoffFrameRef.current.second !== null) cancelAnimationFrame(handoffFrameRef.current.second);
      if (completionTimeoutRef.current !== null) window.clearTimeout(completionTimeoutRef.current);
    },
    [],
  );

  // Uses visual pile geometry so transfers stay correct when the game stage is CSS-scaled.
  function getPileSlot(el: HTMLDivElement) {
    const c = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    return getElementCenterAsCardTopLeft(c, el);
  }

  function processNext() {
    if (queueRef.current.length === 0) {
      processingRef.current = false;
      return;
    }
    processingRef.current = true;
    const action = queueRef.current.shift()!;
    action();
  }

  function enqueue(action: () => void) {
    queueRef.current.push(action);
    if (!processingRef.current) processNext();
  }

  // Cancels delayed animation work when test controls reset or remove hand state mid-transfer.
  function clearPendingAnimationHandles() {
    if (drawMeasureFrameRef.current !== null) {
      cancelAnimationFrame(drawMeasureFrameRef.current);
      drawMeasureFrameRef.current = null;
    }
    if (handoffFrameRef.current.first !== null) {
      cancelAnimationFrame(handoffFrameRef.current.first);
      handoffFrameRef.current.first = null;
    }
    if (handoffFrameRef.current.second !== null) {
      cancelAnimationFrame(handoffFrameRef.current.second);
      handoffFrameRef.current.second = null;
    }
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }

  // Clears transient overlay/ghost state without changing draw, discard, or hand counts.
  function clearAnimationState() {
    clearPendingAnimationHandles();
    finishAnimRef.current = null;
    setAnim(null);
    setGhostCards(new Set());
    setLockedCards(new Set());
  }

  // Finishes only the currently armed transfer, preventing stale timers from completing newer animations.
  function completeCurrentAnimation() {
    const finish = finishAnimRef.current;
    if (!finish) return;
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    finishAnimRef.current = null;
    finish();
  }

  // Uses a timer instead of Motion completion because multi-property 3D animations fired completion too early.
  function finishAfterDuration(finish: () => void, durationMs: number) {
    if (completionTimeoutRef.current !== null) window.clearTimeout(completionTimeoutRef.current);
    finishAnimRef.current = finish;
    completionTimeoutRef.current = window.setTimeout(
      completeCurrentAnimation,
      durationMs + ANIMATION_COMPLETION_BUFFER_MS,
    );
  }

  // Reveals the hidden destination card under the overlay before removing the overlay and unlocking layout motion.
  function finishDrawHandoff(cardName: string, onDone: () => void) {
    setDrawCount((c) => c - 1);
    drawCountRef.current = drawCountRef.current - 1;
    setGhostCards((prev) => {
      const n = new Set(prev);
      n.delete(cardName);
      return n;
    });
    handoffFrameRef.current.first = requestAnimationFrame(() => {
      handoffFrameRef.current.first = null;
      setAnim(null);
      handoffFrameRef.current.second = requestAnimationFrame(() => {
        handoffFrameRef.current.second = null;
        flushSync(() => {
          setLockedCards((prev) => {
            const n = new Set(prev);
            n.delete(cardName);
            return n;
          });
        });
        onDone();
      });
    });
  }

  // Waits for the hidden drawn card's measured position to settle before starting the flying overlay.
  function waitForStableHandCardSlot(
    cardName: string,
    fallback: LocalCardPosition,
    onReady: (slot: LocalCardPosition) => void,
  ) {
    let frameCount = 0;
    let stableFrames = 0;
    let lastSlot: LocalCardPosition | null = null;

    function tick() {
      drawMeasureFrameRef.current = null;
      frameCount += 1;

      const container = containerRef.current;
      const slot = container
        ? (getHandCardVisualSlot(container, cardName) ?? getHandCardLayoutSlot(container, cardName) ?? fallback)
        : fallback;

      if (lastSlot && Math.abs(slot.x - lastSlot.x) < 0.5 && Math.abs(slot.y - lastSlot.y) < 0.5) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      lastSlot = slot;

      if (stableFrames >= REQUIRED_STABLE_SLOT_FRAMES || frameCount >= MAX_SLOT_STABILIZE_FRAMES) {
        onReady(slot);
        return;
      }

      drawMeasureFrameRef.current = requestAnimationFrame(tick);
    }

    drawMeasureFrameRef.current = requestAnimationFrame(tick);
  }

  function runDraw(handLen: number, speedMultiplier: number, onDone: () => void) {
    if (drawCountRef.current <= 0 || !drawRef.current || !containerRef.current) {
      onDone();
      return;
    }
    const from = getPileSlot(drawRef.current!);
    const { handCenter, handY } = getLayout(containerRef.current);
    const idx = handLen;
    const totalAfter = handLen + 1;
    const offset = idx - (totalAfter - 1) / 2;
    const fallbackToX = getHandCardX(handCenter, idx, totalAfter);
    const cardName = `card-${nextCardId.current}`;
    nextCardId.current += 1;
    const duration = DRAW_DURATION_SECONDS;
    const nextHand = [...handCardsRef.current, cardName];

    flushSync(() => {
      setGhostCards((prev) => new Set(prev).add(cardName));
      setLockedCards((prev) => new Set(prev).add(cardName));
      setHandCards(nextHand);
    });
    handCardsRef.current = nextHand;
    handLenRef.current = nextHand.length;

    waitForStableHandCardSlot(cardName, { x: fallbackToX, y: handY }, (target) => {
      if (!containerRef.current) {
        onDone();
        return;
      }

      playSfx();
      finishAfterDuration(() => finishDrawHandoff(cardName, onDone), Math.round((duration / speedMultiplier) * 1000));
      setAnim({
        id: Math.random(),
        from,
        to: target,
        fromScale: PILE_SCALE,
        toScale: 1,
        fromRotation: 0,
        toRotation: offset * HAND_FAN_ROTATION_DEGREES,
        rotateY: [180, 90, 0],
        duration,
        speedMultiplier,
      });
    });
  }

  function runDiscard(onDone: () => void) {
    if (handLenRef.current <= 0 || !discardRef.current || !containerRef.current) {
      onDone();
      return;
    }
    const to = getPileSlot(discardRef.current!);
    const { handCenter, handY } = getLayout(containerRef.current);
    const cards = handCardsRef.current;
    const cardName = cards[cards.length - 1];
    const nextHand = cards.slice(0, -1);
    const idx = cards.length - 1;
    const offset = idx - (cards.length - 1) / 2;
    const fromSlot = getHandCardVisualSlot(containerRef.current, cardName) ??
      getHandCardLayoutSlot(containerRef.current, cardName) ?? {
        x: getHandCardX(handCenter, idx, cards.length),
        y: handY,
      };
    const duration = DISCARD_DURATION_SECONDS;

    playSfx();
    finishAfterDuration(
      () => {
        setDiscardCount((c) => c + 1);
        setAnim(null);
        onDone();
      },
      Math.round(duration * 1000),
    );
    setAnim({
      id: Math.random(),
      from: fromSlot,
      to,
      fromScale: 1,
      toScale: PILE_SCALE,
      fromRotation: offset * HAND_FAN_ROTATION_DEGREES,
      toRotation: 0,
      rotateY: [0, 90, 180],
      duration,
      speedMultiplier: 1,
    });
    setHandCards(nextHand);
    handCardsRef.current = nextHand;
    handLenRef.current = nextHand.length;
  }

  function runDiscardAll(count: number, onDone: () => void) {
    if (count <= 0 || !discardRef.current || !containerRef.current) {
      onDone();
      return;
    }
    const to = getPileSlot(discardRef.current!);
    const { handCenter, handY } = getLayout(containerRef.current);
    const cards = handCardsRef.current;
    const cardName = cards[cards.length - 1];
    const idx = cards.length - 1;
    const offset = idx - (cards.length - 1) / 2;
    const fromSlot = getHandCardVisualSlot(containerRef.current, cardName) ??
      getHandCardLayoutSlot(containerRef.current, cardName) ?? {
        x: getHandCardX(handCenter, idx, cards.length),
        y: handY,
      };
    const duration = DISCARD_DURATION_SECONDS;

    playSfx();
    finishAfterDuration(
      () => {
        setDiscardCount((c) => c + count);
        setAnim(null);
        onDone();
      },
      Math.round(duration * 1000),
    );
    setAnim({
      id: Math.random(),
      from: fromSlot,
      to,
      fromScale: 1,
      toScale: PILE_SCALE,
      fromRotation: offset * HAND_FAN_ROTATION_DEGREES,
      toRotation: 0,
      rotateY: [0, 90, 180],
      duration,
      speedMultiplier: 1,
    });
    setHandCards([]);
    handCardsRef.current = [];
    handLenRef.current = 0;
  }

  function handleDraw(count: number) {
    let drawn = 0;
    const total = Math.min(count, drawCountRef.current);
    function chain() {
      if (drawn >= total) {
        processNext();
        return;
      }
      const speedMultiplier = 1 + (queueRef.current.length + (total - drawn)) * 0.15;
      const currentLen = handLenRef.current;
      drawn++;
      runDraw(currentLen, speedMultiplier, () => {
        setTimeout(chain, 60 / speedMultiplier);
      });
    }
    enqueue(chain);
  }

  function handleDiscard() {
    enqueue(() => {
      runDiscard(() => {
        requestAnimationFrame(processNext);
      });
    });
  }

  function handleDiscardAll() {
    enqueue(() => {
      const count = handLenRef.current;
      runDiscardAll(count, () => {
        requestAnimationFrame(processNext);
      });
    });
  }

  function shuffleAll() {
    setDrawCount((c) => c + discardCount);
    setDiscardCount(0);
  }

  function emptyHand() {
    const count = handCards.length;
    setDiscardCount((c) => c + count);
    clearAnimationState();
    queueRef.current = [];
    processingRef.current = false;
    setHandCards([]);
    handCardsRef.current = [];
    handLenRef.current = 0;
  }

  function reset() {
    const initialHand = Array.from({ length: 4 }, (_, i) => `card-${i}`);
    setDrawCount(12);
    setHandCards(initialHand);
    setDiscardCount(3);
    clearAnimationState();
    queueRef.current = [];
    processingRef.current = false;
    nextCardId.current = 4;
    handCardsRef.current = initialHand;
    handLenRef.current = 4;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-base font-semibold text-foreground">Draw / Discard</h2>
        <div className="w-20" />
      </div>

      <div ref={containerRef} data-transfer-stage className="relative flex-1 overflow-hidden">
        <div ref={drawRef} className="absolute flex flex-col items-center gap-2" style={{ left: 60, bottom: 60 }}>
          <img src={pileDrawArt} alt="Draw Pile" className="block w-[140px] rounded-[22px] aspect-[3/4] object-cover" />
          <span className="text-sm font-semibold text-muted-foreground">Draw Pile ({drawCount})</span>
        </div>

        <div
          className="absolute flex items-end justify-center"
          style={{ left: "50%", bottom: 60, transform: "translateX(-50%)" }}
        >
          <div
            data-hand-container
            className="relative flex items-end justify-center min-h-[280px]"
            style={{ minWidth: 300 }}
          >
            {handCards.map((card, i) => {
              const offset = i - (handCards.length - 1) / 2;
              const isGhost = ghostCards.has(card);
              const isLocked = lockedCards.has(card);
              return (
                <motion.div
                  key={card}
                  data-hand-card
                  data-hand-card-id={card}
                  layout
                  initial={false}
                  animate={{
                    y: Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX,
                    scale: 1,
                    rotate: offset * HAND_FAN_ROTATION_DEGREES,
                  }}
                  transition={isLocked ? { duration: 0 } : HAND_SHIFT_TRANSITION}
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    marginLeft: -20,
                    marginRight: -20,
                    zIndex: i,
                    pointerEvents: isGhost ? ("none" as const) : undefined,
                  }}
                >
                  <div
                    className="h-full w-full"
                    style={{ opacity: isGhost ? 0 : undefined, visibility: isGhost ? "hidden" : undefined }}
                  >
                    <img
                      src={wolfCompanion}
                      alt={`Card ${i}`}
                      className={cn("h-full w-full object-cover", cardSurfaceClass)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div ref={discardRef} className="absolute flex flex-col items-center gap-2" style={{ right: 60, bottom: 60 }}>
          <img
            src={pileDiscardArt}
            alt="Discard Pile"
            className="block w-[140px] rounded-[22px] aspect-[3/4] object-cover"
          />
          <span className="text-sm font-semibold text-muted-foreground">Discard Pile ({discardCount})</span>
        </div>

        {anim && (
          <motion.div
            key={anim.id}
            data-flying-card
            className="absolute z-50 pointer-events-none"
            style={{
              width: CARD_W,
              height: CARD_H,
              transformStyle: "preserve-3d",
              left: anim.from.x,
              top: anim.from.y,
            }}
            animate={{
              left: anim.to.x,
              top: anim.to.y,
              scale: [anim.fromScale, anim.toScale],
              rotate: [anim.fromRotation, anim.toRotation],
              rotateY: anim.rotateY,
            }}
            transition={{
              left: { duration: anim.duration / anim.speedMultiplier, ease: [0.22, 1, 0.36, 1] },
              top: { duration: anim.duration / anim.speedMultiplier, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: anim.duration / anim.speedMultiplier, ease: [0.22, 1, 0.36, 1] },
              rotate: { duration: anim.duration / anim.speedMultiplier, ease: [0.22, 1, 0.36, 1] },
              rotateY: { duration: anim.duration / anim.speedMultiplier, ease: "linear" },
            }}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
              <img src={wolfCompanion} alt="Front" className={cn("h-full w-full object-cover", cardSurfaceClass)} />
            </div>
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <img src={cardBack} alt="Back" className={cn("h-full w-full object-cover", cardSurfaceClass)} />
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex justify-center gap-3 py-4">
        <Button onClick={() => handleDraw(1)} disabled={drawCount <= 0} size="sm">
          Draw 1
        </Button>
        <Button onClick={() => handleDraw(3)} disabled={drawCount < 3} size="sm">
          Draw 3
        </Button>
        <Button onClick={() => handleDraw(4)} disabled={drawCount < 4} size="sm">
          Draw Hand (4)
        </Button>
        <Button onClick={handleDiscard} disabled={handCards.length <= 0} size="sm">
          Discard 1
        </Button>
        <Button onClick={handleDiscardAll} disabled={handCards.length <= 0} size="sm">
          Discard All
        </Button>
        <Button variant="outline" onClick={shuffleAll} size="sm">
          Shuffle
        </Button>
        <Button variant="outline" onClick={emptyHand} size="sm">
          Empty Hand
        </Button>
        <Button variant="outline" onClick={reset} size="sm">
          Reset
        </Button>
      </div>
    </div>
  );
}
