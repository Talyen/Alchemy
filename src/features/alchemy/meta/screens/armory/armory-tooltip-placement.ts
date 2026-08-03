// Thin re-exports — placement lives in shared/ui so battle and armory share one system.
export {
  buildPortaledTooltipStyle,
  measurePortaledTooltipPlacement,
  shouldPlacePortaledTooltipBelow,
  usePortaledTooltipPlacement,
  usePortaledTooltipPlacement as useArmoryPortaledTooltipPlacement,
  type PortaledTooltipAnchor,
} from "../../../shared/ui/portaled-tooltip-placement";
