import { companionLibrary } from "../../companions";
import type { BattleCard, CompanionId } from "../../types";
import { expectedCompanionTurnLine } from "../companion-turn-description";
import { deriveTitle, type CardBaseInput } from "./shared";

type SummonCompanionCardInput = CardBaseInput & {
  companionId: CompanionId;
};

export function summonCompanionCard({ id, title, art, companionId, cost = 1 }: SummonCompanionCardInput): BattleCard {
  const turnEffects = companionLibrary[companionId].turnStartEffects;
  if (turnEffects.length === 0) {
    throw new Error(`Companion ${companionId} must have at least one turn-start effect for summon card ${id}`);
  }
  const descriptionLines = turnEffects.map((effect) => expectedCompanionTurnLine(effect));
  descriptionLines.push("Companion");
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}
