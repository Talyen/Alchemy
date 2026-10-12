import { useEffect, useRef, useState, type Ref } from "react";
import { ArrowUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { HomesteadArtwork } from "./gallery-node";
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
  const [bonusView, setBonusView] = useState<"current" | "next">("current");
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
  const canPreviewNext = shown.cost !== null && (shown.level > 0 || shown.companion);
  const previewNext = canPreviewNext && bonusView === "next";

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
      setBonusView("current");
      playUISound(node.companion ? "bond" : "talentUnlock");
    });
  }

  return (
    <>
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 py-4 md:grid-cols-2 md:gap-12 md:py-10">
        <div
          className={cn(
            "mx-auto w-full overflow-hidden rounded-xl border border-border/60 shadow-lg",
            shown.companion ? "max-w-72" : "max-w-xl",
          )}
        >
          <HomesteadArtwork node={shown} />
        </div>
        <div className="w-full min-w-0">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">{shown.category}</p>
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="mt-2 text-3xl font-semibold tracking-tight text-foreground outline-none"
          >
            {shown.title}
          </h2>
          {!shown.discovered ? (
            <p className="mt-6 text-base text-muted-foreground">Discover this Companion during a Run.</p>
          ) : (
            <>
              <div className="mt-6">
                <div className="mb-2.5 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {complete
                      ? shown.companion
                        ? "Max bond"
                        : "Fully upgraded"
                      : shown.companion
                        ? "Bond"
                        : "Progress"}
                  </span>
                  <span className="tabular-nums">
                    {shown.level} of {shown.maxLevel}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={shown.companion ? "Bond progress" : "Upgrade progress"}
                  aria-valuenow={shown.level}
                  aria-valuemin={0}
                  aria-valuemax={shown.maxLevel}
                  className="flex gap-1.5"
                >
                  {Array.from({ length: shown.maxLevel }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none",
                        index < shown.level ? "bg-gold-pale" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
              </div>
              {shown.cost ? (
                <Button
                  variant="outline"
                  className="mt-5 w-full justify-between px-4"
                  onClick={openOffer}
                  disabled={saving || awaitingProgress}
                  aria-label={`Review ${node.action.toLowerCase()} for ${node.title}`}
                >
                  <span className="flex items-center gap-2">
                    {node.affordable && <ArrowUp className="h-4 w-4 text-gold-pale" aria-hidden="true" />}
                    {saving ? "Saving…" : shown.action}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    {node.affordable && !saving ? <span className="text-gold-pale">Available</span> : null}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Button>
              ) : null}
              <div className="mt-8 space-y-7" aria-live="polite" aria-atomic="true">
                {canPreviewNext && (
                  <div role="group" aria-label="Bonus preview" className="flex gap-5">
                    {(["current", "next"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        aria-pressed={bonusView === view}
                        onClick={() => setBonusView(view)}
                        className={cn(
                          "min-h-11 border-b px-1 text-sm transition-colors",
                          bonusView === view
                            ? "border-gold-pale text-gold-pale"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {view === "current" ? "Current" : shown.companion ? "Next bond" : "Next upgrade"}
                      </button>
                    ))}
                  </div>
                )}
                <Benefits
                  title={shown.companion ? "Abilities" : "Bonuses"}
                  lines={previewNext ? shown.nextBonuses : shown.bonuses}
                  preview={shown.level === 0 && !shown.companion}
                />
                <Benefits
                  title="Production"
                  lines={previewNext ? shown.nextProduction : shown.production}
                  preview={shown.level === 0}
                />
              </div>
            </>
          )}
        </div>
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

function Benefits({ title, lines, preview }: { title: string; lines: string[]; preview: boolean }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{title}</h3>
        {preview && <span className="text-xs text-muted-foreground/70">On build</span>}
      </div>
      <div className="space-y-2 text-base leading-relaxed text-foreground/90">
        {lines.map((line, index) => (
          <p key={index}>{renderTextWithMaterials(line)}</p>
        ))}
      </div>
    </section>
  );
}
