import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import type { BattleCard } from "@/lib/game-data";
import { getTrinketTextShineColors } from "@/features/alchemy/shared/config/shine-palettes";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { tooltipChipClass, getCardInspectionShineColors } from "@/features/alchemy/shared/config";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import {
  HomesteadResourceArtwork,
  goldPillStyle,
  goldTextColor,
  matPillStyle,
  matTextColor,
} from "../../../shared/ui/material-icons";
import { ShineText } from "../../../shared/ui/shine-text";
import { KeywordTag } from "../../../shared/ui/keyword-tag";
import { TooltipChip, TooltipHeader } from "../../../shared/ui/tooltips/tooltip-panel";
import { sortMysteryEffectsByDisplayOrder } from "@/lib/mystery";
import type { MysteryEffect } from "@/lib/mystery";
import { gearBaseItems, getUniqueGearTextShineColors, getUniqueItemDefinition } from "@/lib/gear";

const mysteryShineTextProps = { className: "font-bold", fallbackClassName: "text-foreground" } as const;

export function MysteryEffectBadge({
  effect,
  findCard,
  findTrinket,
  tooltip,
}: {
  effect: MysteryEffect;
  findCard?: ((id: string) => BattleCard | { title: string } | undefined) | undefined;
  findTrinket?: ((id: string) => { title: string } | undefined) | undefined;
  tooltip?: boolean;
}) {
  const i18n = useGameTranslation();
  const pillClass = cn(
    "inline-flex items-center gap-1 rounded-full border shadow-xs",
    tooltip
      ? ["mx-0.5 px-1.5 py-0.5 align-middle", tooltipChipClass, "leading-none"]
      : "px-3 py-1 text-xs leading-none font-semibold",
  );
  switch (effect.kind) {
    case "gainGold":
    case "gainMaterial": {
      const resource = effect.kind === "gainMaterial" ? effect.material : "gold";
      return (
        <span
          className={cn(
            pillClass,
            resource === "gold" ? goldPillStyle : matPillStyle[resource],
            resource === "gold" ? goldTextColor : matTextColor[resource],
          )}
        >
          <HomesteadResourceArtwork resource={resource} size={tooltip ? "xs" : "sm"} />
          <span className="leading-none">
            {i18n.displayText(effect.amount)}{" "}
            {i18n.displayText(
              resource === "gold" ? i18n.text("ui.mystery-effect-badge.d1", "Gold") : materialLabels[resource],
            )}
          </span>
        </span>
      );
    }
    case "healHealth": {
      return (
        <span>
          <GameMessage
            id="mystery.heal"
            defaultValue="Restore <amount/> <health/>"
            parts={{ amount: effect.amount, health: <KeywordTag keywordId="health" /> }}
          />
        </span>
      );
    }
    case "gainXP": {
      return (
        <span>
          <GameMessage
            id="mystery.gain-xp"
            defaultValue="Gain <amount/> <keyword/> XP"
            parts={{ amount: effect.amount, keyword: <KeywordTag keywordId={effect.keyword} /> }}
          />
        </span>
      );
    }
    case "addCard": {
      const card = findCard?.(effect.cardId);
      const title = card?.title ?? "a card";
      const colors = card && "cost" in card ? getCardInspectionShineColors(card) : [];

      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          <GameMessage
            id="ui.mystery-effect-badge.s1"
            defaultValue="Add <part0/> to your deck"
            parts={{
              part0: (
                <ShineText colors={colors} {...mysteryShineTextProps}>
                  {i18n.displayText(title)}
                </ShineText>
              ),
            }}
          />
        </span>
      ) : (
        <span className="text-sm text-pretty text-muted-foreground">
          <GameMessage
            id="ui.mystery-effect-badge.s2"
            defaultValue="Add <part0/>"
            parts={{ part0: i18n.displayText(title) }}
          />
        </span>
      );
    }
    case "chooseCard": {
      return (
        <span className={cn("text-sm text-muted-foreground", !tooltip && "text-pretty")}>
          {effect.tag ? (
            tooltip ? (
              <GameMessage
                id="mystery.choose-affinity-details"
                defaultValue="Choose 1 of <choices/> <keyword/> cards to add to your deck"
                parts={{ choices: MYSTERY_CARD_CHOICES, keyword: <KeywordTag keywordId={effect.tag} showTooltip /> }}
              />
            ) : (
              <GameMessage
                id="mystery.choose-affinity"
                defaultValue="Choose 1 of <choices/> <keyword/> cards"
                parts={{ choices: MYSTERY_CARD_CHOICES, keyword: <KeywordTag keywordId={effect.tag} showTooltip /> }}
              />
            )
          ) : tooltip ? (
            i18n.text("mystery.choose-card-details", "Choose 1 of {{choices}} cards to add to your deck", {
              choices: i18n.displayText(MYSTERY_CARD_CHOICES),
            })
          ) : (
            i18n.text("mystery.choose-card", "Choose 1 of {{choices}} cards", {
              choices: i18n.displayText(MYSTERY_CARD_CHOICES),
            })
          )}
        </span>
      );
    }
    case "gainTrinket": {
      const title = findTrinket?.(effect.trinketId)?.title ?? "a boon";
      const colors = getTrinketTextShineColors(effect.trinketId);

      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          <GameMessage
            id="ui.mystery-effect-badge.s3"
            defaultValue="Gain <part0/> <part1/>"
            parts={{
              part0: (
                <ShineText colors={colors} {...mysteryShineTextProps}>
                  {i18n.displayText(title)}
                </ShineText>
              ),
              part1: (
                <TooltipChip className="mx-0.5 mt-0 align-baseline">
                  {i18n.text("ui.mystery-effect-badge.9", "Boon")}
                </TooltipChip>
              ),
            }}
          />
        </span>
      ) : (
        <span className="text-sm text-pretty text-muted-foreground">
          <GameMessage
            id="ui.mystery-effect-badge.s4"
            defaultValue="Add <part0/> for this run"
            parts={{ part0: i18n.displayText(title) }}
          />
        </span>
      );
    }
    case "gainRandomGear": {
      return (
        <span className="text-sm text-pretty text-muted-foreground">
          {i18n.text("ui.mystery-effect-badge.18", "Add random Gear to your Armory")}
        </span>
      );
    }
    case "gainGeneratedGear": {
      const uniqueItem = getUniqueItemDefinition(effect.baseItemId);
      const baseItem =
        gearBaseItems[(uniqueItem ? uniqueItem.baseItemId : effect.baseItemId) as keyof typeof gearBaseItems];
      const title = uniqueItem
        ? uniqueItem.displayName
        : baseItem
          ? `${effect.astral ? "Astral " : ""}${baseItem.displayName}`
          : "Gear";

      const keywords = baseItem?.affinityKeywords ?? [];
      const colors = uniqueItem
        ? getUniqueGearTextShineColors()
        : effect.astral
          ? getKeywordBorderShineColors(keywords)
          : [];

      return (
        <span className={cn("text-sm text-muted-foreground", !tooltip && "text-pretty")}>
          <GameMessage
            id="ui.mystery-effect-badge.s6"
            defaultValue="Add <part0/> to your Armory"
            parts={{
              part0: tooltip ? (
                <ShineText colors={colors} {...mysteryShineTextProps}>
                  {i18n.displayText(title)}
                </ShineText>
              ) : (
                title
              ),
            }}
          />
        </span>
      );
    }
    default: {
      const exhaustive: never = effect;
      void exhaustive;
      return null;
    }
  }
}

export function MysteryEffectList({
  effects,
  findCard,
  findTrinket,
  choiceLabel,
}: {
  effects: MysteryEffect[];
  findCard: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket: ((id: string) => { title: string } | undefined) | undefined;
  choiceLabel?: string;
}) {
  const i18n = useGameTranslation();
  const sortedEffects = sortMysteryEffectsByDisplayOrder(effects);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <TooltipHeader>{i18n.displayText(choiceLabel ?? "Outcome")}</TooltipHeader>
      {sortedEffects.map((effect, i) => {
        const prefix = effect.kind === "gainGold" || effect.kind === "gainMaterial" ? "Find " : null;

        return (
          <div key={i} className="flex items-center gap-1.5 text-sm leading-none">
            {prefix && <span className="text-muted-foreground">{i18n.displayText(prefix)}</span>}
            <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} tooltip />
          </div>
        );
      })}
    </div>
  );
}
