import { useGameTranslation } from "@/components/use-game-translation";

import {
  gearInstanceRarity,
  getGearInstanceTooltipEntries,
  type GearDefinition,
  type GearInstance,
  type GearAffixTooltipEntry,
  type GearRarity,
  gearAffixCatalog,
  getGearAffixTextShineColors,
} from "@/lib/gear";
import { GearItemTitle } from "../gear-item-title";
import { ShineText } from "../shine-text";
import { renderColoredKeywords } from "../cards/card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSubheader } from "./tooltip-panel";
import { cn } from "@/lib/utils";
import { tooltipBodyLineClass } from "@/features/alchemy/shared/config";
import { useGearAffixFeedback } from "./gear-affix-feedback";
import type { CSSProperties } from "react";

export function GearTooltipContent({
  definition,
  instance,
  craftingChanges,
}: {
  definition: GearDefinition;
  instance?: GearInstance | undefined;
  craftingChanges?: Record<string, "new" | "modified"> | undefined;
}) {
  const i18n = useGameTranslation();
  const rarity = instance ? (gearInstanceRarity(instance) ?? definition.rarity) : definition.rarity;
  const entries: ReturnType<typeof getGearInstanceTooltipEntries> = instance
    ? getGearInstanceTooltipEntries(instance)
    : definition.descriptionLines.map((text, index) => ({ key: `definition-${index}`, text }));
  const affixEntries = instance
    ? entries.filter(
        (entry): entry is typeof entry & { affixId: NonNullable<typeof entry.affixId>; value: number; name: string } =>
          entry.affixId !== undefined && entry.value !== undefined && entry.name !== undefined,
      )
    : [];

  return (
    <div>
      <TooltipHeader>
        <GearItemTitle {...(instance ? { instance } : { definition })} className="whitespace-normal" />
      </TooltipHeader>
      {instance ? (
        <GearAffixLines
          key={instance.instanceId}
          entries={affixEntries}
          craftingChanges={craftingChanges}
          rarity={rarity}
          fallback={entries.filter((entry) => entry.affixId === undefined).map((entry) => entry.text)}
        />
      ) : (
        <TooltipBody>
          {entries.map((entry) => (
            <p key={entry.key} className={tooltipBodyLineClass}>
              {i18n.displayText(i18n.read(() => renderColoredKeywords(entry.text)))}
            </p>
          ))}
        </TooltipBody>
      )}
    </div>
  );
}

function GearAffixLines({
  entries,
  rarity,
  fallback,
  craftingChanges,
}: {
  entries: GearAffixTooltipEntry[];
  rarity: GearRarity;
  fallback: string[];
  craftingChanges?: Record<string, "new" | "modified"> | undefined;
}) {
  const i18n = useGameTranslation();
  const rows = useGearAffixFeedback(entries);
  if (!rows.length)
    return (
      <TooltipBody>
        {fallback.map((text, index) => (
          <p key={index} className={tooltipBodyLineClass}>
            {i18n.displayText(i18n.read(() => renderColoredKeywords(text)))}
          </p>
        ))}
      </TooltipBody>
    );
  function renderAffixLine(entry: GearAffixTooltipEntry, reveal: boolean, outgoing = false, previous = false) {
    const def = gearAffixCatalog[entry.affixId];
    const isMaxRoll = (rarity === "astral" || rarity === "unique") && entry.value === def.roll[rarity].max;
    const colors = isMaxRoll ? getGearAffixTextShineColors(def) : [];
    return (
      <div
        className={cn(
          "gear-affix-line",
          reveal && "gear-affix-enter",
          outgoing && "gear-affix-exit",
          previous && "gear-affix-previous",
        )}
        data-previous-affix-id={previous ? entry.affixId : undefined}
        aria-hidden={previous ? true : undefined}
        style={{ "--affix-glow-color": getGearAffixTextShineColors(def)[0] } as CSSProperties}
      >
        <TooltipSubheader className="gear-affix-ink-line">
          <ShineText colors={colors} fallbackClassName="text-inherit">
            {i18n.displayText(entry.name)}
          </ShineText>
          {!previous && craftingChanges?.[entry.affixId] ? (
            <span
              data-testid="crafting-affix-chip"
              className="ml-2 inline-block rounded border border-emerald-300/50 bg-emerald-300/10 px-1.5 py-0.5 align-middle text-xs font-semibold text-emerald-100"
            >
              {craftingChanges[entry.affixId] === "modified"
                ? i18n.text("ui.gear-affix.modified", "Modified")
                : i18n.text("ui.gear-affix.new", "New")}
            </span>
          ) : null}
        </TooltipSubheader>
        <p className={cn(tooltipBodyLineClass, "gear-affix-ink-line gear-affix-ink-description mt-0 pl-3")}>
          {i18n.displayText(i18n.read(() => renderColoredKeywords(entry.text)))}
        </p>
      </div>
    );
  }
  return (
    <div className="gear-affix-lines">
      {rows.map(({ entry, change, revision, previous, slot }) => (
        <div
          key={slot}
          className="gear-affix-row"
          data-affix-id={entry.affixId}
          data-affix-change={change}
          aria-hidden={change === "removed" ? true : undefined}
        >
          <div className={cn("gear-affix-row-clip", previous && "gear-affix-replacement")} key={revision}>
            {previous ? renderAffixLine(previous, false, true, true) : null}
            {renderAffixLine(
              entry,
              change === "added" || change === "changed" || change === "replaced",
              change === "removed",
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
