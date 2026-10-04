import type { BattleCard } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { getTrinketTextShineColors, SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
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
import { KeywordToken, renderTokenizedDescription } from "../../../shared/ui/cards/card-description-ui";
import { TooltipChip, TooltipHeader } from "../../../shared/ui/tooltips/tooltip-panel";
import { sortMysteryEffectsByDisplayOrder } from "@/lib/mystery";
import type { MysteryEffect } from "@/lib/mystery";
import { gearBaseItems, getUniqueGearTextShineColors, getUniqueItemDefinition } from "@/lib/gear";

const PERCENTAGE_MULTIPLIER = 100;

const mysteryShineTextProps = { className: "font-bold", fallbackClassName: "text-foreground" } as const;

function renderInteractiveKeywords(text: string) {
  return renderTokenizedDescription(text, {
    renderKeyword: (partText, keywordId, key) => (
      <KeywordToken key={key} keywordId={keywordId} matchedText={partText} />
    ),
    renderPlain: (partText, key) => <span key={key}>{partText}</span>,
  });
}

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
  const pillClass = cn(
    "inline-flex items-center gap-1 rounded-full border shadow-xs",
    tooltip
      ? ["mx-0.5 px-1.5 py-0.5 align-middle", tooltipChipClass, "leading-none"]
      : "px-3 py-1 text-xs leading-none font-semibold",
  );
  switch (effect.kind) {
    case "gainGold":
    case "loseGold":
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
            {effect.amount} {resource === "gold" ? "Gold" : materialLabels[resource]}
          </span>
        </span>
      );
    }
    case "healHealth": {
      const chanceSuffix =
        effect.chance !== undefined ? ` (${Math.round(effect.chance * PERCENTAGE_MULTIPLIER)}% chance)` : "";
      return <span>{renderInteractiveKeywords(`Restore ${effect.amount} Health${chanceSuffix}`)}</span>;
    }
    case "damageHealth": {
      return (
        <span className="font-semibold text-red-400">{tooltip ? "Take damage" : `Take ${effect.amount} damage`}</span>
      );
    }
    case "gainXP": {
      const label = keywordDefinitions[effect.keyword]?.label ?? effect.keyword;
      return <span>{renderInteractiveKeywords(`Gain ${effect.amount} ${label} XP`)}</span>;
    }
    case "addCard": {
      const card = findCard?.(effect.cardId);
      const title = card?.title ?? "a card";
      const colors = card && "cost" in card ? getCardInspectionShineColors(card) : [];

      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          Add{" "}
          <ShineText colors={colors} {...mysteryShineTextProps}>
            {title}
          </ShineText>{" "}
          to your deck
        </span>
      ) : (
        <span className="text-sm text-pretty text-muted-foreground">Add {title}</span>
      );
    }
    case "chooseCard": {
      const tagLabel = effect.tag ? (keywordDefinitions[effect.tag]?.label ?? effect.tag) : undefined;
      const chooseLabel = tagLabel
        ? `Choose 1 of ${MYSTERY_CARD_CHOICES} ${tagLabel} cards`
        : `Choose 1 of ${MYSTERY_CARD_CHOICES} cards`;
      return (
        <span className={cn("text-sm text-muted-foreground", !tooltip && "text-pretty")}>
          {renderInteractiveKeywords(`${chooseLabel}${tooltip ? " to add to your deck" : ""}`)}
        </span>
      );
    }
    case "gainTrinket": {
      const title = findTrinket?.(effect.trinketId)?.title ?? "a boon";
      const colors = getTrinketTextShineColors(effect.trinketId);

      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          Gain{" "}
          <ShineText colors={colors} {...mysteryShineTextProps}>
            {title}
          </ShineText>{" "}
          <TooltipChip className="mx-0.5 mt-0 align-baseline">Boon</TooltipChip>
        </span>
      ) : (
        <span className="text-sm text-pretty text-muted-foreground">Add {title} for this run</span>
      );
    }
    case "gainRandomTrinket": {
      const fromIds = effect.fromIds;
      const fromId = fromIds?.length === 1 ? fromIds[0] : undefined;
      const colors = fromId ? getTrinketTextShineColors(fromId) : SHINE_PALETTES.boon;

      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          Gain a random{" "}
          <ShineText colors={colors} {...mysteryShineTextProps}>
            Boon
          </ShineText>{" "}
          for this run
        </span>
      ) : (
        <span className="text-sm text-pretty text-muted-foreground">Gain a random Boon for this run</span>
      );
    }
    case "gainRandomGear": {
      return <span className="text-sm text-pretty text-muted-foreground">Add random Gear to your Armory</span>;
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

      if (tooltip) {
        const titleNode =
          colors.length > 0 ? (
            <ShineText colors={colors} {...mysteryShineTextProps}>
              {title}
            </ShineText>
          ) : (
            <span className="font-bold text-foreground">{title}</span>
          );
        return <span className="text-sm text-muted-foreground">Add {titleNode} to your Armory</span>;
      }

      return <span className="text-sm text-pretty text-muted-foreground">Add {title} to your Armory</span>;
    }
    case "removeCard": {
      return <span className="text-sm text-muted-foreground">Remove a random card</span>;
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
  const sortedEffects = sortMysteryEffectsByDisplayOrder(effects);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <TooltipHeader>{choiceLabel ?? "Outcome"}</TooltipHeader>
      {sortedEffects.map((effect, i) => {
        const prefix =
          effect.kind === "gainGold" || effect.kind === "gainMaterial"
            ? "Find "
            : effect.kind === "loseGold"
              ? "Lose "
              : null;

        return (
          <div key={i} className="flex items-center gap-1.5 text-sm leading-none">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} tooltip />
          </div>
        );
      })}
    </div>
  );
}
