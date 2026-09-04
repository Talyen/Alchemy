import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION, LABYRINTH_NODE_META, tooltipBodyClass } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { getKeywordListShineColors, SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { ShineText } from "@/features/alchemy/shared/ui/shine-text";
import { renderColoredKeywords } from "@/features/alchemy/shared/ui/card-description-ui";
import { cn } from "@/lib/utils";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { NODE_TYPE_LABELS, NODE_TYPE_TOOLTIPS } from "@/lib/content-systems/labyrinth/data";
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
  left: number;
  top: number;
  side: "left" | "right";
  width: number;
  panelRef?: ((element: HTMLElement | null) => void) | undefined;
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
        "rounded-lg bg-white/[0.03] px-4 py-3",
        variant === "enemy" ? "border-[3px] border-red-500/40" : "border-[3px] border-emerald-500/40",
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

export function LabyrinthNodeInspector({ node, canEnter, onEnter, left, top, side, width, panelRef }: Props) {
  const meta = LABYRINTH_NODE_META[node.type];
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const destinationLabel = NODE_TYPE_LABELS[node.type];
  const isBoss = node.type === "boss";
  const title = isBoss && enemy ? enemy.title : destinationLabel;
  const subtitle = isBoss ? destinationLabel : (enemy?.title ?? null);
  const art = enemy?.art ?? meta.art;
  const enemyModifiers: EncounterCombatTraitId[] = node.modifiers;
  const rewardModifiers: EncounterRewardTraitId[] = node.rewardModifiers;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Inspector uses click to stop propagation, not as interactive control
    <aside
      aria-label="Chamber details"
      data-side={side}
      ref={panelRef}
      className="labyrinth-inspector-in absolute z-30 flex max-h-[min(100%,36rem)] -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[var(--radius-shell-hero)] border border-white/10 bg-black p-4 shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      style={{ left, top, width }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-shell-hero)] border border-white/15">
        <img src={art} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
          <p className="text-base font-bold tracking-wide text-amber-100/80 uppercase">{destinationLabel}</p>
          <p className="text-3xl font-semibold text-amber-50">{title}</p>
          {subtitle && subtitle !== title ? (
            <p className="text-sm font-semibold tracking-wide text-amber-100/70">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <p className={cn(tooltipBodyClass, "text-left text-base leading-relaxed text-amber-100/80")}>
        {renderColoredKeywords(NODE_TYPE_TOOLTIPS[node.type])}
      </p>
      {enemyModifiers.length > 0 || rewardModifiers.length > 0 ? (
        <div className="grid gap-2">
          {enemyModifiers.map((modifier) => (
            <ModifierCard key={modifier} modifier={modifier} variant="enemy" />
          ))}
          {rewardModifiers.map((modifier) => (
            <ModifierCard key={modifier} modifier={modifier} variant="reward" />
          ))}
        </div>
      ) : null}
      {canEnter ? (
        <Button size="lg" variant="primary" className={cn(BUTTON_WIDTH_ACTION, "mt-auto w-full")} onClick={onEnter}>
          {meta.actionLabel}
        </Button>
      ) : null}
    </aside>
  );
}
