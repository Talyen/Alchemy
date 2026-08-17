// Renders consistent badge indicators and text descriptions for mystery effects.
// Depends on utility libraries, Lucide icons, homestead material maps, and keyword definitions.
// Consumed by tooltip builders and outcome summary screens.
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { tooltipChipClass } from "@/features/alchemy/shared/config";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import { HomesteadResourceArtwork, matPillStyle, matTextColor } from "./material-icons";
import { TooltipHeader } from "./tooltip-panel";
import type { MysteryEffect } from "@/lib/mystery";
import { gearBaseItems, type GearBaseItemId } from "@/lib/gear";

const PERCENTAGE_MULTIPLIER = 100;

interface BadgeCtx {
  findCard: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket: ((id: string) => { title: string } | undefined) | undefined;
  tooltip: boolean | undefined;
}

function renderGoldBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { amount: number };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border shadow-xs",
        ctx.tooltip ? cn("px-2 py-0.5", tooltipChipClass) : "px-3 py-1 text-xs font-semibold",
        "border-[#D6B85A]/30 bg-[#D6B85A]/15 text-[#D6B85A]",
      )}
    >
      <HomesteadResourceArtwork resource="gold" size="sm" />
      {`${e.amount} Gold`}
    </span>
  );
}

function renderMaterialBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { material: string; amount: number };
  const mat = e.material as keyof typeof matPillStyle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border shadow-xs",
        ctx.tooltip ? cn("px-2 py-0.5", tooltipChipClass) : "px-3 py-1 text-xs font-semibold",
        matPillStyle[mat],
        matTextColor[mat],
      )}
    >
      <HomesteadResourceArtwork resource={mat} size="sm" />
      {`${e.amount} ${materialLabels[mat]}`}
    </span>
  );
}

function renderHealBadge(effect: MysteryEffect): React.ReactNode {
  const e = effect as { amount: number; chance?: number };
  const healthDef = keywordDefinitions.health;
  return (
    <span className="font-semibold">
      Restore {e.amount} <span className={cn(healthDef?.colorClass)}>Health</span>
      {e.chance !== undefined ? ` (${Math.round(e.chance * PERCENTAGE_MULTIPLIER)}% chance)` : ""}
    </span>
  );
}

function renderDamageBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { amount: number };
  return <span className="font-semibold text-red-400">{ctx.tooltip ? "Take damage" : `Take ${e.amount} damage`}</span>;
}

function renderXpBadge(effect: MysteryEffect): React.ReactNode {
  const e = effect as { keyword: string; amount: number };
  const def = keywordDefinitions[e.keyword as keyof typeof keywordDefinitions];
  return (
    <span className="font-semibold">
      Gain {e.amount} <span className={cn(def?.colorClass)}>{def?.label ?? e.keyword}</span> XP
    </span>
  );
}

function renderAddCardBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { cardId: string };
  const title = ctx.findCard?.(e.cardId)?.title ?? "a card";
  return ctx.tooltip ? (
    <span className="text-xs text-muted-foreground">Add {title} card to your deck</span>
  ) : (
    <span className="text-sm text-muted-foreground">Add {title}</span>
  );
}

function renderChooseCardBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { tag?: string };
  const tagLabel = e.tag ? (keywordDefinitions[e.tag as keyof typeof keywordDefinitions]?.label ?? e.tag) : undefined;
  const chooseLabel = tagLabel
    ? `Choose 1 of ${MYSTERY_CARD_CHOICES} ${tagLabel} cards`
    : `Choose 1 of ${MYSTERY_CARD_CHOICES} cards`;
  return ctx.tooltip ? (
    <span className="text-xs text-muted-foreground">{chooseLabel} to add to your deck</span>
  ) : (
    <span className="text-sm text-muted-foreground">{chooseLabel}</span>
  );
}

function renderTrinketBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { trinketId: string };
  const title = ctx.findTrinket?.(e.trinketId)?.title ?? "a trinket";
  return (
    <span className={cn(ctx.tooltip ? "text-xs" : "text-sm", "text-muted-foreground")}>Add {title} for this run</span>
  );
}

function renderRandomTrinketBadge(_effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  return (
    <span className={cn(ctx.tooltip ? "text-xs" : "text-sm", "text-muted-foreground")}>
      Gain a random trinket for this run
    </span>
  );
}

function renderGeneratedGearBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { baseItemId: string };
  const title = e.baseItemId in gearBaseItems ? gearBaseItems[e.baseItemId as GearBaseItemId].displayName : "Gear";
  return (
    <span className={cn(ctx.tooltip ? "text-xs" : "text-sm", "text-muted-foreground")}>Add {title} to your Armory</span>
  );
}

function renderRemoveCardBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { mode: string };
  return e.mode === "random" ? (
    <span className={cn(ctx.tooltip ? "text-xs" : "text-sm", "text-muted-foreground")}>Remove a random card</span>
  ) : (
    <span className={cn(ctx.tooltip ? "text-xs" : "text-sm", "text-muted-foreground")}>Choose a card to remove</span>
  );
}

type RawRenderer = (effect: MysteryEffect, ctx: BadgeCtx) => React.ReactNode;

const EFFECT_RENDERERS: Partial<Record<MysteryEffect["kind"], RawRenderer>> = {
  gainGold: renderGoldBadge,
  loseGold: renderGoldBadge,
  gainMaterial: renderMaterialBadge,
  healHealth: renderHealBadge,
  damageHealth: renderDamageBadge,
  gainXP: renderXpBadge,
  addCard: renderAddCardBadge,
  chooseCard: renderChooseCardBadge,
  gainTrinket: renderTrinketBadge,
  gainRandomTrinket: renderRandomTrinketBadge,
  gainGeneratedGear: renderGeneratedGearBadge,
  removeCard: renderRemoveCardBadge,
};

/** Compact rendering of a single mystery effect — used in both tooltip and reward screen. */
export function MysteryEffectBadge({
  effect,
  findCard,
  findTrinket,
  tooltip,
}: {
  effect: MysteryEffect;
  findCard: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket: ((id: string) => { title: string } | undefined) | undefined;
  tooltip?: boolean;
}) {
  const render = EFFECT_RENDERERS[effect.kind];
  if (!render) return null;
  return render(effect, { findCard, findTrinket, tooltip });
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
          <div key={i} className="flex items-center gap-1.5 text-xs">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} tooltip />
          </div>
        );
      })}
    </div>
  );
}
