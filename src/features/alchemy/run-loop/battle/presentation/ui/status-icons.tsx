import { useGameTranslation } from "@/components/use-game-translation";
import { type ReactNode } from "react";
import { Skull, Sparkles } from "lucide-react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import {
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaKeywordsForText,
  HASTE_PLASMA_PAIR,
  keywordIcons,
  getPlasmaColorPairFromColors,
} from "../../../../shared/config/index";
import { phoenixFeatherStatus } from "../../../../shared/config/phoenix-feather-status";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { augmentDefinitions } from "../../../../shared/augment-definitions";
import type { StatusChip } from "../../../../shared/types";
import { renderColoredKeywords } from "../../../../shared/ui/cards/card-description-ui";
import { renderMessage } from "../../../../shared/ui/localized-description";
import { KeywordTag } from "../../../../shared/ui/keyword-tag";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { TooltipBody, TooltipHeader } from "../../../../shared/ui/tooltips/tooltip-panel";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";

const STATUS_ICON_CLASS = "h-[calc(1.8225*var(--content-rem,1rem))] w-[calc(1.8225*var(--content-rem,1rem))]";

function StatusChipShell({
  ariaLabel,
  buttonClassName,
  icon,
  tooltip,
  plasmaColorPair,
}: {
  ariaLabel: string;
  buttonClassName?: string;
  icon: ReactNode;
  tooltip: ReactNode;
  plasmaColorPair?: PlasmaColorPair | null;
}) {
  useGameTranslation();
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();

  return (
    <div className="status-chip-pop relative flex items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        className={cn("relative flex h-9 w-9 items-center justify-center", buttonClassName)}
        aria-label={ariaLabel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        {icon}
      </button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} plasmaColorPair={plasmaColorPair}>
        {tooltip}
      </PortaledTooltip>
    </div>
  );
}

function StatusTooltip({
  labelNode,
  value,
  hideValue,
  valueColorClass,
  description,
}: {
  labelNode: ReactNode;
  value?: number;
  hideValue?: boolean | undefined;
  valueColorClass?: string;
  description: ReactNode;
}) {
  useGameTranslation();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {labelNode}
        {value !== undefined && !hideValue ? (
          <span
            className={cn(
              "rounded-full border border-border/70 bg-stone-900/60 px-2.5 py-0.5 text-sm font-bold",
              valueColorClass,
            )}
          >
            {value}
          </span>
        ) : null}
      </div>
      <TooltipBody>
        <p>{description}</p>
      </TooltipBody>
    </>
  );
}

export function StatusIcon({ chip }: { chip: StatusChip }) {
  const i18n = useGameTranslation();
  const haste = chip.id === "haste";
  const phoenix = chip.id === "phoenixFeather";
  const augment = augmentDefinitions[chip.id as keyof typeof augmentDefinitions];
  const kw = chip.id as KeywordId;
  const special = haste ? HASTE_STATUS : phoenix ? phoenixFeatherStatus : augment;
  const definition = special ?? keywordDefinitions[kw];
  const Icon = special?.icon ?? keywordIcons[kw];
  if (!definition || !Icon) return null;
  const hideValue = Boolean(!haste && special && chip.hideValue);
  const extendedControl = chip.value > 1 && (chip.id === "stunned" || chip.id === "frozen");
  const description = i18n.read(() =>
    extendedControl
      ? renderMessage({
          id: chip.id === "stunned" ? "battle.status.stunned-turns" : "battle.status.frozen-turns",
          template:
            chip.id === "stunned"
              ? "<keyword0>Stunned</keyword0> combatants skip their next {{count}} turns."
              : "<keyword0>Frozen</keyword0> combatants skip their next {{count}} turns.",
          values: { count: chip.value },
          slots: { keyword0: { keywordId: chip.id === "stunned" ? "stun" : "freeze" } },
        })
      : haste
        ? i18n.displayText(definition.description)
        : renderColoredKeywords(chip.description ?? definition.description),
  );
  const plasmaColorPair = haste
    ? HASTE_PLASMA_PAIR
    : phoenix
      ? getPlasmaColorPairFromColors(phoenixFeatherStatus.shineColors)
      : augment
        ? getPlasmaColorPair(getPlasmaKeywordsForText(`${augment.label} ${augment.description}`))
        : getPlasmaColorPair([kw]);
  return (
    <StatusChipShell
      ariaLabel={i18n.displayText(
        phoenix || hideValue
          ? definition.label
          : i18n.text("ui.status-icons.d1", "{{value0}} {{value1}}", {
              value0: i18n.displayText(definition.label),
              value1: i18n.displayText(chip.value),
            }),
      )}
      icon={<Icon className={cn(STATUS_ICON_CLASS, definition.colorClass)} />}
      tooltip={
        <StatusTooltip
          labelNode={
            special ? (
              <TooltipHeader className="mb-0">{i18n.displayText(definition.label)}</TooltipHeader>
            ) : (
              <KeywordTag keywordId={kw} className="text-sm sm:text-base" />
            )
          }
          value={chip.value}
          hideValue={hideValue}
          valueColorClass={definition.colorClass}
          description={description}
        />
      }
      plasmaColorPair={plasmaColorPair}
    />
  );
}

const HASTE_STATUS = {
  label: "Haste",
  icon: Sparkles,
  colorClass: "text-fuchsia-300",
  description: "Haste grants an extra turn before enemies act.",
};

export function DeathsDoorStatusIcon({ remainingTurns }: { remainingTurns?: number | null }) {
  const i18n = useGameTranslation();
  return (
    <StatusChipShell
      ariaLabel={i18n.displayText(
        remainingTurns == null
          ? i18n.text("ui.status-icons.d2", "Death's Door")
          : i18n.text("battle.deaths-door-status", "Death's Door: {{count}} protected turns remaining", {
              count: remainingTurns,
            }),
      )}
      buttonClassName="rounded-full bg-red-950/70 text-red-200 ring-1 ring-red-400/60"
      icon={<Skull className={STATUS_ICON_CLASS} />}
      tooltip={
        <>
          <TooltipHeader>{i18n.text("ui.status-icons.1", "Death's Door")}</TooltipHeader>
          <TooltipBody>
            {remainingTurns != null && (
              <p>
                {i18n.text("battle.deaths-door-remaining", "{{count}} protected turns remaining.", {
                  count: remainingTurns,
                })}
              </p>
            )}
            <p>
              {i18n.text(
                "ui.status-icons.4",
                "Death's Door keeps you at 1 Health when taking fatal damage while protected.",
              )}
            </p>
            <p>{i18n.text("ui.status-icons.5", "Triggers once per combat.")}</p>
          </TooltipBody>
        </>
      }
      plasmaColorPair={DEATHS_DOOR_PLASMA_PAIR}
    />
  );
}
