import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion } from "@/lib/alchemist";
import { getEditableCorruptionTargets } from "@/lib/corruption";
import { applyNumericCorruption } from "@/lib/corruption/numeric";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { DescriptionLines } from "@/features/alchemy/shared/ui/cards/card-description-ui";
import { getBattleCardDescriptionInspection } from "@/lib/battle/card-damage-inspection";
import { patchBattleState } from "../../../../../fixtures/battle";

it("renders saved ingredient marks and removes them when the visible line no longer matches", () => {
  const acid = cardById["acid-potion"]!;
  const target = getEditableCorruptionTargets(acid)[0]!;
  const mixed = createMixedPotion(
    applyNumericCorruption(acid, target, 1),
    strengthenPotion(cardById["health-potion"]!)!,
  );
  const card = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(mixed))));
  const { container, rerender } = render(
    <DescriptionLines lines={card.descriptionLines} idPrefix="saved" card={card} />,
  );
  expect(container.textContent).toBe(card.descriptionLines.join(""));
  expect([...container.querySelectorAll(".text-destructive")].map((span) => span.textContent)).toEqual(["3"]);
  expect([...container.querySelectorAll(".text-green-400")].map((span) => span.textContent)).toEqual(["9"]);
  expect([...container.querySelectorAll(".font-semibold")].map((span) => span.textContent)).toContain("Poison");

  rerender(<DescriptionLines lines={card.descriptionLines.map(() => "Gain 7 Block")} idPrefix="changed" card={card} />);
  expect(container.querySelector(".text-destructive, .text-green-400")).toBeNull();
  expect(container.textContent).toBe("Gain 7 Block".repeat(card.descriptionLines.length));
});

it("renders the full scaling rule and only its selected offensive preview line", () => {
  const card = cardById["shield-bash"]!;
  const view = getBattleCardDescriptionInspection(card, patchBattleState({ playerStatuses: { block: 16 } }));
  const preview = view.attackPreview!;
  const { container } = render(
    <>
      <DescriptionLines lines={view.card.descriptionLines} idPrefix="rules" card={view.card} />
      <DescriptionLines
        lines={preview.card.descriptionLines}
        idPrefix="preview"
        card={preview.card}
        onlyLines={preview.lineIndices}
      />
    </>,
  );
  expect(container.textContent).toContain("Deal Stun damage equal to half your Block");
  expect(container.textContent).toContain("Deal 9 Stun damage");
  expect(container.textContent?.match(/Gain 2 Block/g)).toHaveLength(1);
});
