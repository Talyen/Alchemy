import { initializeShopForTest } from "../../../../helpers/visit-initialization";
import { describe, expect, it } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { completeResearch, constructBuilding } from "@/features/alchemy/shared/stores/meta-commands";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { applyTalentState, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage";
import { readActivityData } from "@/lib/active-run-session";
import { cardById } from "@/lib/game-data";
import { ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, SHOP_CARD_PRICE, SHOP_REMOVE_PRICE } from "@/lib/game-constants";

describe("shop session ownership", () => {
  it.each(["merchant", "alchemist"] as const)(
    "retained %s commands use current Talents after unlock and reset",
    async (kind) => {
      const session = createGameSession({ initialSave: { ...createDefaultSaveData(), gold: 500 } });
      const other = createGameSession({ initialSave: { ...createDefaultSaveData(), gold: 500 } });
      try {
        const actions = createShopActions(session);
        const otherActions = createShopActions(other);
        initializeShopForTest(kind, session);
        initializeShopForTest(kind, other);
        const quote = kind === "merchant" ? actions.merchant.getCardBuyPrice : actions.alchemist.getPotionBuyPrice;
        const buy = kind === "merchant" ? actions.merchant.buyCard : actions.alchemist.buyPotion;
        const otherQuote =
          kind === "merchant" ? otherActions.merchant.getCardBuyPrice : otherActions.alchemist.getPotionBuyPrice;
        const cards =
          kind === "merchant"
            ? readActivityData(readRunSession(session).activity, "shop").cards
            : readActivityData(readRunSession(session).activity, "alchemist").potions;
        const basePrice = kind === "merchant" ? SHOP_CARD_PRICE : ALCHEMIST_POTION_PRICE;
        const first = cards[0]!;
        const second = cards[1]!;
        dispatchRunSessionCommand(
          (draft) => acceptCommand(applyTalentState(draft, {}, { gold: ["gold-shop-discount"] })),
          undefined,
          session,
        );
        expect(quote(first)).toBe(basePrice - 5);
        expect(buy(first, shopItemSlotKey(first.id, 0))).toBe(true);
        expect(readRunProfile(session).gold).toBe(500 - (basePrice - 5));
        expect(otherQuote(first)).toBe(basePrice);
        expect(readRunProfile(other).gold).toBe(500);

        dispatchRunSessionCommand((draft) => acceptCommand(applyTalentState(draft, {}, {})), undefined, session);
        expect(quote(second)).toBe(basePrice);
        expect(buy(second, shopItemSlotKey(second.id, 1))).toBe(true);
        expect(readRunProfile(session).gold).toBe(500 - (basePrice - 5) - basePrice);
      } finally {
        await session.dispose();
        await other.dispose();
      }
    },
  );

  it.each(["merchant", "alchemist"] as const)(
    "retained %s services combine current Talent and Homestead discounts",
    async (kind) => {
      const initialSave = createDefaultSaveData();
      initialSave.gold = 500;
      initialSave.materialInventory = { ...initialSave.materialInventory, wood: 100, gems: 100, herbs: 100 };
      const session = createGameSession({ initialSave });
      try {
        const actions = createShopActions(session);
        dispatchRunSessionCommand(
          (draft) => acceptCommand(setRunDeck(draft, [cardById["health-potion"]!, cardById["mana-potion"]!])),
          undefined,
          session,
        );
        initializeShopForTest(kind, session);
        const quote = kind === "merchant" ? actions.merchant.getRemoveCardPrice : actions.alchemist.getMixPrice;
        const basePrice = kind === "merchant" ? SHOP_REMOVE_PRICE : ALCHEMIST_MIX_PRICE;
        expect(quote()).toBe(basePrice);

        expect(
          kind === "merchant"
            ? constructBuilding("library", session)
            : completeResearch("botanical-distillation", session),
        ).toBe(true);
        dispatchRunSessionCommand(
          (draft) =>
            acceptCommand(
              applyTalentState(
                draft,
                {},
                { gold: [kind === "merchant" ? "gold-remove-discount" : "gold-mix-discount"] },
              ),
            ),
          undefined,
          session,
        );
        expect(quote()).toBe(basePrice - 12);
        const useService = () =>
          kind === "merchant" ? actions.merchant.removeCard(0) : actions.alchemist.strengthenPotion(0) !== null;
        expect(useService()).toBe(true);
        expect(readRunProfile(session).gold).toBe(500 - (basePrice - 12));
        expect(useService()).toBe(false);
        expect(readRunProfile(session).gold).toBe(500 - (basePrice - 12));
      } finally {
        await session.dispose();
      }
    },
  );
});
