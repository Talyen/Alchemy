import type { KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

export type MysteryEffect =
  | { kind: "addCard"; cardId: string }
  | { kind: "chooseCard"; tag?: KeywordId }
  | { kind: "healHealth"; amount: number; chance?: number }
  | { kind: "damageHealth"; amount: number }
  | { kind: "gainGold"; amount: number }
  | { kind: "loseGold"; amount: number }
  | { kind: "gainXP"; keyword: KeywordId; amount: number }
  | { kind: "removeCard" }
  | { kind: "gainTrinket"; trinketId: string }
  | { kind: "gainRandomTrinket"; fromIds?: string[] }
  | { kind: "gainRandomGear" }
  | { kind: "gainGeneratedGear"; baseItemId: string; astral?: true }
  | { kind: "gainMaterial"; material: MaterialId; amount: number };

type MysteryEffectKind = MysteryEffect["kind"];

// Canonical kind list shared by effect-order and the exhaustive-switch guard.
// The compile-time assertions below fail if a kind is added without updating
// this tuple, so the test cannot drift from the union.
export const MYSTERY_EFFECT_KINDS = [
  "addCard",
  "chooseCard",
  "healHealth",
  "damageHealth",
  "gainGold",
  "loseGold",
  "gainXP",
  "removeCard",
  "gainTrinket",
  "gainRandomTrinket",
  "gainRandomGear",
  "gainGeneratedGear",
  "gainMaterial",
] as const;

type MissingMysteryKind = Exclude<MysteryEffectKind, (typeof MYSTERY_EFFECT_KINDS)[number]>;
const assertNoMissingKinds: MissingMysteryKind extends never ? true : never = true;
type ExtraMysteryKind = Exclude<(typeof MYSTERY_EFFECT_KINDS)[number], MysteryEffectKind>;
const assertNoExtraKinds: ExtraMysteryKind extends never ? true : never = true;
void assertNoMissingKinds;
void assertNoExtraKinds;

export interface MysteryChoice {
  label: string;
  effects: MysteryEffect[];
}

export interface MysteryEvent {
  id: string;
  title: string;
  art: string;
  narrative: string;
  choices: MysteryChoice[];
}
