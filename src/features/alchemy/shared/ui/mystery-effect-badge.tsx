// Renders consistent badge indicators and text descriptions for mystery effects.
// Depends on utility libraries, Lucide icons, homestead material maps, and keyword definitions.
// Consumed by tooltip builders and outcome summary screens.
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { tooltipChipClass } from "@/features/alchemy/shared/config";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import { HomesteadResourceArtwork, goldPillStyle, goldTextColor, matPillStyle, matTextColor } from "./material-icons";
import { TooltipHeader } from "./tooltip-panel";
import type { MysteryEffect } from "@/lib/mystery";
import { gearBaseItems } from "@/lib/gear";

const PERCENTAGE_MULTIPLIER = 100;

interface BadgeCtx {
  findCard: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket: ((id: string) => { title: string } | undefined) | undefined;
  tooltip: boolean | undefined;
}

type BadgeRenderer<T extends MysteryEffect> = (effect: T, ctx: BadgeCtx) => React.ReactNode;

const chipPillClass = (ctx: BadgeCtx) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border shadow-xs",
    ctx.tooltip ? cn("px-2 py-0.5", tooltipChipClass, "text-sm") : "px-3 py-1 text-xs font-semibold",
  );

const renderGoldBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainGold" | "loseGold" }>> = (effect, ctx) => (
  <span className={cn(chipPillClass(ctx), goldPillStyle, goldTextColor)}>
    <HomesteadResourceArtwork resource="gold" size="sm" />
    {`${effect.amount} Gold`}
  </span>
);

const renderMaterialBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainMaterial" }>> = (effect, ctx) => {
  const mat = effect.material;
  return (
    <span className={cn(chipPillClass(ctx), matPillStyle[mat], matTextColor[mat])}>
      <HomesteadResourceArtwork resource={mat} size="sm" />
      {`${effect.amount} ${materialLabels[mat]}`}
    </span>
  );
};

const renderHealBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "healHealth" }>> = (effect) => {
  const healthDef = keywordDefinitions.health;
  return (
    <span className="font-semibold">
      Restore {effect.amount} <span className={cn(healthDef?.colorClass)}>Health</span>
      {effect.chance !== undefined ? ` (${Math.round(effect.chance * PERCENTAGE_MULTIPLIER)}% chance)` : ""}
    </span>
  );
};

const renderDamageBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "damageHealth" }>> = (effect, ctx) => (
  <span className="font-semibold text-red-400">{ctx.tooltip ? "Take damage" : `Take ${effect.amount} damage`}</span>
);

const renderXpBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainXP" }>> = (effect) => {
  const def = keywordDefinitions[effect.keyword];
  return (
    <span className="font-semibold">
      Gain {effect.amount} <span className={cn(def?.colorClass)}>{def?.label ?? effect.keyword}</span> XP
    </span>
  );
};

const renderAddCardBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "addCard" }>> = (effect, ctx) => {
  const title = ctx.findCard?.(effect.cardId)?.title ?? "a card";
  return ctx.tooltip ? (
    <span className="text-sm text-balance text-muted-foreground">Add {title} card to your deck</span>
  ) : (
    <span className="text-sm text-balance text-muted-foreground">Add {title}</span>
  );
};

const renderChooseCardBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "chooseCard" }>> = (effect, ctx) => {
  const tagLabel = effect.tag ? (keywordDefinitions[effect.tag]?.label ?? effect.tag) : undefined;
  const chooseLabel = tagLabel
    ? `Choose 1 of ${MYSTERY_CARD_CHOICES} ${tagLabel} cards`
    : `Choose 1 of ${MYSTERY_CARD_CHOICES} cards`;
  return ctx.tooltip ? (
    <span className="text-sm text-balance text-muted-foreground">{chooseLabel} to add to your deck</span>
  ) : (
    <span className="text-sm text-balance text-muted-foreground">{chooseLabel}</span>
  );
};

const renderTrinketBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainTrinket" }>> = (effect, ctx) => {
  const title = ctx.findTrinket?.(effect.trinketId)?.title ?? "a boon";
  return <span className="text-sm text-balance text-muted-foreground">Add {title} for this run</span>;
};

const renderRandomTrinketBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainRandomTrinket" }>> = () => (
  <span className="text-sm text-balance text-muted-foreground">Gain a random Boon for this run</span>
);

const renderGeneratedGearBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "gainGeneratedGear" }>> = (effect) => {
  const baseItem = gearBaseItems[effect.baseItemId as keyof typeof gearBaseItems];
  const title = baseItem ? `${effect.astral ? "Astral " : ""}${baseItem.displayName}` : "Gear";
  return <span className="text-sm text-balance text-muted-foreground">Add {title} to your Armory</span>;
};

const renderRemoveCardBadge: BadgeRenderer<Extract<MysteryEffect, { kind: "removeCard" }>> = () => (
  <span className="text-sm text-balance text-muted-foreground">Remove a random card</span>
);

/** Compact rendering of a single mystery effect — used in both tooltip and reward screen. */
export function MysteryEffectBadge({
  effect,
  findCard,
  findTrinket,
  tooltip,
}: {
  effect: MysteryEffect;
  findCard?: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket?: ((id: string) => { title: string } | undefined) | undefined;
  tooltip?: boolean;
}) {
  const ctx: BadgeCtx = { findCard, findTrinket, tooltip };

  switch (effect.kind) {
    case "gainGold":
    case "loseGold":
      return renderGoldBadge(effect, ctx);
    case "gainMaterial":
      return renderMaterialBadge(effect, ctx);
    case "healHealth":
      return renderHealBadge(effect, ctx);
    case "damageHealth":
      return renderDamageBadge(effect, ctx);
    case "gainXP":
      return renderXpBadge(effect, ctx);
    case "addCard":
      return renderAddCardBadge(effect, ctx);
    case "chooseCard":
      return renderChooseCardBadge(effect, ctx);
    case "gainTrinket":
      return renderTrinketBadge(effect, ctx);
    case "gainRandomTrinket":
      return renderRandomTrinketBadge(effect, ctx);
    case "gainGeneratedGear":
      return renderGeneratedGearBadge(effect, ctx);
    case "removeCard":
      return renderRemoveCardBadge(effect, ctx);
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return null;
    }
  }
}

/** Renders a list of mystery effects stacked vertically — used in the choice tooltip. */
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
  return (
    <div className="flex flex-col items-start gap-1.5">
      <TooltipHeader>{choiceLabel ?? "Outcome"}</TooltipHeader>
      {effects.map((effect, i) => {
        const prefix =
          effect.kind === "gainGold" || effect.kind === "gainMaterial"
            ? "Find "
            : effect.kind === "loseGold"
              ? "Lose "
              : null;

        return (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} tooltip />
          </div>
        );
      })}
    </div>
  );
}
