import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GearTooltipContent } from "@/features/alchemy/shared/ui/tooltips/gear-tooltip-content";

import { gearDefinitions, type GearInstance } from "@/lib/gear";

function tooltip(instance: GearInstance) {
  return <GearTooltipContent instance={instance} definition={gearDefinitions[instance.definitionId]!} />;
}

afterEach(cleanup);

describe("gear affix descriptions", () => {
  it("skips an invalid affix without shifting the following descriptions", () => {
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
    expect(screen.getByText("Lifegiving").closest("div")?.textContent).toContain("Restore 1 Health each turn");
    expect(screen.getByText("Emberforged").closest("div")?.textContent).toContain("gains 2 Forge");
  });
});
