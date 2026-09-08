import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GearTooltipContent } from "@/features/alchemy/shared/ui/gear-tooltip-content";
import { keywordDefinitions } from "@/lib/game-data";
import { extractKeywordIds } from "@/lib/keyword-text";
import { gearAffixCatalog, gearDefinitions, getGearAffixTextShineColors, type GearInstance } from "@/lib/gear";

function tooltip(instance: GearInstance) {
  return <GearTooltipContent instance={instance} definition={gearDefinitions[instance.definitionId]!} />;
}

afterEach(cleanup);

describe("gear affix shine rendering", () => {
  it("keeps Dance of Blades gold but gives each max-roll affix its own colors", () => {
    render(
      tooltip({
        instanceId: "dance",
        definitionId: "dance-of-blades",
        affixes: [
          { id: "dance-of-blades", value: 1 },
          { id: "flat-physical", value: 4 },
          { id: "armor-on-cc", value: 4 },
          { id: "start-armor", value: 6 },
        ],
      }),
    );
    expect(screen.getByText("Dance of Blades").style.backgroundImage).toContain("rgb(251, 191, 36)");
    const stalwart = screen.getByText("Stalwart").style.backgroundImage;
    expect(stalwart).toContain("rgb(156, 163, 175)");
    expect(stalwart).toContain("rgb(252, 211, 77)");
    expect(stalwart).toContain("rgb(103, 232, 249)");
    expect(screen.getByText("Bladedance").style.backgroundImage).toContain("rgb(190, 242, 100)");
    expect(screen.getByText("Ironbound").style.backgroundImage).toContain("rgb(203, 213, 225)");
    for (const name of ["Stalwart", "Bladedance", "Ironbound"]) {
      const gradient = screen.getByText(name).style.backgroundImage;
      expect(gradient).not.toContain("rgb(251, 191, 36)");
      expect(gradient).not.toContain("rgb(217, 119, 6)");
    }
  });

  it.each(Object.values(gearAffixCatalog).map((affix) => [affix.name, affix] as const))(
    "%s follows description keywords",
    (_, affix) => {
      const keywords = extractKeywordIds(affix.descriptionTemplate);
      expect(keywords.length).toBeGreaterThan(0);
      const colors = getGearAffixTextShineColors(affix);
      expect(colors.length).toBeGreaterThan(0);
      for (const id of keywords.slice(0, 3)) {
        expect(colors.join(" ")).toContain(keywordDefinitions[id].shineColors[0]!);
      }
    },
  );

  it("uses normalized legacy rolls without shifting colors after an invalid affix", () => {
    render(
      tooltip({
        instanceId: "legacy",
        definitionId: "leather-armor-astral",
        affixes: [
          { id: "retired-affix", value: 4 } as unknown as GearInstance["affixes"][number],
          { id: "health-per-turn", value: 4 },
          { id: "forge-on-burn", value: 4 },
          { id: "armor-on-cc", value: 4 },
        ],
      }),
    );
    expect(screen.getByText("Lifegiving").style.backgroundImage).toContain("rgb(248, 113, 113)");
    expect(screen.getByText("Lifegiving").closest("div")?.textContent).toContain("Restore 1 Health each turn");
    expect(screen.getByText("Emberforged").closest("div")?.textContent).toContain("grants 2 Forge");
    expect(screen.getByText("Emberforged").style.backgroundImage).toContain("rgb(251, 146, 60)");
    expect(screen.getByText("Stalwart").style.backgroundImage).toContain("rgb(103, 232, 249)");
  });
});
