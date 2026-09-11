import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { computeCardPayment } from "@/lib/battle/card-cost-rules";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { prepareTalentCardPlay } from "@/lib/battle/talent-card-play";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState } from "../../fixtures/battle";

describe("card context regressions", () => {
  it("grants the first Burn card discount to Cauterize's utility effects", () => {
    const card = cardById.cauterize!;
    const state = patchBattleState({
      mana: 0,
      hand: [card],
      playerStatuses: { poison: 2 },
      gearEffects: { firstElementalCardsFree: 1 },
    });
    expect(computeCardPayment(state, card)).toMatchObject({ effectiveCost: 0, affordable: true });
    const played = playBattleCardResolved(state, card.id, 0).state;
    expect(played.playerStatuses.poison).toBe(0);
    expect(played.uniqueGear.freeBurnUsed).toBe(true);
  });

  it.each(["bread", "avatar", "concussive-shot"])(
    "%s retains Consume and Archery bonuses in delayed effects after saving",
    (id) => {
      const card = cardById[id]!;
      const state = patchBattleState({
        rng: () => 0.99,
        hand: [card],
        playerHealth: 5,
        playerMaxHealth: 100,
        enemyHealth: 200,
        enemyMaxHealth: 200,
        talentEffects: { consumeHealMultiplier: 0.2, consumeDamageBonusPercent: 20, flatArrowDamage: 2 },
      });
      const played = playBattleCardResolved(state, card.id, 0).state;
      const resumed = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(played)));
      const next = advanceToPlayerTurn({ ...resumed, currentEnemy: played.currentEnemy, rng: () => 0.99 });
      if (id === "bread") {
        expect(next.playerHealth - played.playerHealth).toBe(5);
        expect(advanceToPlayerTurn(next).playerHealth - next.playerHealth).toBe(5);
      } else {
        expect(played.enemyHealth - next.enemyHealth).toBe(id === "avatar" ? 5 : 4);
      }
    },
  );

  it("resumes legacy delayed effects without inventing source-card bonuses", () => {
    const state = patchBattleState({
      playerHealth: 5,
      talentEffects: { consumeHealMultiplier: 0.2 },
      pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "heal", amount: 4 }] }],
    });
    const resumed = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(advanceToPlayerTurn({ ...resumed, rng: () => 0.99 }).playerHealth).toBe(9);
  });

  it("Armor Siphon cannot steal Armor already depleted by Ecosystem", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 1 },
      enemyStatuses: { poison: 2 },
      talentEffects: { armorStealOnLeechCard: 1, poisonOnNatureCardVsPoisoned: 1 },
    });
    const next = prepareTalentCardPlay(state, cardById.bloodthorn!, []).state;
    expect(next.enemyMitigation.armor).toBe(0);
    expect(next.playerStatuses.armor).toBe(0);
  });
});
