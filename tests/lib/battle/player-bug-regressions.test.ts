import { describe, expect, it } from "vitest";
import { cardById, companionLibrary } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveCardEffectChain } from "@/lib/battle/card-play-effects";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("player combat regressions", () => {
  it.each(["second-wind", "divine-aegis"])("Icy Heart triggers %s on crossing half Health", (id) => {
    const state = patchBattleState({
      enemyHealth: 54,
      enemyMaxHealth: 100,
      enemyStatuses: { freeze: 100 },
      currentEnemy: { traits: [{ id, title: id, description: "" }] },
      trinketEffects: { frozenHeartDamage: 6 },
    });
    const result = tryTriggerEnemyFreeze(state, state, []);
    expect(id === "second-wind" ? result.flags.secondWindTriggered : result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyHealth).toBe(id === "second-wind" ? 68 : 48);
  });

  it("Mana Flare adds Burn buildup and decays enemy Armor", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      maxMana: 4,
      enemyMitigation: { armor: 3 },
      talentEffects: { burnDamageOnManaCrystalLoss: 3 },
    });
    const card = makeTestCard({ effects: [{ kind: "lose-max-mana", amount: 1 }] });
    const result = applyCardEffects(state, card, []);
    expect(result.enemyHealth).toBe(97);
    expect(result.enemyStatuses.burn).toBe(3);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it.each(["pack-tactics", "wolf-companion"])(
    "Hunter's Bond limits repeated, resumed and automatic %s plays to one draw each turn",
    (id) => {
      const card = { ...cardById[id]!, uid: 1 };
      const state = patchBattleState({
        hand: [card],
        deck: [makeTestCard({ id: "draw-a" }), makeTestCard({ id: "draw-b" })],
        enemyHealth: 100,
        enemyMaxHealth: 100,
        mana: 5,
        maxMana: 5,
        activeCompanion: companionLibrary.wolf,
        talentEffects: { drawOnCompanionCard: 1 },
        flags: { playNextCardTwice: true },
        rng: () => 0.99,
      });
      const result = playBattleCardResolved(state, id, 0).state;
      expect(result.hand).toHaveLength(1);
      expect(result.deck).toHaveLength(1);
      expect(state.flags.huntersBondUsedThisTurn).toBe(false);
      const restored = {
        ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(result))),
        rng: () => 0.99,
      };
      const second = playBattleCardResolved(
        { ...restored, hand: [...restored.hand, { ...card, uid: 2 }] },
        id,
        1,
      ).state;
      expect(second.hand).toHaveLength(1);
      expect(second.deck).toHaveLength(1);
      const automatic = resolveCardEffectChain(second, card, []).state;
      expect(automatic.hand).toHaveLength(1);
      expect(automatic.deck).toHaveLength(1);
      const nextTurn = advanceToPlayerTurn(automatic);
      const refreshed = playBattleCardResolved(
        { ...nextTurn, hand: [card], deck: [makeTestCard({ id: "next-draw" })], discard: [] },
        id,
        0,
      ).state;
      expect(refreshed.hand).toEqual([expect.objectContaining({ id: "next-draw" })]);
      expect(refreshed.deck).toEqual([]);
    },
  );

  it("Thunderstone cannot reward damage after Stun gear kills the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 100 },
      mana: 0,
      gearEffects: { damageOnStunPhysical: 5, manaOnNatureDamageChance: 100 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
    });
    const result = resolveStunTrigger(state, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.mana).toBe(0);
  });
});
