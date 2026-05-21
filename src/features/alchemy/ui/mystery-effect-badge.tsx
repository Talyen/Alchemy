// Renders consistent badge indicators and text descriptions for mystery effects.
// Depends on utility libraries, Lucide icons, homestead material maps, and keyword definitions.
// Consumed by tooltip builders and outcome summary screens.
import { Coins } from "lucide-react";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { materialLabels } from "@/lib/homestead/types";
import { matIconMap, matPillStyle, matTextColor } from "./material-icons";
import type { MysteryEffect } from "../mystery-events";

const goldDef = keywordDefinitions.gold;

// Constants grouped under a named configuration object.
const CONSTANTS = {
  PERCENTAGE_MULTIPLIER: 100,
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
  switch (effect.kind) {
    case "gainGold":
    case "loseGold":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            // Appends "/15" as a Tailwind opacity selector modifier to create a translucent background pill.
            goldDef.colorClass.replace("text-", "bg-") + "/15",
            goldDef.colorClass,
          )}
        >
          <Coins className="h-4 w-4" />
          {tooltip ? "Gold" : `${effect.amount} Gold`}
        </span>
      );
    case "gainMaterial":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            matPillStyle[effect.material],
            matTextColor[effect.material],
          )}
        >
          <span>{matIconMap[effect.material]}</span>
          {tooltip ? materialLabels[effect.material] : `${effect.amount} ${materialLabels[effect.material]}`}
        </span>
      );
    case "healHealth": {
      const healthDef = keywordDefinitions.health;
      return (
        <span className="font-semibold">
          {tooltip ? (
            <>
              Restore <span className={healthDef?.colorClass}>Health</span>
            </>
          ) : (
            <>
              Restore {effect.amount} <span className={healthDef?.colorClass}>Health</span>
              {effect.chance !== undefined
                ? ` (${Math.round(effect.chance * CONSTANTS.PERCENTAGE_MULTIPLIER)}% chance)`
                : ""}
            </>
          )}
        </span>
      );
    }
    case "damageHealth":
      return (
        <span className="font-semibold text-red-400">{tooltip ? "Take damage" : `Take ${effect.amount} damage`}</span>
      );
    case "gainXP": {
      const def = keywordDefinitions[effect.keyword];
      return (
        <span className="font-semibold">
          {tooltip ? (
            <>
              Gain <span className={def?.colorClass}>{def?.label ?? effect.keyword}</span> XP
            </>
          ) : (
            <>
              Gain {effect.amount} <span className={def?.colorClass}>{def?.label ?? effect.keyword}</span> XP
            </>
          )}
        </span>
      );
    }
    case "addCard":
      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          Add {findCard?.(effect.cardId)?.title ?? "a card"} card to your deck
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Add {findCard?.(effect.cardId)?.title ?? "a card"}</span>
      );
    case "chooseCard":
      return tooltip ? (
        <span className="text-sm text-muted-foreground">Choose a card to add to your deck</span>
      ) : (
        <span className="text-sm text-muted-foreground">Choose a card</span>
      );
    case "gainTrinket":
      return tooltip ? (
        <span className="text-sm text-muted-foreground">
          Add {findTrinket?.(effect.trinketId)?.title ?? "a trinket"} to your Inventory
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          Add {findTrinket?.(effect.trinketId)?.title ?? "a trinket"}
        </span>
      );
    case "gainRandomTrinket":
      return <span className="text-sm text-muted-foreground">Gain a random trinket</span>;
    case "removeCard":
      return effect.mode === "random" ? (
        <span className="text-sm text-muted-foreground">Remove a random card</span>
      ) : (
        <span className="text-sm text-muted-foreground">Choose a card to remove</span>
      );
    case "none":
      return null;
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
      <p className="text-base text-foreground">{choiceLabel ?? "Outcome"}</p>
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
