// Mystery event effect schemas for non-combat route nodes.
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
  | { kind: "removeCard"; mode: "random" | "choose" }
  | { kind: "gainTrinket"; trinketId: string }
  | { kind: "gainRandomTrinket" }
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
