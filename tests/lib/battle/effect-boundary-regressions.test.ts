import { describe, expect, it } from "vitest";
import { canPlayCard } from "@/lib/battle/card-play";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("effect resolution boundaries", () => {
  it.each(["stun", "freeze"] as const)("activates self-inflicted %s before accepting another card", (damageType) => {
    const followUp = makeTestCard({ id: "follow-up", cost: 0 });
    const state = patchBattleState({ playerHealth: 30, playerMaxHealth: 30, hand: [followUp] });
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType, amount: 15 }] });
    const next = applyCardEffects(state, card, []);
    expect(next.playerHealth).toBe(15);
    expect(next.playerCC[damageType === "stun" ? "stunSkipTurns" : "freezeSkipTurns"]).toBe(1);
    expect(next.playerStatuses[damageType]).toBe(0);
    expect(canPlayCard(next, followUp, 0)).toBe(false);
  });

  it.each(["haste", "phoenixFeather"] as const)("keeps %s duration fixed under Potion potency", (status) => {
    const card = makeTestCard({
      id: "mixed-potion-duration",
      consume: true,
      effects: [{ kind: "player-status", status, amount: 1 }],
    });
    const next = applyCardEffects(patchBattleState({ talentEffects: { potionPotency: 2 } }), card, []);
    expect(next.playerStatuses[status]).toBe(1);
  });

  it("scales fixed Potion Armor removal while preserving Armor-halving rules", () => {
    const state = patchBattleState({ enemyMitigation: { armor: 10 }, talentEffects: { potionPotency: 2 } });
    const card = makeTestCard({
      id: "acid-potion",
      consume: true,
      effects: [{ kind: "remove-enemy-armor", amount: 3 }],
    });
    expect(applyCardEffects(state, card, []).enemyMitigation.armor).toBe(4);
    expect(
      applyCardEffects(state, { ...card, effects: [{ kind: "remove-enemy-armor", halve: true }] }, []).enemyMitigation
        .armor,
    ).toBe(5);
  });

  it("settles fatal Counterplate retaliation before the next effect inside an enemy Chance branch", () => {
    const state = patchBattleState({
      playerHealth: 3,
      playerMaxHealth: 30,
      playerStatuses: { armor: 1 },
      deathsDoorUsed: true,
      enemyHealth: 90,
      enemyMaxHealth: 100,
      roomScalingMultiplier: 4,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      gearEffects: { stunOnArmorLostToAttack: 2 },
      rng: () => 0.99,
    });
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 1,
          successEffects: [
            { kind: "remove-enemy-armor", removeAll: true },
            { kind: "heal", amount: 20 },
          ],
          failureEffects: [],
        },
      ],
    });
    const next = applyEnemyAbility(state, card, []);
    expect(next.playerHealth).toBe(0);
    expect(next.enemyHealth).toBe(88);
  });
});
