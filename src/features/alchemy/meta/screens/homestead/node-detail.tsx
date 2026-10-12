import { useEffect, useRef, useState, type Ref } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { HomesteadNodeArtwork } from "./node-artwork";
import { renderTextWithMaterials } from "./helpers";
import { type HomesteadNodeModel } from "./node-model";
import { HomesteadPurchaseSheet } from "./purchase-sheet";

export function HomesteadNodeDetail({
  node,
  inventory,
  onPurchase,
  afterProgressSaved,
  isCurrent,
  titleRef,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  onPurchase: () => boolean;
  afterProgressSaved: (feedback: () => void) => void;
  isCurrent: () => boolean;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const [quote, setQuote] = useState<HomesteadNodeModel | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQuoteLevel, setSavedQuoteLevel] = useState<number | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const shown = saving && quote ? quote : node;
  const complete = shown.level >= shown.maxLevel;
  const awaitingProgress = savedQuoteLevel !== null && node.level <= savedQuoteLevel;
  const nextLines = [
    ...previewChanges(shown.level > 0 || shown.companion ? shown.bonuses : [], shown.nextBonuses),
    ...previewChanges(shown.level > 0 ? shown.production : [], shown.nextProduction),
  ];

  function openOffer() {
    if (pending.current || awaitingProgress || !node.cost) return;
    setQuote(node);
    setError(null);
    setOpen(true);
  }

  function purchase() {
    if (
      pending.current ||
      awaitingProgress ||
      !quote?.cost ||
      quote.level !== node.level ||
      !canAfford(inventory, quote.cost)
    )
      return;
    // Latch synchronously: repeated input can arrive before React commits the
    // pending state, and save acknowledgment may be delayed or retried.
    pending.current = true;
    const accepted = onPurchase();
    if (!accepted) {
      pending.current = false;
      setError("Purchase unavailable. Your materials were not spent.");
      return;
    }
    setSaving(true);
    let acknowledged = false;
    afterProgressSaved(() => {
      if (acknowledged || !mounted.current || !isCurrent()) return;
      acknowledged = true;
      pending.current = false;
      setSaving(false);
      setSavedQuoteLevel(quote.level);
      setOpen(false);
      playUISound(node.companion ? "bond" : "talentUnlock");
    });
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <div>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight text-foreground outline-none"
          >
            {shown.title}
          </h2>
          {shown.discovered && (
            <p
              aria-label={shown.companion ? "Bond progress" : "Upgrade progress"}
              className="mt-1.5 text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {complete ? (shown.companion ? "Max bond" : "Fully upgraded") : shown.companion ? "Bond" : "Level"}{" "}
              {shown.level}/{shown.maxLevel}
            </p>
          )}
        </div>
        <div className={cn("w-full", shown.companion ? "max-w-72" : "max-w-xl")}>
          <HomesteadNodeArtwork node={shown} />
        </div>
        {!shown.discovered ? (
          <p className="text-base text-muted-foreground">Discover this Companion during a Run.</p>
        ) : shown.cost ? (
          <>
            {nextLines.length > 0 && (
              <section
                aria-label={
                  shown.level === 0 && !shown.companion ? "On build" : shown.companion ? "Next bond" : "Next upgrade"
                }
                className="w-full space-y-2"
              >
                <h3 className="text-xs font-medium text-muted-foreground">
                  {shown.level === 0 && !shown.companion ? "On build" : shown.companion ? "Next bond" : "Next upgrade"}
                </h3>
                <div className="space-y-1 text-base leading-relaxed text-foreground/90">
                  {nextLines.map((line, index) => (
                    <p key={index}>{renderTextWithMaterials(line)}</p>
                  ))}
                </div>
              </section>
            )}
            <Button
              variant={node.affordable ? "primary" : "outline"}
              className="min-w-56 gap-2"
              onClick={openOffer}
              disabled={saving || awaitingProgress}
              aria-label={`Review ${node.action.toLowerCase()} for ${node.title}`}
            >
              {node.affordable && <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              {saving ? "Saving…" : shown.action}
            </Button>
          </>
        ) : null}
      </div>
      <HomesteadPurchaseSheet
        open={open}
        quote={quote}
        inventory={inventory}
        saving={saving}
        changed={quote !== null && quote.level !== node.level && !saving}
        error={error}
        onClose={() => setOpen(false)}
        onPurchase={purchase}
      />
    </>
  );
}

function previewChanges(current: string[], next: string[]) {
  const number = /\d+(?:\.\d+)?/g;
  return next.flatMap((line, index) => {
    if (current.includes(line)) return [];
    const previous = current[index];
    // Compare numbers only when the authored wording matches; new mechanics
    // retain their complete description.
    if (!previous || previous.replace(number, "#") !== line.replace(number, "#")) return [line];
    const values = previous.match(number) ?? [];
    let valueIndex = 0;
    return [
      line.replace(number, (value) => {
        const before = values[valueIndex++];
        return before === value ? value : `${before} → ${value}`;
      }),
    ];
  });
}
