// Shared rendering for mystery event effects — used in both the choice tooltip
// and the post-choice reward screen so they can never differ.
import { Coins } from "lucide-react";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import { matIconMap, matPillStyle, matTextColor } from "./material-icons";
import type { MysteryEffect } from "../mystery-events";

/** Compact rendering of a single mystery effect — used in both tooltip and reward screen. */
export function MysteryEffectBadge({
  effect,
  findCard,
  findTrinket,
  tooltip,
}: {
  effect: MysteryEffect;
  findCard?: (id: string) => { title: string } | undefined;
  findTrinket?: (id: string) => { title: string } | undefined;
  tooltip?: boolean;
}) {
  switch (effect.kind) {
    case "gainGold":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-yellow-300/15 text-yellow-300">
          <Coins className="h-4 w-4" />
          {tooltip ? "Gold" : `${effect.amount} Gold`}
        </span>
      );
    case "loseGold":
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-400/15 text-red-400">
          <Coins className="h-4 w-4" />
          {tooltip ? "Gold" : `${effect.amount} Gold`}
        </span>
      );
    case "gainMaterial":
      return (
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", matPillStyle[effect.material], matTextColor[effect.material])}>
          <span>{matIconMap[effect.material]}</span>
          {tooltip ? materialLabels[effect.material] : `${effect.amount} ${materialLabels[effect.material]}`}
        </span>
      );
    case "healHP":
      return (
        <span className="font-semibold text-green-400">
          {tooltip
            ? "Restore HP"
            : `Restore ${effect.amount} HP${effect.chance !== undefined ? ` (${Math.round(effect.chance * 100)}% chance)` : ""}`
          }
        </span>
      );
    case "damageHP":
      return (
        <span className="font-semibold text-red-400">
          {tooltip ? "Take damage" : `Take ${effect.amount} damage`}
        </span>
      );
    case "gainMaxMana":
      return (
        <span className="font-semibold text-sky-400">
          {tooltip ? "Mana Crystal" : `Gain +${effect.amount} Mana Crystal${effect.amount > 1 ? "s" : ""}`}
        </span>
      );
    case "gainXP": {
      const def = keywordDefinitions[effect.keyword];
      return (
        <span className={cn("font-semibold", def?.colorClass)}>
          {tooltip
            ? `Gain ${def?.label ?? effect.keyword} XP`
            : `Gain ${effect.amount} ${def?.label ?? effect.keyword} XP`
          }
        </span>
      );
    }
    case "addCard":
      return tooltip
        ? <span>Add {findCard?.(effect.cardId)?.title ?? "a card"} card to your deck</span>
        : <span>Add {findCard?.(effect.cardId)?.title ?? "a card"}</span>;
    case "addRandomCard":
      return tooltip
        ? <span>Add a random card to your deck</span>
        : <span>Add a random card</span>;
    case "chooseCard":
      return tooltip
        ? <span>Choose a card to add to your deck</span>
        : <span>Choose a card</span>;
    case "gainTrinket":
      return tooltip
        ? <span>Add {findTrinket?.(effect.trinketId)?.title ?? "a trinket"} to your Inventory</span>
        : <span>Add {findTrinket?.(effect.trinketId)?.title ?? "a trinket"}</span>;
    case "gainRandomTrinket":
      return <span>Gain a random trinket</span>;
    case "removeCard":
      return effect.mode === "random"
        ? <span>Remove a random card</span>
        : <span>Choose a card to remove</span>;
    case "none":
      return null;
  }
}

/** Renders a list of mystery effects stacked vertically — used in the choice tooltip. */
export function MysteryEffectList({
  effects,
  findCard,
  findTrinket,
}: {
  effects: MysteryEffect[];
  findCard?: (id: string) => { title: string } | undefined;
  findTrinket?: (id: string) => { title: string } | undefined;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-base text-foreground">Outcome</p>
      {effects.map((effect, i) => {
        if (effect.kind === "none") return null;

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
