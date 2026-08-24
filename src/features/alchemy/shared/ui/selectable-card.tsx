// Selectable BattleCard tile — one owner for pick-a-card chrome (glow + selected
// ring) across draft, reward, shop, corruption, mystery, and removal flows.
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass, collectionTileWidthClass, viewCardWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { useInteractiveCard } from "./use-interactive-card";

type SelectableCardChrome = "choice" | "shop" | "deck" | "corruption";

const DEFAULT_WIDTH_BY_CHROME: Record<SelectableCardChrome, string> = {
  choice: collectionTileWidthClass,
  shop: collectionTileWidthClass,
  deck: viewCardWidthClass,
  corruption: viewCardWidthClass,
};

interface SelectableCardBaseProps {
  card: BattleCard;
  isSelected: boolean;
  onSelect: () => void;
  /** Tile family — controls default width; "corruption" swaps in the danger ring. */
  chrome?: SelectableCardChrome;
  widthClass?: string;
  tiltEnabled?: boolean;
  /**
   * Store-backed hover/shimmer identity (e.g. "reward", "draft-choice-0").
   * Omit it for quiet tiles — shop-style flows never shimmer and let the button
   * track its own hover.
   */
  interactionKey?: string;
}

export type SelectableCardProps = SelectableCardBaseProps &
  (
    | { isHovered?: undefined; onHoverStart?: undefined; onHoverEnd?: undefined }
    // Controlled callers (mystery deck pickers) bind the full hover trio so a
    // selection can keep its detail popup open.
    | { isHovered: boolean; onHoverStart: () => void; onHoverEnd: () => void }
  );

/** Resolved BattleCardButton hover binding — all three props, or absent. */
interface HoverBinding {
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export function SelectableCard(props: SelectableCardProps) {
  if (props.interactionKey !== undefined)
    return <KeyedSelectableCard {...props} interactionKey={props.interactionKey} />;
  return <QuietSelectableCard {...props} />;
}

function KeyedSelectableCard(props: SelectableCardBaseProps & { interactionKey: string }) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    props.interactionKey,
    props.card.id,
  );
  return (
    <SelectableCardSurface
      {...props}
      hover={{ hovered: isHovered, onHoverStart, onHoverEnd }}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
    />
  );
}

function QuietSelectableCard(props: SelectableCardProps) {
  return (
    <SelectableCardSurface
      {...props}
      hover={
        props.onHoverStart !== undefined
          ? { hovered: props.isHovered ?? false, onHoverStart: props.onHoverStart, onHoverEnd: props.onHoverEnd }
          : undefined
      }
      shimmerActive={false}
      shimmerToken={undefined}
    />
  );
}

function SelectableCardSurface({
  card,
  isSelected,
  onSelect,
  chrome = "choice",
  widthClass,
  tiltEnabled = true,
  hover,
  shimmerActive,
  shimmerToken,
}: Omit<SelectableCardBaseProps, "interactionKey"> & {
  hover: HoverBinding | undefined;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
}) {
  const buttonProps = {
    card,
    onClick: onSelect,
    ariaLabel: `Select ${getCardDisplayTitle(card)}`,
    selected: chrome === "corruption" ? false : isSelected,
    tiltEnabled,
    className: cn(
      widthClass ?? DEFAULT_WIDTH_BY_CHROME[chrome],
      cardInteractiveGlowClass,
      chrome === "corruption" && isSelected && "card-interactive-selected-danger",
    ),
    wrapperClassName: "relative flex justify-center",
    shimmerActive,
    shimmerToken,
  };
  // BattleCardButton's hover contract is a discriminated union (all three props
  // or none), so controlled and uncontrolled callers render as separate branches.
  if (hover) {
    return (
      <BattleCardButton
        {...buttonProps}
        hovered={hover.hovered}
        onHoverStart={hover.onHoverStart}
        onHoverEnd={hover.onHoverEnd}
      />
    );
  }
  return <BattleCardButton {...buttonProps} />;
}
