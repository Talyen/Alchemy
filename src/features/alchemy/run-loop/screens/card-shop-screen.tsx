import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import type { BattleCard } from "@/lib/game-data";

import { RemoveCardPanel } from "../../shared/ui/remove-card-panel";
import { ScreenHeaderRow, ScreenShell } from "../../shared/ui/layout-components";
import { ServiceButton } from "../shop/ui/service-button";
import { ShopShelf, type ShopShelfProps } from "./shop-shelf";
import { FadeSlot } from "../../shared/ui/use-fade";

export function CardShopScreen({
  gold,
  runDeck,
  removeUsed,
  removePrice,
  onRemoveCard,
  isProgressSavePending = () => false,
  ...shelf
}: ShopShelfProps<"card"> & {
  runDeck: BattleCard[];
  removeUsed: boolean;
  removePrice: number;
  onRemoveCard: (cardIndex: number) => boolean;
}) {
  useGameTranslation();
  const [removeMode, setRemoveMode] = useState(false);
  const [removeError, setRemoveError] = useState("");

  return (
    <FadeSlot swapKey={removeMode ? "remove" : "browse"} className="h-full w-full">
      {removeMode ? (
        <div className="flex h-full min-h-0 w-full items-center justify-center px-5 py-7">
          {/* Bound the two-row fitting area in content units while keeping short-window controls reachable. */}
          <ScreenShell className="h-full max-h-[calc(70*var(--content-rem,1rem))] gap-6 overflow-hidden">
            <ScreenHeaderRow title={gameText("ui.card-shop-screen.1", "Remove Card")} />
            {removeError && <p role="alert">{displayText(removeError)}</p>}
            <RemoveCardPanel
              runDeck={runDeck}
              gold={gold}
              removePrice={removePrice}
              fitHeight
              onConfirm={(index) => {
                if (isProgressSavePending()) return;
                if (onRemoveCard(index)) {
                  setRemoveError("");
                  setRemoveMode(false);
                } else setRemoveError("Could not remove this card. Check your Gold and choose a card again.");
              }}
              onCancel={() => {
                setRemoveError("");
                setRemoveMode(false);
              }}
            />
          </ScreenShell>
        </div>
      ) : (
        <ShopShelf
          {...shelf}
          kind="card"
          title={gameText("ui.card-shop-screen.2", "Card Shop")}
          gold={gold}
          isProgressSavePending={isProgressSavePending}
          extraServices={
            <ServiceButton
              icon={Trash2}
              label={gameText("ui.card-shop-screen.3", "Remove Card")}
              cost={removePrice}
              disabled={runDeck.length === 0 || gold < removePrice}
              disabledMessage={
                runDeck.length === 0
                  ? gameText("shop.no-remove", "No Cards to Remove")
                  : gameText("shop.not-enough-gold", "Not Enough Gold")
              }
              used={removeUsed}
              soldOutText={gameText("ui.card-shop-screen.attr1", "Remove Card - Sold Out")}
              onClick={() => {
                setRemoveMode(true);
              }}
            />
          }
        />
      )}
    </FadeSlot>
  );
}
