import { useGameTranslation } from "@/components/use-game-translation";

import {
  getBattleDamageInspectionCard,
  getEncounterEnemyAbility,
  type BattleSnapshot,
  type EnemyDescriptionContext,
} from "@/lib/battle";
import { useMemo, type RefObject } from "react";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import { getEnemyAbilities, type BestiaryEntry } from "../../config/game-data-catalog";
import type { CardDescriptionContext } from "@/lib/game-data";
import { InspectionCardGrid, InspectionOverlayShell } from "./inspection-content";
import { EnemyTraits } from "../enemy-traits";
import { useHeldWhile } from "../use-fade";

// Enemy ability previews must not inherit the player's card-description context.
// A module constant keeps descendant memoization stable across re-renders.
const EMPTY_DESCRIPTION_CONTEXT: CardDescriptionContext = {};

interface EnemyInspectionProps {
  open: boolean;
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  battleState?: BattleSnapshot | undefined;
  entry: BestiaryEntry;
  modifiers?: readonly EncounterCombatTraitId[];
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function EnemyInspectionContent({
  entry,
  enemyDescriptionContext,
  battleState,
  modifiers,
  open,
}: {
  enemyDescriptionContext?: EnemyDescriptionContext | undefined;
  battleState?: BattleSnapshot | undefined;
  entry: BestiaryEntry;
  modifiers?: readonly EncounterCombatTraitId[];
  open: boolean;
}) {
  const i18n = useGameTranslation();
  const cards = useMemo(
    () =>
      getEnemyAbilities(entry).map((card) =>
        battleState
          ? getBattleDamageInspectionCard(card, battleState, "enemy")
          : enemyDescriptionContext
            ? getEncounterEnemyAbility(card, enemyDescriptionContext)
            : card,
      ),
    [entry, enemyDescriptionContext, battleState],
  );
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xl font-semibold">{i18n.text("ui.enemy-inspection-overlay.1", "Traits")}</h3>
        <EnemyTraits
          enemyDescriptionContext={enemyDescriptionContext}
          layout="inspection"
          entry={entry}
          {...(modifiers ? { modifiers } : {})}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-sans text-xl font-semibold">{i18n.text("ui.enemy-inspection-overlay.2", "Abilities")}</h3>
        <InspectionCardGrid
          cards={cards}
          descriptionContext={EMPTY_DESCRIPTION_CONTEXT}
          resetKey={`${entry.id}:${open}`}
          sort={false}
        />
      </section>
    </div>
  );
}

export function EnemyInspectionOverlay(props: EnemyInspectionProps) {
  const i18n = useGameTranslation();
  const heldEntry = useHeldWhile(props.open, props.entry);
  return (
    <InspectionOverlayShell
      open={props.open}
      escapeId="enemy-inspection"
      testId="enemy-inspection-overlay"
      title={i18n.displayText(heldEntry.title)}
      closeLabel={i18n.text("ui.enemy-inspection-overlay.attr1", "Close enemy inspection")}
      onClose={props.onClose}
      returnFocusRef={props.returnFocusRef}
    >
      <EnemyInspectionContent
        key={heldEntry.id}
        entry={heldEntry}
        battleState={props.battleState}
        enemyDescriptionContext={props.enemyDescriptionContext}
        open={props.open}
        {...(props.modifiers ? { modifiers: props.modifiers } : {})}
      />
    </InspectionOverlayShell>
  );
}
