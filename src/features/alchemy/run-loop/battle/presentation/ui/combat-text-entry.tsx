import { createElement } from "react";
import { useGameTranslation } from "@/components/use-game-translation";
import { REACTION_DEFINITIONS } from "@/lib/battle";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { cn } from "@/lib/utils";
import type { FloatingCombatText } from "../../../../shared/types";
import { ShineText } from "../../../../shared/ui/shine-text";
import {
  getCombatTextColorClass,
  getCombatTextIcon,
  getCombatTextLeadingIcon,
  getCombatTextAccessibleLabel,
} from "../../../../shared/utils/index";

export function CombatTextEntry({ entry, staticMotion }: { entry: FloatingCombatText; staticMotion: boolean }) {
  const i18n = useGameTranslation();
  const icon = getCombatTextIcon(entry);
  const leading = getCombatTextLeadingIcon(entry);
  const reaction = entry.kind !== "notice" && entry.reactionId ? REACTION_DEFINITIONS[entry.reactionId] : undefined;
  return (
    <div
      data-testid="combat-text"
      aria-label={i18n.read(() => getCombatTextAccessibleLabel(entry))}
      data-kind={entry.kind}
      data-stat={entry.stat}
      data-reaction-id={entry.kind !== "notice" ? entry.reactionId : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        getCombatTextColorClass(entry),
        entry.kind === "damage" &&
          entry.critical &&
          (staticMotion ? "combat-text-critical-static" : "combat-text-critical"),
      )}
    >
      {i18n.displayText(
        leading
          ? createElement(leading, {
              "aria-hidden": true,
              style: { width: "0.94em", height: "0.94em", strokeWidth: 3 },
            })
          : null,
      )}
      {i18n.displayText(
        icon
          ? createElement(icon, {
              style: {
                width: "0.94em",
                height: "0.94em",
                strokeWidth: 3,
              },
            })
          : null,
      )}
      {entry.displayText ? (
        <span
          style={{
            WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.95)",
            paintOrder: "stroke fill",
            fontVariantNumeric: "tabular-nums",
            textAlign: "center",
            width:
              entry.reservedDigits === undefined
                ? undefined
                : `${entry.reservedDigits + (/^[+-]/.test(entry.displayText) ? 1 : 0)}ch`,
          }}
        >
          {reaction ? (
            <ShineText
              colors={getKeywordTextShineColors(reaction.keywords)}
              className={cn("reaction-text-shine", staticMotion && "reaction-text-static")}
            >
              {i18n.displayText(entry.displayText)}
            </ShineText>
          ) : (
            i18n.displayText(entry.displayText)
          )}
        </span>
      ) : null}
    </div>
  );
}
