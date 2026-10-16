import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import type { CombatTextEvent } from "@/lib/battle/types";
import { STUN_THRESHOLD_FRACTION, FREEZE_THRESHOLD_FRACTION } from "@/lib/game-constants";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("effect resolution boundaries", () => {
  it.each(["stun", "freeze"] as const)("resolves self-inflicted %s before the next effect cleanses it", (status) => {
    const threshold = 100 * (status === "stun" ? STUN_THRESHOLD_FRACTION : FREEZE_THRESHOLD_FRACTION);
    const card = makeTestCard({
      effects: [
        { kind: "self-damage", damageType: status, amount: 1 },
        { kind: "remove-player-status", status },
      ],
    });
    const state = patchBattleState({
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { [status]: threshold - 1 },
      gearEffects: { armorOnStunOrFreeze: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyCardEffects(state, card, texts);
    expect(next.playerHealth).toBe(99);
    expect(next.playerCC[status === "stun" ? "stunSkipTurns" : "freezeSkipTurns"]).toBeGreaterThan(0);
    expect(next.playerStatuses[status]).toBe(0);
    expect(next.playerStatuses.armor).toBe(3);
    expect(texts).toContainEqual(expect.objectContaining({ target: "player", kind: "notice", stat: status }));
    expect(state.playerStatuses[status]).toBe(threshold - 1);
  });

  it("settles fatal retaliation inside an enemy Chance before its next nested effect", () => {
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 1,
          successEffects: [
            { kind: "remove-enemy-armor", amount: 1 },
            { kind: "heal", amount: 8 },
          ],
          failureEffects: [],
        },
      ],
    });
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 30,
      deathsDoorUsed: true,
      enemyHealth: 10,
      enemyMaxHealth: 20,
      playerStatuses: { armor: 1 },
      gearEffects: { stunOnArmorLostToAttack: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyEnemyAbility(state, card, texts);
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(9);
    expect(next.flags.pendingCinderSkinReaction).toBe(false);
    expect(texts.some((event) => event.target === "enemy" && event.kind === "heal")).toBe(false);
  });

  it("keeps fixed Potion durations while scaling its defensive magnitude", () => {
    const card = makeTestCard({
      id: "health-potion",
      consume: true,
      effects: [
        { kind: "player-status", status: "haste", amount: 5 },
        { kind: "player-status", status: "phoenixFeather", amount: 5 },
        { kind: "player-status", status: "armor", amount: 5 },
      ],
    });
    const state = patchBattleState({ talentEffects: { potionPotency: 1.2 } });
    const next = applyCardEffects(state, card, []);
    expect(next.playerStatuses.haste).toBe(5);
    expect(next.playerStatuses.phoenixFeather).toBe(5);
    expect(next.playerStatuses.armor).toBe(6);
  });

  it("scales flat Potion Armor removal while keeping percentage removal fixed", () => {
    const potion = makeTestCard({
      id: "health-potion",
      consume: true,
      effects: [{ kind: "remove-enemy-armor", amount: 5 }],
    });
    const state = patchBattleState({
      enemyMitigation: { armor: 20 },
      talentEffects: { potionPotency: 1.2 },
    });
    const texts: CombatTextEvent[] = [];
    expect(applyCardEffects(state, potion, texts).enemyMitigation.armor).toBe(14);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "armor", amount: 6 }));
    expect(
      applyCardEffects(state, { ...potion, effects: [{ kind: "remove-enemy-armor", halve: true }] }, []).enemyMitigation
        .armor,
    ).toBe(10);
  });
});
