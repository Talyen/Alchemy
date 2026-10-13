import { getEncounterEnemyAbility, type EnemyDescriptionContext } from "@/lib/battle";
import { useMemo, type RefObject } from "react";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getEnemyAbilities, type BestiaryEntry } from "../../config/game-data-catalog";
import { InspectionCardGrid, InspectionOverlayShell } from "./inspection-content";
import { EnemyTraits } from "../enemy-traits";
import { useHeldWhile } from "../use-fade";

interface EnemyInspectionProps {
  open: boolean;
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  entry: BestiaryEntry;
  modifiers?: readonly EncounterCombatTraitId[];
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function EnemyInspectionContent({
  entry,
  enemyDescriptionContext,
  modifiers,
  open,
}: {
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  entry: BestiaryEntry;
  modifiers?: readonly EncounterCombatTraitId[];
  open: boolean;
}) {
  const cards = useMemo(
    () =>
      getEnemyAbilities(entry).map((card) =>
        enemyDescriptionContext ? getEncounterEnemyAbility(card, enemyDescriptionContext) : card,
      ),
    [entry, enemyDescriptionContext],
  );
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xl font-semibold">Traits</h3>
        <EnemyTraits
          enemyDescriptionContext={enemyDescriptionContext}
          layout="inspection"
          entry={entry}
          {...(modifiers ? { modifiers } : {})}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xl font-semibold">Abilities</h3>
        <InspectionCardGrid cards={cards} descriptionContext={{}} resetKey={`${entry.id}:${open}`} sort={false} />
      </section>
    </div>
  );
}

export function EnemyInspectionOverlay(props: EnemyInspectionProps) {
  const heldEntry = useHeldWhile(props.open, props.entry);
  return (
    <InspectionOverlayShell
      open={props.open}
      escapeId="enemy-inspection"
      testId="enemy-inspection-overlay"
      title={heldEntry.title}
      closeLabel="Close enemy inspection"
      onClose={props.onClose}
      returnFocusRef={props.returnFocusRef}
    >
      <EnemyInspectionContent
        key={heldEntry.id}
        entry={heldEntry}
        enemyDescriptionContext={props.enemyDescriptionContext}
        open={props.open}
        {...(props.modifiers ? { modifiers: props.modifiers } : {})}
      />
    </InspectionOverlayShell>
  );
}
