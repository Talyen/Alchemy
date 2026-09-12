import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { addPlayerStatus } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("cleansed Bleed Leech", () => {
  it("partial Clean Getaway removal caps pending Leech before fresh Bleed is added", () => {
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 40,
      enemyHealth: 10,
      enemyMaxHealth: 40,
      playerStatuses: { bleed: 4 },
      pendingEnemyBleedLeechHealing: 4,
      talentEffects: { cleanseStacksOnDodge: 2 },
    });
    const cleansed = applyDodgeTalentStatuses(state, []);
    const ticked = tickPlayerStatuses(addPlayerStatus(cleansed, "bleed", 4), []);
    expect(ticked.playerHealth).toBe(24);
    expect(ticked.enemyHealth).toBe(11);
  });

  it.each(["cleanse", "specific", "dodge", "subtract"] as const)(
    "%s removes the enemy's claim on cleansed Bleed before fresh Bleed arrives",
    (source) => {
      const state = patchBattleState({
        rng: () => 0.99,
        playerHealth: 30,
        playerMaxHealth: 40,
        enemyHealth: 10,
        enemyMaxHealth: 40,
        playerStatuses: { bleed: 4 },
        pendingEnemyBleedLeechHealing: 4,
        talentEffects: { cleanseStacksOnDodge: 4 },
      });
      const cleansed =
        source === "subtract"
          ? addPlayerStatus(state, "bleed", -4)
          : source === "dodge"
            ? applyDodgeTalentStatuses(state, [])
            : applyCardEffects(
                state,
                makeTestCard({
                  effects: [
                    source === "cleanse"
                      ? { kind: "remove-harmful-status", amount: 1 }
                      : { kind: "remove-player-status", status: "bleed" },
                  ],
                }),
                [],
              );
      expect(cleansed.playerStatuses.bleed).toBe(0);
      const ticked = tickPlayerStatuses(addPlayerStatus(cleansed, "bleed", 4), []);
      expect(ticked.enemyHealth).toBe(cleansed.enemyHealth);
      expect(ticked.playerHealth).toBe(cleansed.playerHealth - 4);
      expect(state.pendingEnemyBleedLeechHealing).toBe(4);
    },
  );
});
