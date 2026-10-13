import { describe, expect, it } from "vitest";
import { defaultTalentEffects } from "@/lib/battle";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { collectKeywordsFromBattleEffect } from "@/lib/game-data/effect-metadata";
import { getBattleCardTransmutationRole } from "@/lib/battle/card-classification";
import { cardById, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("Five targeted bug fixes round 4", () => {
  describe("Runic Quill draws on any Consume, including companion summons", () => {
    it("draws for a companion summon while excluding gear and talent Consume rewards", () => {
      const summonCard: BattleCard = {
        ...cardById["wolf-companion"]!,
        consume: true,
      };
      const slash = cardById["slash"]!;
      const state = patchBattleState({
        deck: [slash],
        hand: [],
        trinketEffects: { runicQuillDrawOnConsume: 1 },
        gearEffects: { armorOnConsume: 2 },
        talentEffects: { healOnConsume: 5 },
        playerHealth: 20,
        playerMaxHealth: 30,
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = handlePostPlayCardDestination(state, summonCard, { combatTexts });

      expect(next.hand).toMatchObject([{ id: slash.id }]);
      expect(next.deck).toHaveLength(0);
      expect(next.playerStatuses.armor).toBe(state.playerStatuses.armor);
      expect(next.playerHealth).toBe(20);
    });

    it("triggers runicQuillDrawOnConsume for an ordinary consumable card", () => {
      const consumeCard = makeTestCard({ consume: true });
      const slash = cardById["slash"]!;
      const state = patchBattleState({
        deck: [slash],
        hand: [],
        trinketEffects: { runicQuillDrawOnConsume: 1 },
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = handlePostPlayCardDestination(state, consumeCard, { combatTexts });

      expect(next.hand.length).toBe(1);
      expect(next.deck.length).toBe(0);
    });
  });

  describe("Lastlight checks Mana at Consume and guards defeated enemies", () => {
    it("does not trigger after the card restores Mana", () => {
      const manaPotion = makeTestCard({
        cost: 0,
        consume: true,
        effects: [{ kind: "restore-mana", amount: 2, allowOverflow: true }],
      });
      const state = patchBattleState({
        mana: 0,
        maxMana: 3,
        hand: [manaPotion],
        enemyHealth: 40,
        enemyMaxHealth: 40,
        gearEffects: { holyOnConsumeWithoutMana: 4 },
        rng: () => 0.99,
      });

      const result = playBattleCardResolved(state, manaPotion.id, 0);
      expect(result.state.mana).toBe(2);
      expect(result.state.enemyHealth).toBe(40);
    });

    it("does not hit a defeated enemy with holyOnConsumeWithoutMana", () => {
      const lethalConsume = makeTestCard({
        cost: 0,
        consume: true,
        effects: [{ kind: "damage", damageType: "physical", amount: 50 }],
      });
      const state = patchBattleState({
        mana: 0,
        hand: [lethalConsume],
        enemyHealth: 10,
        enemyMaxHealth: 40,
        gearEffects: { holyOnConsumeWithoutMana: 4 },
        rng: () => 0.99,
      });

      const result = playBattleCardResolved(state, lethalConsume.id, 0);
      expect(result.state.enemyHealth).toBe(0);
      const holyDamage = result.combatTexts.filter((t) => t.stat === "holy");
      expect(holyDamage.length).toBe(0);
    });
  });

  describe("Bug 4: next-hit-poison presentation metadata includes poison keyword", () => {
    it("returns poison keyword for next-hit-poison effect", () => {
      const keywords = collectKeywordsFromBattleEffect({ kind: "next-hit-poison" });
      expect(keywords).toEqual(["poison"]);
    });
  });

  describe("Bug 5: resolveEnemyAttackHit dodged branch reports post-dodge player health", () => {
    it("reports updated healthAfterHit when dodge triggers healing", () => {
      const state = patchBattleState({
        playerHealth: 30,
        playerMaxHealth: 100,
        flags: { dodgeNextAttack: true },
        talentEffects: { ...defaultTalentEffects, healOnDodge: 10 },
      });
      const combatTexts: CombatTextEvent[] = [];
      const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 8 }, combatTexts, {
        canDodge: true,
      });

      expect(result.dodged).toBe(true);
      expect(result.state.playerHealth).toBe(40);
      expect(result.healthAfterHit).toBe(40);
    });
  });

  describe("Incidental Fix: dodge-next-attack card classification", () => {
    it("classifies cards with dodge-next-attack as defense", () => {
      const dodgeCard = makeTestCard({ effects: [{ kind: "dodge-next-attack" }] });
      expect(getBattleCardTransmutationRole(dodgeCard)).toBe("defense");
      expect(getBattleCardTransmutationRole(cardById["feint"]!)).toBe("defense");
      expect(getBattleCardTransmutationRole(cardById["shadowstep"]!)).toBe("defense");
    });
  });
});
