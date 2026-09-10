import { useMemo, type RefObject } from "react";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getEnemyAbilities, type BestiaryEntry } from "../config/game-data-catalog";
import { InspectionCardGrid, InspectionPanel } from "./inspection-content";
import { EnemyTraits } from "./enemy-traits";
import { ModalOverlayShell } from "./modal-overlay-shell";
import { useHeldWhile } from "./use-fade";

interface EnemyInspectionProps {
  open: boolean;
  entry: BestiaryEntry;
  modifiers?: readonly EncounterCombatTraitId[];
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function EnemyInspectionPanel({ entry, modifiers, onClose, returnFocusRef, open }: EnemyInspectionProps) {
  const cards = useMemo(() => getEnemyAbilities(entry), [entry]);
  return (
    <InspectionPanel
      title={entry.title}
      closeLabel="Close enemy inspection"
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="font-sans text-xl font-semibold">Traits</h3>
          <EnemyTraits layout="inspection" entry={entry} {...(modifiers ? { modifiers } : {})} />
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="font-sans text-xl font-semibold">Abilities</h3>
          <InspectionCardGrid cards={cards} descriptionContext={{}} resetKey={`${entry.id}:${open}`} sort={false} />
        </section>
      </div>
    </InspectionPanel>
  );
}

export function EnemyInspectionOverlay(props: EnemyInspectionProps) {
  const heldEntry = useHeldWhile(props.open, props.entry);
  return (
    <ModalOverlayShell
      open={props.open}
      escapeId="enemy-inspection"
      onClose={props.onClose}
      dismissOnBackdrop
      zIndex={85}
      testId="enemy-inspection-overlay"
      className="flex items-center justify-center p-6"
    >
      <EnemyInspectionPanel key={heldEntry.id} {...props} entry={heldEntry} />
    </ModalOverlayShell>
  );
}
