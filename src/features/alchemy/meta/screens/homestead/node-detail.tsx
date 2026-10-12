import { useEffect, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { playUISound } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { DisabledTooltip } from "../../../shared/ui/tooltips/disabled-tooltip";
import { HomesteadNodeArtwork } from "./node-artwork";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadNodeDetail({
  node,
  inventory,
  onPurchase,
  afterProgressSaved,
  isCurrent,
  detailRef,
}: {
  node: HomesteadNodeModel;
  inventory: MaterialInventory;
  onPurchase: () => boolean;
  afterProgressSaved: (feedback: () => void) => void;
  isCurrent: () => boolean;
  detailRef: Ref<HTMLDivElement>;
}) {
  const [purchaseState, setPurchaseState] = useState<{ node: HomesteadNodeModel; saved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const submittedLevel = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const saving = purchaseState !== null && !purchaseState.saved;
  const shown = saving ? purchaseState.node : node;
  const awaitingProgress = purchaseState !== null && node.level <= purchaseState.node.level;
  const materials = MATERIAL_IDS.filter((material) => (shown.cost?.[material] ?? 0) > 0);
  const affordable = node.cost !== null && canAfford(inventory, node.cost);
  const costLabel = materials.map((material) => `${shown.cost![material]} ${materialLabels[material]}`).join(", ");

  function purchase() {
    if (
      pending.current ||
      (submittedLevel.current !== null && node.level <= submittedLevel.current) ||
      !node.cost ||
      !affordable
    )
      return;
    // Latch both the pending save and the accepted tier synchronously. A save
    // callback may run inline, before React has rendered the purchased level.
    pending.current = true;
    const accepted = onPurchase();
    if (!accepted) {
      pending.current = false;
      setError("Purchase unavailable. Your materials were not spent.");
      return;
    }
    submittedLevel.current = node.level;
    setPurchaseState({ node, saved: false });
    setError(null);
    let acknowledged = false;
    afterProgressSaved(() => {
      if (acknowledged || !mounted.current || !isCurrent()) return;
      acknowledged = true;
      pending.current = false;
      setPurchaseState({ node, saved: true });
      playUISound(node.companion ? "bond" : "talentUnlock");
    });
  }

  return (
    <div
      ref={detailRef}
      role="group"
      aria-label={`${shown.title} details`}
      aria-busy={saving}
      tabIndex={-1}
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center outline-none"
    >
      <div className={cn("w-full", shown.companion ? "max-w-72" : "max-w-xl")}>
        <HomesteadNodeArtwork node={shown} />
      </div>
      {shown.cost && (
        <DisabledTooltip show={!affordable && !saving} message="More materials needed">
          <Button
            variant="primary"
            className="min-w-56 gap-5"
            onClick={purchase}
            disabled={saving || awaitingProgress || !affordable}
            aria-label={saving ? `Saving ${shown.title}` : `${shown.action} ${shown.title} for ${costLabel}`}
          >
            <span aria-live="polite">{saving ? "Saving…" : shown.action}</span>
            <span className="inline-flex items-center gap-3" aria-hidden="true">
              {materials.map((material) => (
                <span key={material} className="inline-flex items-center gap-1.5 tabular-nums">
                  <HomesteadResourceArtwork resource={material} alt="" />
                  <span>{shown.cost![material]}</span>
                </span>
              ))}
            </span>
          </Button>
        </DisabledTooltip>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
