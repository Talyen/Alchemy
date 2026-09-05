import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, LABYRINTH_NODE_META, tooltipBodyClass } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { getKeywordListShineColors, SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { Surface } from "@/features/alchemy/shared/ui/surface";
import { ShineText } from "@/features/alchemy/shared/ui/shine-text";
import { renderColoredKeywords } from "@/features/alchemy/shared/ui/card-description-ui";
import { cn } from "@/lib/utils";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { LABYRINTH_COMBAT_TRAIT_KEYWORDS, LABYRINTH_REWARD_TRAIT_KEYWORDS } from "./labyrinth-plasma";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  EncounterTraitId,
  LabyrinthNode,
} from "@/lib/content-systems/types";

interface Props {
  node: LabyrinthNode;
  canEnter: boolean;
  onEnter: () => void;
  onClose: () => void;
}

function ModifierCard({ modifier, variant }: { modifier: EncounterTraitId; variant: "enemy" | "reward" }) {
  const definition = ENCOUNTER_TRAITS[modifier];
  const keywords =
    variant === "enemy"
      ? (LABYRINTH_COMBAT_TRAIT_KEYWORDS[modifier as EncounterCombatTraitId] ?? [])
      : (LABYRINTH_REWARD_TRAIT_KEYWORDS[modifier as EncounterRewardTraitId] ?? []);
  let colors = getKeywordListShineColors(keywords);
  if (colors.length === 0) {
    colors =
      variant === "enemy" ? SHINE_PALETTES.corruption.slice(0, 3) : SHINE_PALETTES.labyrinth.alchemist.slice(0, 3);
  }
  return (
    <div
      className={cn(
        "rounded-lg border bg-white/[0.03] px-3 py-2",
        variant === "enemy" ? "border-red-500/30" : "border-emerald-500/30",
      )}
    >
      <ShineText
        colors={colors}
        fallbackClassName={variant === "enemy" ? "text-red-400" : "text-emerald-400"}
        className="text-base font-bold uppercase"
      >
        {definition.label}
      </ShineText>
      <p className={cn(tooltipBodyClass, "mt-0.5 text-base leading-relaxed")}>
        {renderColoredKeywords(definition.description)}
      </p>
    </div>
  );
}

export function LabyrinthNodeInspector({ node, canEnter, onEnter, onClose }: Props) {
  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const destinationLabel = NODE_TYPE_LABELS[node.type];
  const merchant = ["shop", "alchemist", "trinket-shop", "equipment-shop"].includes(node.type);
  const category = merchant ? "Merchant" : destinationLabel;
  const title = enemy?.title ?? destinationLabel;
  const art = enemy?.art ?? meta.art;

  return (
    <aside
      aria-label="Chamber details"
      className="labyrinth-inspector-in flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-shell-hero border border-white/10 bg-black shadow-xl motion-reduce:animate-none"
    >
      <div className="flex shrink-0 justify-end px-2 pt-2">
        <Button variant="ghost" size="icon" aria-label="Close chamber details" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
        <Surface
          clipContents={false}
          className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md"
          testId="chamber-art"
        >
          <img src={art} alt="" className="block h-full w-full object-cover" draggable={false} />
        </Surface>
        <div className="mt-3">
          {category !== title ? (
            <p className="text-sm font-bold tracking-wide text-amber-100/70 uppercase">{category}</p>
          ) : null}
          <h2 className="text-2xl font-semibold text-amber-50">{title}</h2>
        </div>
        {node.modifiers.length > 0 || node.rewardModifiers.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {node.modifiers.map((modifier) => (
              <ModifierCard key={modifier} modifier={modifier} variant="enemy" />
            ))}
            {node.rewardModifiers.map((modifier) => (
              <ModifierCard key={modifier} modifier={modifier} variant="reward" />
            ))}
          </div>
        ) : null}
      </div>
      {canEnter ? (
        <div className="shrink-0 border-t border-white/10 p-4">
          <Button size="lg" variant="primary" className={cn(BUTTON_WIDTH_ACTION, "w-full")} onClick={onEnter}>
            {meta.actionLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
