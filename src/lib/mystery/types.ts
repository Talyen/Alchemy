import type { KeywordId } from "@/lib/game-data";
import type { MaterialId } from "@/lib/homestead/types";

export type MysteryEffect =
  | { kind: "addCard"; cardId: string }
  | { kind: "chooseCard"; tag?: KeywordId }
  | { kind: "healHealth"; amount: number }
  | { kind: "gainGold"; amount: number }
  | { kind: "gainXP"; keyword: KeywordId; amount: number }
  | { kind: "gainTrinket"; trinketId: string }
  | { kind: "gainRandomGear" }
  | { kind: "gainGeneratedGear"; baseItemId: string; astral?: true }
  | { kind: "gainMaterial"; material: MaterialId; amount: number };

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
