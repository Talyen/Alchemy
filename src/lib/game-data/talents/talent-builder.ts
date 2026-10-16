import type { KeywordId } from "../types";

export interface HealthThresholdBonus {
  threshold: number;
  amount: number;
}

export interface AdditiveTalentBonus {
  kind: "add";
  amount: number;
}

export type TalentBonus =
  | null
  | number
  | boolean
  | HealthThresholdBonus
  | HealthThresholdBonus[]
  | Record<string, number>
  | AdditiveTalentBonus;

export function add(amount: number): AdditiveTalentBonus {
  return { kind: "add", amount };
}

export function isAdditiveBonus(value: TalentBonus): value is AdditiveTalentBonus {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "add";
}

// Fix the keyword and saved identity before inferring each row's bonus fields.
export function talentFor(keywordId: KeywordId) {
  return (id: string, name: string) =>
    <Effects extends Record<string, TalentBonus>>(icon: string, description: string, effects: Effects) => ({
      id,
      keywordId,
      name,
      icon,
      description,
      effects,
    });
}
