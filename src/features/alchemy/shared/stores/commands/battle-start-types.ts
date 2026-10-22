import type { CombatTextEvent } from "@/lib/battle";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import type { DifficultyModifier } from "@/lib/game-data";

export interface BattleStarted {
  startingTexts: CombatTextEvent[];
  companionId: string | null;
  outcome: "victory" | "defeat" | null;
  openingCardIds: string[];
}

export interface BattleStartOptions {
  enemyType?: "normal" | "elite" | undefined;
  modifiers?: DifficultyModifier[] | undefined;
  enemyId?: string | undefined;
}

export type BossBattleStartOptions = Pick<BattleStartOptions, "modifiers" | "enemyId">;

export interface BossByIdOptions extends Pick<BattleStartOptions, "modifiers"> {
  bossId: string;
  wildwoodModifierId?: WildwoodModifierId | undefined;
}

export type BattleStartRequest =
  | { kind: "battle"; options: BattleStartOptions }
  | { kind: "boss"; options: BossBattleStartOptions }
  | { kind: "boss-by-id"; options: BossByIdOptions };
