// Barrel re-exports for E2E helpers (implementation lives under tests/e2e/,
// shared pure fixtures under tests/fixtures/).
export { SAVE_KEY } from "@/lib/game-constants";
export * from "./e2e/armory";
export { makeGoblinBattleState } from "./fixtures/battle-state";
export * from "./e2e/battle-setup";
export * from "./e2e/cards";
export * from "./e2e/errors";
export * from "./e2e/layout-assertions";
export * from "./e2e/navigation";
export * from "./e2e/rng";
export * from "./e2e/run-end";
export * from "./e2e/save-injection";
export * from "./e2e/types";
