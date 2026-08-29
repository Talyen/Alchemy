import { describe, expect, it } from "vitest";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  buildActions,
  createInitialAlchemistState,
  makeCard,
  requiredItem,
  setAlchemistState,
} from "./shop-actions-harness";
import { ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { makeEffect } from "../../../../fixtures/battle";

describe("alchemist shop actions", () => {
  describe("alchemist mix potions", () => {
    it("returns null when mixing two non-potions", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "slash", title: "Slash" }), makeCard({ id: "bash", title: "Bash" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.alchemist.mixPotions(0, 1)).toBeNull();
      expect(readRunProfile().gold).toBe(999);
      expect(readRunSession().alchemistState.mixUsed).toBe(false);
      expect(readActiveRun().runDeck.map((card) => card.id)).toEqual(["slash", "bash"]);
    });
    it("deducts gold, replaces two cards with mixed potion, marks mixUsed", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "a-potion", title: "Potion A" }), makeCard({ id: "b-potion", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      const result = actions.alchemist.mixPotions(0, 1);

      expect(result).not.toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readRunSession().alchemistState.mixUsed).toBe(true);
      expect(readActiveRun().runDeck).toEqual([result]);
    });

    it("adds homestead potionMixPotency onto talent mix potency", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "a-potion", title: "Potion A", effects: [makeEffect("holy", 5)] }),
          makeCard({ id: "b-potion", title: "Potion B", effects: [makeEffect("holy", 5)] }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({
        talentEffects: { potionMixPotency: 1 },
        homesteadEffects: { potionMixPotency: 1 },
      });

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result?.effects).toEqual([
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 7 }),
        expect.objectContaining({ kind: "damage", damageType: "holy", amount: 7 }),
      ]);
    });

    it("returns null for out-of-bounds indices", () => {
      setRunProgress({ gold: 999, runDeck: [makeCard()] });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions();

      expect(actions.alchemist.mixPotions(-1, 0)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 5)).toBeNull();
      expect(actions.alchemist.mixPotions(0, 0)).toBeNull();
    });

    it("does not charge gold or consume the mix slot when the mix fails", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: MIXED_POTION_CARD_ID, title: "Mixed" }),
          makeCard({ id: "b-potion", title: "Potion" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const result = actions.alchemist.mixPotions(0, 1);
      expect(result).toBeNull();
      expect(readRunProfile().gold).toBe(999);
      expect(readRunSession().alchemistState.mixUsed).toBe(false);
    });

    it("prevents a second mix attempt after first succeeds", () => {
      setRunProgress({
        gold: 999,
        runDeck: [makeCard({ id: "a-potion", title: "Potion A" }), makeCard({ id: "b-potion", title: "Potion B" })],
      });
      setAlchemistState(createInitialAlchemistState());
      const firstActions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      const first = firstActions.alchemist.mixPotions(0, 1);
      expect(first).not.toBeNull();
      expect(readRunSession().alchemistState.mixUsed).toBe(true);

      const second = firstActions.alchemist.mixPotions(0, 1);
      expect(second).toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
    });

    it("no-ops a second mix on the same actions instance without double-spending gold", () => {
      setRunProgress({
        gold: 999,
        runDeck: [
          makeCard({ id: "a-potion", title: "Potion A" }),
          makeCard({ id: "b-potion", title: "Potion B" }),
          makeCard({ id: "c-potion", title: "Potion C" }),
          makeCard({ id: "d-potion", title: "Potion D" }),
        ],
      });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionMixPotency: 0 } });

      expect(actions.alchemist.mixPotions(0, 1)).not.toBeNull();
      expect(actions.alchemist.mixPotions(2, 3)).toBeNull();
      expect(readRunProfile().gold).toBe(999 - ALCHEMIST_MIX_PRICE);
      expect(readRunSession().alchemistState.mixUsed).toBe(true);
    });
  });
  describe("talent discounts", () => {
    it("applies potion discount only for standard potions in alchemist", () => {
      setRunProgress({ gold: 999 });
      setAlchemistState(createInitialAlchemistState());
      const actions = buildActions({ talentEffects: { potionDiscount: 5, shopCardDiscount: 3 } });
      const potion = requiredItem(readRunSession().alchemistState.potions[0], "alchemist potion");

      expect(actions.alchemist.getPotionBuyPrice(potion)).toBeLessThanOrEqual(ALCHEMIST_POTION_PRICE - 3);
    });
  });
});
