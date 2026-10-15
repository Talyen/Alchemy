import { text as gameText, displayText } from "@/lib/localization/runtime";
import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import type { RefObject } from "react";
import { armorySalvageArt } from "@/lib/game-data";
import { CRAFTING_CURRENCY_LIST, type CraftingCurrencyId } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { sectionTitleClass, surfaceSelectedRingClass } from "../../../../shared/config";
import { CurrencyChip } from "../../../../shared/ui/currency-chip";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";

export function CraftingStrip({
  craftingCurrencies,
  salvageButtonRef,
  activeCurrencyId,
  salvageMode,
  editable,
  hasSalvageableGear,
  onSelectCurrency,
  onToggleSalvageMode,
}: {
  salvageButtonRef: RefObject<HTMLButtonElement | null>;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageMode: boolean;
  editable: boolean;
  hasSalvageableGear: boolean;
  onSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  onToggleSalvageMode: () => void;
}) {
  useGameTranslation();
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible();

  return (
    <div data-testid="armory-crafting-strip" className="mt-4 w-full">
      <h3 className={cn("text-center font-sans", sectionTitleClass)}>{gameText("ui.crafting-strip.1", "Crafting")}</h3>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {CRAFTING_CURRENCY_LIST.map((currency) => (
          <CurrencyChip
            key={currency.id}
            currency={currency}
            count={craftingCurrencies[currency.id] ?? 0}
            armed={activeCurrencyId === currency.id}
            disabled={!editable || (craftingCurrencies[currency.id] ?? 0) <= 0}
            ariaLabel={gameText("ui.crafting-strip.2", "Use {{value0}}", { value0: displayText(currency.displayName) })}
            onSelect={() => onSelectCurrency(currency.id)}
          />
        ))}
        <div
          ref={triggerRef}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocusCapture={onFocusCapture}
          onBlurCapture={onBlurCapture}
        >
          <PortaledTooltip triggerRef={triggerRef} visible={visible} className="armory-inventory-tooltip !shadow-none">
            <TooltipHeader>{gameText("ui.crafting-strip.3", "Salvage")}</TooltipHeader>
            <TooltipBody>
              <p>
                <GameMessage
                  id="ui.crafting-strip.s1"
                  defaultValue="<part0/> gear into crafting materials."
                  parts={{
                    part0: (
                      <strong className="font-semibold text-foreground">
                        {gameText("ui.crafting-strip.4", "Dismantle")}
                      </strong>
                    ),
                  }}
                />
              </p>
              {!editable ? (
                <p className="mt-2">{gameText("ui.crafting-strip.6", "Salvaging is unavailable.")}</p>
              ) : null}
            </TooltipBody>
          </PortaledTooltip>
          <button
            type="button"
            ref={salvageButtonRef}
            data-testid="armory-salvage-toggle"
            aria-label={displayText(
              salvageMode
                ? gameText("ui.crafting-strip.d1", "Cancel salvage")
                : gameText("ui.crafting-strip.d2", "Salvage"),
            )}
            aria-pressed={salvageMode}
            disabled={!editable || (!hasSalvageableGear && !salvageMode)}
            className={cn(
              "armory-currency-art relative block overflow-hidden rounded-xl border border-border/80 bg-black text-red-300 transition-[color,background-color,border-color,box-shadow] duration-150 enabled:hover:border-red-400/80 enabled:hover:text-red-200 enabled:active:bg-red-950/30",
              salvageMode && surfaceSelectedRingClass,
              (!editable || (!hasSalvageableGear && !salvageMode)) && "cursor-default opacity-50",
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (!editable) return;
              onToggleSalvageMode();
            }}
          >
            <img src={armorySalvageArt} alt="" decoding="async" className="h-full w-full object-cover" />
          </button>
        </div>
      </div>
    </div>
  );
}
