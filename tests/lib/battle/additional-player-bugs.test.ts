import { describe, expect, it } from "vitest";
import { tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import type { CombatTextEvent } from "@/lib/battle/types";
import { cardById } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("additional player-facing regressions", () => {
  it.each(["stun", "freeze"] as const)("Iron Guard rewards Physical damage from %s gear", (status) => {
    const state = patchBattleState({
      rng: () => 0,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { [status]: 100 },
      talentEffects: { armorOnPhysicalDamageChance: 100 },
      gearEffects: {
        damageOnStunPhysical: status === "stun" ? 6 : 0,
        damageOnFreezePhysical: status === "freeze" ? 6 : 0,
      },
    });
    const next = status === "stun" ? resolveStunTrigger(state, []) : tryTriggerEnemyFreeze(state, state, []);
    expect(next.enemyHealth).toBe(94);
    expect(next.playerStatuses.armor).toBe(6);
  });

  it("Icy Heart damage decays enemy Armor", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 3 },
      trinketEffects: { frozenHeartDamage: 6 },
    });
    const next = tryTriggerEnemyFreeze(state, { ...state, enemyStatuses: { ...state.enemyStatuses, freeze: 100 } }, []);
    expect(next.enemyHealth).toBe(94);
    expect(next.enemyMitigation.armor).toBe(2);
  });

  it("equipping multiple Spellrending items still Purges one benefit on the first paid card", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "heal", amount: 1 }] });
    const state = patchBattleState({
      hand: [card],
      mana: 2,
      playerHealth: 20,
      gearEffects: { purgeOnFirstPaidCard: 2 },
      enemyMitigation: { armor: 3, block: 4 },
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyMitigation.armor).toBe(0);
    expect(next.enemyMitigation.block).toBe(4);
    expect(next.flags.spellrendingUsedThisTurn).toBe(true);
  });

  it("Stun Insight reports its card draw", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 100 },
      talentEffects: { drawOnStun: 1 },
      deck: [makeTestCard()],
    });
    const texts: CombatTextEvent[] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.hand).toHaveLength(1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 1 });
  });

  it.each([0, MAX_HAND_SIZE])("Runic Quill reports its draw with %i cards already in hand", (handSize) => {
    const card = { ...cardById["health-potion"]! };
    const state = patchBattleState({
      hand: Array.from({ length: handSize }, () => makeTestCard()),
      deck: [makeTestCard()],
      trinketEffects: { runicQuillDrawOnConsume: 1 },
    });
    const texts: CombatTextEvent[] = [];
    const next = handlePostPlayCardDestination(state, card, { combatTexts: texts });
    expect(next.hand.length + next.pendingHandCards.length).toBe(handSize + 1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 1 });
  });
});
