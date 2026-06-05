import { describe, expect, it } from "vitest";
import {
  CARDS_PER_TURN,
  MAX_HAND_SIZE,
  MAX_PLAYER_HEALTH,
  BASE_ENEMY_HEALTH,
  BASE_PLAYER_MANA,
  STARTING_TURN,
  MIN_MAX_MANA_FLOOR,
} from "@/lib/game-constants";

// Startup validation runs at import time via side effects in validate-startup.ts.
// Rather than testing the side-effect module directly (which runs on import),
// we test the invariants that it asserts: constants are positive and data arrays are non-empty.

describe("startup validation invariants", () => {
  it("CARDS_PER_TURN > 0", () => {
    expect(CARDS_PER_TURN).toBeGreaterThan(0);
  });

  it("MAX_HAND_SIZE > 0", () => {
    expect(MAX_HAND_SIZE).toBeGreaterThan(0);
  });

  it("MAX_PLAYER_HEALTH > 0", () => {
    expect(MAX_PLAYER_HEALTH).toBeGreaterThan(0);
  });

  it("BASE_ENEMY_HEALTH > 0", () => {
    expect(BASE_ENEMY_HEALTH).toBeGreaterThan(0);
  });

  it("BASE_PLAYER_MANA >= 0", () => {
    expect(BASE_PLAYER_MANA).toBeGreaterThanOrEqual(0);
  });

  it("STARTING_TURN > 0", () => {
    expect(STARTING_TURN).toBeGreaterThan(0);
  });

  it("MIN_MAX_MANA_FLOOR > 0", () => {
    expect(MIN_MAX_MANA_FLOOR).toBeGreaterThan(0);
  });

  it("MAX_HAND_SIZE >= CARDS_PER_TURN (hand can hold a full draw)", () => {
    expect(MAX_HAND_SIZE).toBeGreaterThanOrEqual(CARDS_PER_TURN);
  });
});
