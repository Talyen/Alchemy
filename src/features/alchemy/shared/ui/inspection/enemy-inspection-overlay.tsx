import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
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
  useGameTranslation();
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
        <h3 className="font-sans text-xl font-semibold">{gameText("ui.enemy-inspection-overlay.1", "Traits")}</h3>
        <EnemyTraits
          enemyDescriptionContext={enemyDescriptionContext}
          layout="inspection"
          entry={entry}
          {...(modifiers ? { modifiers } : {})}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xl font-semibold">{gameText("ui.enemy-inspection-overlay.2", "Abilities")}</h3>
        <InspectionCardGrid cards={cards} descriptionContext={{}} resetKey={`${entry.id}:${open}`} sort={false} />
      </section>
    </div>
  );
}

export function EnemyInspectionOverlay(props: EnemyInspectionProps) {
  useGameTranslation();
  const heldEntry = useHeldWhile(props.open, props.entry);
  return (
    <InspectionOverlayShell
      open={props.open}
      escapeId="enemy-inspection"
      testId="enemy-inspection-overlay"
      title={displayText(heldEntry.title)}
      closeLabel={gameText("ui.enemy-inspection-overlay.attr1", "Close enemy inspection")}
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
