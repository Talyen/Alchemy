import type { BestiaryEntry, TalentEffectManifest, TrinketManifest } from "@/lib/game-data";
import type {
  BattleState,
  CombatFlags,
  CcState,
  EnemyMitigation,
  EnemyStatusValues,
  PlayerStatusValues,
} from "@/lib/battle/types";
import type { GearEffectManifest } from "@/lib/gear";
import { defaultBattleState, defaultTalentEffects, EMPTY_ENEMY_MITIGATION } from "@/lib/battle";
import { defaultTrinketEffects } from "@/lib/trinkets";

export { defaultTalentEffects };

const template = defaultBattleState();

export function createDefaultBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return { ...defaultBattleState(), ...overrides };
}

export function defaultPlayerStatusValues(overrides?: Partial<PlayerStatusValues>): PlayerStatusValues {
  return { ...template.playerStatuses, ...overrides };
}

export function defaultEnemyStatusValues(overrides?: Partial<EnemyStatusValues>): EnemyStatusValues {
  return { ...template.enemyStatuses, ...overrides };
}

export function defaultEnemyMitigation(overrides?: Partial<EnemyMitigation>): EnemyMitigation {
  return { ...EMPTY_ENEMY_MITIGATION, ...overrides };
}

export function defaultCcState(overrides?: Partial<CcState>): CcState {
  return { ...template.playerCC, ...overrides };
}

export function defaultCombatFlags(overrides?: Partial<CombatFlags>): CombatFlags {
  return { ...template.flags, ...overrides };
}

export function defaultTrinketManifest(overrides?: Partial<import("@/lib/game-data").TrinketManifest>) {
  return { ...defaultTrinketEffects, ...overrides };
}

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
