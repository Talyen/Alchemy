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

  chrome?: SelectableCardChrome;
  widthClass?: string;

  interactionKey?: string;

  onHoverChange?: ((hovered: boolean) => void) | undefined;
}

export type SelectableCardProps = SelectableCardBaseProps &
  (
    | { isHovered?: undefined; onHoverStart?: undefined; onHoverEnd?: undefined }
    | { isHovered: boolean; onHoverStart: () => void; onHoverEnd: () => void }
  );

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
  const {
    isHovered,
    onHoverStart: baseHoverStart,
    onHoverEnd: baseHoverEnd,
    shimmerActive,
    shimmerToken,
  } = useInteractiveCard(props.interactionKey, props.card.id);
  const { onHoverChange } = props;
  const onHoverStart = onHoverChange
    ? () => {
        baseHoverStart();
        onHoverChange(true);
      }
    : baseHoverStart;
  const onHoverEnd = onHoverChange
    ? () => {
        baseHoverEnd();
        onHoverChange(false);
      }
    : baseHoverEnd;
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
    className: cn(
      widthClass ?? DEFAULT_WIDTH_BY_CHROME[chrome],
      cardInteractiveGlowClass,
      chrome === "corruption" && isSelected && "card-interactive-selected-danger",
    ),
    wrapperClassName: "relative flex justify-center",
    shimmerActive,
    shimmerToken,
  };

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
