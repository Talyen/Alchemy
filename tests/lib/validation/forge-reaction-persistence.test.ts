import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { addGoldWithCombatText } from "@/lib/battle/player-rewards";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { deliverPendingHandCards } from "@/lib/battle/draw";
import { cardById } from "@/lib/game-data";

describe("queued Golden Crucible rewards", () => {
  it("resumes a pending Forge threshold reward once without granting Forge again", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 0 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 8 },
      gearEffects: { goldGrantsForgeAndHoly: 1 },
    });
    const queued = addGoldWithCombatText(state, 4, []);
    const saved = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(queued)));
    const result = resolvePendingBattleReactions({ ...saved, rng: state.rng }, []);
    expect(result.playerStatuses.forge).toBe(4);
    expect(result.enemyHealth).toBe(state.enemyHealth - 8);
    expect(result.pendingForgeThresholds).toEqual([]);
    expect(resolvePendingBattleReactions(result, [])).toBe(result);
  });

  it("preserves older battles without a Forge reward queue", () => {
    const { pendingForgeThresholds: _queue, ...legacy } = patchBattleState({ playerHealth: 17, gold: 25 });
    const result = PersistedBattleStateSchema.parse(legacy);
    expect(result.pendingForgeThresholds).toEqual([]);
    expect(result.playerHealth).toBe(17);
    expect(result.gold).toBe(25);
    const execution = { ...result, rng: () => 0.99 };
    expect(resolvePendingBattleReactions(execution, [])).toBe(execution);
  });
});

describe("pending hand cards", () => {
  it("resumes a reserved card once with its UID", () => {
    const card = { ...cardById.slash!, uid: 73 };
    const saved = PersistedBattleStateSchema.parse(
      JSON.parse(JSON.stringify(patchBattleState({ pendingHandCards: [card], deck: [], discard: [], hand: [] }))),
    );
    const delivered = deliverPendingHandCards({ ...saved, rng: () => 0.99 });
    expect(delivered.hand).toEqual([card]);
    expect(delivered.pendingHandCards).toEqual([]);
    expect(deliverPendingHandCards(delivered)).toBe(delivered);
  });

  it("defaults the queue for saves that do not contain it", () => {
    const { pendingHandCards: _queue, ...saved } = patchBattleState();
    expect(PersistedBattleStateSchema.parse(saved).pendingHandCards).toEqual([]);
  });
});
