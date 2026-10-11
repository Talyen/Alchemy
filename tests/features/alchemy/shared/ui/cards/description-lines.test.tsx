import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { DescriptionLines } from "@/features/alchemy/shared/ui/cards/card-description-ui";

describe("DescriptionLines", () => {
  it("keeps corruption offsets across keyword tokens and description lines", () => {
    const lines = ["Deal 12 physical damage and gain 12 Block", "Gain 4 Armor and 5 Block"];
    const { container } = render(
      <DescriptionLines
        lines={lines}
        idPrefix="offsets"
        card={{
          corruptedValuePositions: [
            { lineIndex: 0, matchIndex: lines[0]!.lastIndexOf("12") },
            { lineIndex: 1, matchIndex: lines[1]!.indexOf("5") },
          ],
        }}
      />,
    );
    expect([...container.querySelectorAll(".text-destructive")].map((span) => span.textContent)).toEqual(["12", "5"]);
    expect(container.textContent).toBe(lines.join("").replace("physical", "Physical"));
    expect([...container.querySelectorAll(".font-semibold")].map((span) => span.textContent)).toEqual([
      "Physical",
      "Block",
      "Armor",
      "Block",
    ]);
  });

  it("preserves markup on rerender and updates text and corruption highlights with new inputs", () => {
    const lines = ["Deal 12 Physical damage and gain 3 Block"];
    const card = { corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }] };
    const { container, rerender } = render(<DescriptionLines lines={lines} idPrefix="card" card={card} />);
    const original = container.innerHTML;
    expect(container.querySelector(".text-destructive")?.textContent).toBe("12");
    expect(container.textContent).toBe(lines[0]);

    rerender(<DescriptionLines lines={lines} idPrefix="card" card={{ ...card }} />);
    expect(container.innerHTML).toBe(original);

    rerender(<DescriptionLines lines={lines} idPrefix="card" />);
    expect(container.querySelector(".text-destructive")).toBeNull();
    expect(container.textContent).toBe(lines[0]);

    rerender(
      <DescriptionLines
        lines={["Gain 7 Block"]}
        idPrefix="replacement"
        card={{ corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }] }}
      />,
    );
    expect(container.textContent).toBe("Gain 7 Block");
    expect(container.querySelector(".text-destructive")?.textContent).toBe("7");
  });
  it.each([
    ["health-potion", ["9"]],
    ["mana-potion", ["3"]],
    ["stoneskin-potion", ["5"]],
    ["acid-potion", ["3"]],
    ["luck-potion", ["5"]],
    ["wishing-potion", ["3"]],
    ["panacea-potion", ["1"]],
  ] as const)("highlights only distilled values in %s after save hydration", (id, values) => {
    const distilled = strengthenPotion(cardById[id]!)!;
    const card = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(distilled))));
    const { container } = render(<DescriptionLines lines={card.descriptionLines} idPrefix={id} card={card} />);
    expect([...container.querySelectorAll(".text-green-400")].map((span) => span.textContent)).toEqual(values);
    expect(container.textContent).toBe(card.descriptionLines.join(""));
    expect(container.textContent).not.toContain("Brewed");
  });
});
