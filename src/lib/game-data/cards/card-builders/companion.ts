import { companionLibrary } from "../../companions";
import type { BattleCard, CompanionId } from "../../types";
import { expectedCompanionTurnLine } from "../companion-turn-description";
import { deriveTitle, type CardBaseInput } from "./shared";

type SummonCompanionCardInput = CardBaseInput & {
  companionId: CompanionId;
};

export function summonCompanionCard({ id, title, art, companionId, cost = 1 }: SummonCompanionCardInput): BattleCard {
  const turnEffects = companionLibrary[companionId].turnStartEffects;
  if (turnEffects.length !== 1) {
    throw new Error(
      `Companion ${companionId} must have exactly one turn-start effect for summon card ${id} (got ${turnEffects.length})`,
    );
  }
  const turnEffect = turnEffects[0]!;
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [expectedCompanionTurnLine(turnEffect), "Companion"],
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}
