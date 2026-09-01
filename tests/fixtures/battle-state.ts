import type { BestiaryEntry, TalentEffectManifest, TrinketManifest } from "@/lib/game-data";
import type { BattleState, CombatFlags, EnemyStatusValues, PlayerStatusValues } from "@/lib/battle/types";
import type { GearEffectManifest } from "@/lib/gear";

export type InjectedBattleState = Omit<
  Partial<BattleState>,
  "currentEnemy" | "playerStatuses" | "enemyStatuses" | "flags" | "trinketEffects" | "gearEffects" | "talentEffects"
> & {
  currentEnemy?: Partial<BattleState["currentEnemy"]>;
  playerStatuses?: Partial<PlayerStatusValues>;
  enemyStatuses?: Partial<EnemyStatusValues>;
  flags?: Partial<CombatFlags>;
  trinketEffects?: Partial<TrinketManifest>;
  gearEffects?: Partial<GearEffectManifest>;
  talentEffects?: Partial<TalentEffectManifest>;
};

const GOBLIN_ENEMY: BestiaryEntry = {
  id: "goblin",
  title: "Goblin",
  subtitle: "",
  descriptionLines: [],
  art: "goblin.webp",
  enemyType: "normal",
  traits: [],
  attackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
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
    enemyAttackEffects: GOBLIN_ENEMY.attackEffects,
    playerStatuses: {},
    enemyStatuses: {},
    flags: {},
    discoveredCardIds: ["slash"],
    difficultyModifiers: [],
    trinketEffects: {},
    ...overrides,
  };
}
