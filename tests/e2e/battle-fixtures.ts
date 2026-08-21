// Deterministic goblin battle fixture for E2E save injection.
// Implementation lives in tests/fixtures/battle-state.ts (type-only imports, no
// runtime battle/art loading). Shared by defeat, Death's Door grace, and
// mid-combat resume flows.
export { makeGoblinBattleState, GOBLIN_ENEMY, type InjectedBattleState } from "../fixtures/battle-state";
