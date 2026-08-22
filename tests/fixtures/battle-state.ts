// Typed persisted-battle-snapshot fixture shared by unit and E2E suites.
// Type-only imports keep this file free of @/lib/battle runtime (and its webp
// asset barrel), so Playwright specs can import it without loading game art.
import type { BattleState } from "@/lib/battle/types";
import type { BestiaryEntry } from "@/lib/game-data/types";

// Fields the app deep-merges with defaults on resume (normalizePersistedBattleState),
// so injected snapshots only need the keys under test.
type ResumeMergedFields =
  | "trinketEffects"
  | "gearEffects"
  | "talentEffects"
  | "flags"
  | "playerStatuses"
  | "enemyStatuses"
  | "playerCC"
  | "enemyCC"
  | "enemyMitigation"
  | "currentEnemy";

/** Wire shape of a persisted BattleState snapshot (JSON-safe, manifests may be partial). */
export type InjectedBattleState = Partial<Omit<BattleState, ResumeMergedFields>> & {
  [K in ResumeMergedFields]?: Partial<BattleState[K]>;
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

/** Common mid-combat goblin snapshot; per-flow differences pass as overrides. */
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
