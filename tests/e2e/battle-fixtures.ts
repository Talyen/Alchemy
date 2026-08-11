// Deterministic goblin battle fixture for E2E save injection.
// Deliberately free of runtime battle imports so Playwright never loads game
// art during test discovery (see mid-combat-save.ts). Shared by defeat,
// Death's Door grace, and mid-combat resume flows.
const GOBBLIN_ENEMY = {
  id: "goblin",
  title: "Goblin",
  subtitle: "",
  descriptionLines: [],
  art: "goblin.webp",
  enemyType: "normal",
  traits: [],
  attackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
} as const;

/** Common mid-combat goblin battle state; per-flow differences pass as overrides. */
export function makeGoblinBattleState(overrides: Record<string, unknown> = {}) {
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
    currentEnemy: GOBBLIN_ENEMY,
    enemyAttackEffects: GOBBLIN_ENEMY.attackEffects,
    playerStatuses: {},
    enemyStatuses: {},
    flags: {},
    discoveredCardIds: ["slash"],
    difficultyModifiers: [],
    trinketEffects: {},
    ...overrides,
  };
}
