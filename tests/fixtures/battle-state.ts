import type { BestiaryEntry } from "@/lib/game-data/types";
import type { BattleStatePatch } from "./battle";

export type InjectedBattleState = BattleStatePatch & {
  currentEnemy?: Partial<import("@/lib/battle/types").BattleState["currentEnemy"]>;
};

const GOBLIN_ENEMY: BestiaryEntry = {
  id: "goblin",
  title: "Goblin",
  subtitle: "",
  descriptionLines: [],
  art: "goblin.webp",
  enemyType: "normal",
  traits: [],
  abilityIds: ["stab", "slash", "block"],
};

export function makeGoblinBattleState(overrides: InjectedBattleState = {}): InjectedBattleState {
  return {
    deck: [],
    hand: [],
    discard: [],
    exhausted: [],
    mana: 3,
    maxMana: 3,
    gold: 15,
    turn: 2,
    turnPhase: "player",
    playerHealth: 18,
    playerMaxHealth: 30,
    enemyHealth: 40,
    enemyMaxHealth: 40,
    currentEnemy: GOBLIN_ENEMY,
    lastEnemyAbilityId: null,
    playerStatuses: {},
    enemyStatuses: {},
    flags: {},
    discoveredCardIds: ["slash"],
    difficultyModifiers: [],
    trinketEffects: {},
    ...overrides,
  };
}
