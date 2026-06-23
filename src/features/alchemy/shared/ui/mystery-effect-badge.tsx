// Renders consistent badge indicators and text descriptions for mystery effects.
// Depends on utility libraries, Lucide icons, homestead material maps, and keyword definitions.
// Consumed by tooltip builders and outcome summary screens.
import { Coins } from "lucide-react";
import { keywordDefinitions } from "@/lib/game-data";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import { matIconMap, matPillStyle, matTextColor } from "./material-icons";
import { TooltipHeader } from "./tooltip-panel";
import type { MysteryEffect } from "@/lib/mystery";

const goldDef = keywordDefinitions.gold;

const PERCENTAGE_MULTIPLIER = 100;

interface BadgeCtx {
  findCard: ((id: string) => { title: string } | undefined) | undefined;
  findTrinket: ((id: string) => { title: string } | undefined) | undefined;
  tooltip: boolean | undefined;
}

function renderGoldBadge(effect: MysteryEffect): React.ReactNode {
  const e = effect as { amount: number };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        goldDef.pillBgClass,
        goldDef.colorClass,
      )}
    >
      <Coins className="h-4 w-4" />
      {`${e.amount} Gold`}
    </span>
  );
}

function renderMaterialBadge(effect: MysteryEffect): React.ReactNode {
  const e = effect as { material: string; amount: number };
  const mat = e.material as keyof typeof matPillStyle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        matPillStyle[mat],
        matTextColor[mat],
      )}
    >
      <span>{matIconMap[mat]}</span>
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
    <span className="text-sm text-muted-foreground">Add {title} card to your deck</span>
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
    <span className="text-sm text-muted-foreground">{chooseLabel} to add to your deck</span>
  ) : (
    <span className="text-sm text-muted-foreground">{chooseLabel}</span>
  );
}

function renderTrinketBadge(effect: MysteryEffect, ctx: BadgeCtx): React.ReactNode {
  const e = effect as { trinketId: string };
  const title = ctx.findTrinket?.(e.trinketId)?.title ?? "a trinket";
  return ctx.tooltip ? (
    <span className="text-sm text-muted-foreground">Add {title} to your Inventory</span>
  ) : (
    <span className="text-sm text-muted-foreground">Add {title}</span>
  );
}

function renderRandomTrinketBadge(): React.ReactNode {
  return <span className="text-sm text-muted-foreground">Gain a random trinket</span>;
}

function renderRemoveCardBadge(effect: MysteryEffect): React.ReactNode {
  const e = effect as { mode: string };
  return e.mode === "random" ? (
    <span className="text-sm text-muted-foreground">Remove a random card</span>
  ) : (
    <span className="text-sm text-muted-foreground">Choose a card to remove</span>
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
          <div key={i} className="flex items-center gap-1.5 text-sm">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            <MysteryEffectBadge effect={effect} findCard={findCard} findTrinket={findTrinket} tooltip />
          </div>
        );
      })}
    </div>
  );
}
