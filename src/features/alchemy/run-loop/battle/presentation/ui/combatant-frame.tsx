import { combatantFrameArt } from "../../../../shared/config/game-data-catalog";
import { useUiStore } from "../../../../shared/stores/ui-store";

/** Nine-slice corners keep their shape while artwork and status rows resize independently. */
export function CombatantFrame() {
  const style = useUiStore((state) => state.combatantFrameStyle);
  if (style === "none") return null;
  return (
    <span
      aria-hidden="true"
      className="combatant-material-frame"
      data-combatant-frame={style}
      style={{ borderImageSource: `url("${combatantFrameArt[style]}")` }}
    />
  );
}
