import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { BattleCard } from "@/lib/game-data";
import { cardLibrary } from "@/lib/game-data";

import { Button } from "@/components/ui/button";
import { BattleCardButton, getCardDisplayTitle } from "../ui/card-ui";
import { ScreenHeader } from "../ui/shared-ui";
import { collectionTileWidthClass } from "../config";
import { getHoverId } from "../utils";
import { useBattleStore } from "../stores/battle-store";
import { useScreenStore } from "../stores/screen-store";

function shufflePool(): BattleCard[] {
  const pool = [...cardLibrary];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

const DRAFT_ROUNDS = 6;
const CHOICES_PER_ROUND = 3;

export function DraftDeckScreen({ onComplete }: { onComplete: (draftedCards: BattleCard[]) => void }) {
  const [pool] = useState(() => shufflePool());
  const [round, setRound] = useState(0);
  const [drafted, setDrafted] = useState<BattleCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const setHoveredCardId = useScreenStore((s) => s.setHoveredCardId);
  const shimmerState = useBattleStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useBattleStore((s) => s.maybeTriggerShimmer);

  const choices = useMemo(() => {
    if (pool.length === 0) return [];
    const start = round * CHOICES_PER_ROUND;
    return pool.slice(start, start + CHOICES_PER_ROUND);
  }, [pool, round]);

  const handlePick = useCallback(
    (card: BattleCard) => {
      const nextDrafted = [...drafted, card];
      setDrafted(nextDrafted);
      const nextRound = round + 1;
      if (nextRound >= DRAFT_ROUNDS) return;
      setRound(nextRound);
    },
    [drafted, round],
  );

  const isComplete = drafted.length >= DRAFT_ROUNDS;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div className="alchemy-shell w-full max-w-6xl flex flex-col items-center rounded-[30px] border border-border/80 p-7">
        <ScreenHeader title={isComplete ? "Draft Complete" : "Draft a Deck"} />
        <p className="mt-3 text-base text-muted-foreground">
          {isComplete
            ? "You drafted " + drafted.length + " cards. Ready to begin your run."
            : "Pick 1 of 3 cards \u2014 " + (round + 1) + "/" + DRAFT_ROUNDS + " selected"}
        </p>

        {isComplete ? (
          <div className="mx-auto mt-8 grid max-w-fit grid-cols-3 justify-items-center gap-6">
            {drafted.map((card, index) => {
              const hoverId = getHoverId("drafted-" + index, card.id);
              return (
                <BattleCardButton
                  key={"drafted-" + index + "-" + card.id}
                  card={card}
                  hovered={hoveredCardId === hoverId}
                  onHoverStart={() => {
                    setHoveredCardId(hoverId);
                    maybeTriggerShimmer(hoverId);
                  }}
                  onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                  ariaLabel={getCardDisplayTitle(card)}
                  shimmerActive={shimmerState?.cardId === hoverId}
                  shimmerToken={shimmerState?.token}
                  className={collectionTileWidthClass}
                  wrapperClassName="stagger-item relative flex justify-center"
                  wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
            {choices.map((card, index) => {
              const hoverId = getHoverId("draft-choice-" + index, card.id);
              return (
                <BattleCardButton
                  key={"draft-choice-" + index + "-" + card.id}
                  card={card}
                  hovered={hoveredCardId === hoverId}
                  onHoverStart={() => {
                    setHoveredCardId(hoverId);
                    maybeTriggerShimmer(hoverId);
                  }}
                  onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
                  onClick={() => setSelectedIndex(index)}
                  ariaLabel={"Select " + getCardDisplayTitle(card)}
                  shimmerActive={shimmerState?.cardId === hoverId}
                  shimmerToken={shimmerState?.token}
                  selected={selectedIndex === index}
                  className={collectionTileWidthClass}
                  wrapperClassName="stagger-item relative flex justify-center"
                  wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                />
              );
            })}
          </div>
        )}

        {isComplete ? (
          <div className="mt-8">
            <Button size="lg" className="min-w-44" onClick={() => onComplete(drafted)}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button
              size="lg"
              className="min-w-44"
              disabled={selectedIndex === null}
              onClick={() => {
                if (selectedIndex === null) return;
                handlePick(choices[selectedIndex]);
                setSelectedIndex(null);
              }}
            >
              Select Card
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
