import { useGameTranslation } from "@/components/use-game-translation";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, Merge, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { type BattleCard, isPotionCard, potionBrewingArt } from "@/lib/game-data";
import { strengthenPotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { collectionTileWidthClass, getCardInspectionShineColors } from "../../shared/config";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { ChooserArtTile } from "../../shared/ui/chooser-art-tile";
import { DisabledTooltip } from "../../shared/ui/tooltips/disabled-tooltip";
import { useCaptureEscapeCancel } from "../../shared/ui/dialogs/use-modal-escape-dismiss";
import { PurchasableCardItem } from "../shop/ui/purchasable-shop-item";
import { ShopPriceChip } from "../shop/ui/purchasable-shop-tile";
import { cardSlotKeyOf } from "../shop/shop-commands-core";
import { BrewPotionPanel, type BrewPotionPanelHandle } from "./brew-potion-panel";
import { PotionComparison } from "./potion-comparison";
import { ShopBrowseOfferings, RefreshShopServiceButton } from "./shop-browse-shell";
import { type ShopShelfProps } from "./shop-shelf";
import { AlchemistLayout } from "./alchemist-layout";

type Method = BrewOperation["kind"];
export function AlchemistShopScreen({
  gold,
  runDeck,
  brewOffers,
  brewUsed,
  mixUsed,
  distillUsed,
  mixPrice,
  onBrewPotion,
  onMixPotions,
  onStrengthenPotion,
  afterProgressSaved = (feedback) => feedback(),
  isProgressSavePending = () => false,
  ...shelf
}: ShopShelfProps<"card"> & {
  runDeck: BattleCard[];
  brewOffers: BattleCard[];
  brewUsed: boolean;
  mixUsed: boolean;
  distillUsed: boolean;
  mixPrice: number;
  onBrewPotion: (offerIndex: number) => BattleCard | null;
  onMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  onStrengthenPotion: (index: number) => BattleCard | null;
  afterProgressSaved?: (feedback: () => void) => void;
}) {
  const i18n = useGameTranslation();
  const [page, setPage] = useState<"shop" | "methods" | "prepare" | "result">("shop");
  const [method, setMethod] = useState<Method>("new");
  const [result, setResult] = useState<BattleCard | null>(null);
  const [original, setOriginal] = useState<BattleCard | null>(null);
  const [purchaseError, setPurchaseError] = useState(false);
  const panel = useRef<BrewPotionPanelHandle>(null);
  const resultSequence = useRef(0);
  useEffect(
    () => () => {
      resultSequence.current++;
    },
    [],
  );
  const potions = runDeck.filter(isPotionCard);
  const services = [
    {
      kind: "new" as const,
      art: potionBrewingArt.brew,
      label: i18n.text("shop.brewing.brew", "Brew"),
      title: i18n.text("shop.brewing.brew-title", "Brew Potion"),
      icon: FlaskConical,
      used: brewUsed,
      eligible: brewOffers.length > 0,
      color: "text-emerald-300",
      border: "#6ee7b7",
    },
    {
      kind: "combine" as const,
      art: potionBrewingArt.mix,
      label: i18n.text("shop.brewing.mix", "Mix"),
      title: i18n.text("shop.brewing.mix-title", "Mix Potion"),
      icon: Merge,
      used: mixUsed,
      eligible: potions.length >= 2,
      color: "text-violet-300",
      border: "#c4b5fd",
    },
    {
      kind: "strengthen" as const,
      art: potionBrewingArt.distill,
      label: i18n.text("shop.brewing.distill", "Distill"),
      title: i18n.text("shop.brewing.distill-title", "Distill Potion"),
      icon: Pipette,
      used: distillUsed,
      eligible: potions.some((card) => strengthenPotion(card)),
      color: "text-amber-300",
      border: "#fcd34d",
    },
  ];
  const service = services.find((s) => s.kind === method)!;
  function leavePreparation() {
    resultSequence.current++;
    setPage("methods");
  }
  function back() {
    if (page === "prepare") panel.current?.back();
    else if (page === "methods") setPage("shop");
  }
  useCaptureEscapeCancel(page === "methods" ? back : undefined);
  function confirm(operation: BrewOperation) {
    const before = operation.kind === "strengthen" ? runDeck[operation.index] : null;
    const next =
      operation.kind === "new"
        ? onBrewPotion(operation.offerIndex)
        : operation.kind === "combine"
          ? onMixPotions(...operation.indices)
          : onStrengthenPotion(operation.index);
    if (next) {
      const sequence = ++resultSequence.current;
      afterProgressSaved(() => {
        if (sequence !== resultSequence.current) return;
        setOriginal(before ?? null);
        setResult(next);
        setPage("result");
      });
    }
    return next;
  }
  return (
    <AlchemistLayout
      title={
        page === "shop"
          ? i18n.text("shop.brewing.shop-title", "Alchemist's Shop")
          : page === "methods"
            ? i18n.text("shop.brewing.menu-title", "Potion Brewing")
            : service.title
      }
      gold={gold}
      onBack={page === "methods" || page === "prepare" ? back : undefined}
    >
      {page === "shop" ? (
        <>
          {purchaseError && (
            <p role="alert">{i18n.text("shop.brewing.purchase-error", "Could not complete this purchase.")}</p>
          )}
          <ShopBrowseOfferings
            swapKey={`${shelf.refreshesLeft}:${shelf.items.map(cardSlotKeyOf).join("|")}`}
            onLeave={shelf.onContinue}
            services={
              <>
                <Button size="lg" variant="outline" onClick={() => setPage("methods")}>
                  <FlaskConical aria-hidden="true" />
                  {i18n.text("shop.brewing.menu-title", "Potion Brewing")}
                </Button>
                <RefreshShopServiceButton
                  gold={gold}
                  refreshesLeft={shelf.refreshesLeft}
                  refreshPrice={shelf.refreshPrice}
                  onRefresh={() => {
                    setPurchaseError(false);
                    shelf.onRefresh();
                  }}
                />
              </>
            }
          >
            {shelf.items.map((card, index) => {
              const slot = cardSlotKeyOf(card, index);
              return (
                <PurchasableCardItem
                  key={slot}
                  card={card}
                  price={shelf.getPrice(card)}
                  gold={gold}
                  purchased={shelf.purchasedSlotKeys.includes(slot)}
                  onBuy={() => {
                    if (!isProgressSavePending()) setPurchaseError(!shelf.onBuy(slot));
                  }}
                />
              );
            })}
          </ShopBrowseOfferings>
        </>
      ) : page === "methods" ? (
        <>
          <div className="flex flex-wrap justify-center gap-8">
            {services.map((s) => {
              const disabled = s.used || !s.eligible || gold < mixPrice;
              const reason = s.used
                ? i18n.text("shop.brewing.used", "Used")
                : gold < mixPrice
                  ? i18n.text("shop.not-enough-gold", "Not Enough Gold")
                  : s.kind === "new"
                    ? i18n.text("ui.brew-potion-panel.d5", "No Potion recipes are available.")
                    : s.kind === "combine"
                      ? i18n.text("shop.brewing.two-required", "Two eligible Potions required")
                      : i18n.text("shop.no-distill", "No eligible Potions to distill");
              return (
                <DisabledTooltip key={s.kind} show={disabled} message={reason} focusable={false}>
                  <ChooserArtTile
                    interactionKey="alchemist-brewing"
                    interactionId={s.kind}
                    art={s.art}
                    icon={s.icon}
                    label={s.label}
                    ariaLabel={
                      s.used
                        ? i18n.text("shop.brewing.used-label", "{{service}} · Used", { service: s.label })
                        : s.label
                    }
                    accentClassName={s.color}
                    widthClass={collectionTileWidthClass}
                    surfaceClassName={`aspect-[3/4] has-shine-border ${s.used ? "grayscale opacity-50" : ""}`}
                    disabled={disabled}
                    overlay={
                      <>
                        <ShopPriceChip
                          price={mixPrice}
                          purchased={s.used}
                          purchasedLabel={i18n.text("shop.brewing.used", "Used")}
                          canAfford={gold >= mixPrice}
                        />
                        {!disabled && (
                          <ShineBorder
                            shineColor={s.border}
                            className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                          />
                        )}
                      </>
                    }
                    onClick={() => {
                      if (!disabled && !isProgressSavePending()) {
                        setMethod(s.kind);
                        setResult(null);
                        setPage("prepare");
                      }
                    }}
                  />
                </DisabledTooltip>
              );
            })}
          </div>
          <Button size="lg" variant="outline" className="min-w-56" onClick={back}>
            {i18n.text("shop.brewing.back", "Back")}
          </Button>
        </>
      ) : page === "prepare" ? (
        <BrewPotionPanel
          ref={panel}
          key={method}
          variant="alchemist"
          kind={method}
          deck={runDeck}
          offers={brewOffers}
          price={mixPrice}
          gold={gold}
          selectionSound="shopSelect"
          onConfirm={confirm}
          isProgressSavePending={isProgressSavePending}
          onBack={leavePreparation}
        />
      ) : result ? (
        <>
          {original ? (
            <PotionComparison original={original} result={result} />
          ) : (
            <BattleCardButton
              card={result}
              ariaLabel={i18n.displayText(result.title)}
              shimmerActive={false}
              shimmerToken={undefined}
              shineColor={getCardInspectionShineColors(result)}
              className={collectionTileWidthClass}
            />
          )}
          <Button
            size="lg"
            className="min-w-56"
            onClick={() => {
              setResult(null);
              setPage("methods");
            }}
          >
            {i18n.text("shop.brewing.continue", "Continue")}
          </Button>
        </>
      ) : null}
    </AlchemistLayout>
  );
}
