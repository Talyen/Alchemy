import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { KeywordId } from "@/lib/game-data";
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";
import type { PersistedMysteryVisit } from "@/lib/active-run-session/types";
import type { ParsedActiveRunData } from "./save-schemas/active-run";

type PersistedMysteryVisitInput = NonNullable<Extract<ParsedActiveRunData["activity"], { kind: "mystery" }>["data"]>;
type PersistedMysteryChoiceInput = PersistedMysteryVisitInput["event"]["choices"][number];

export function hydratePersistedMysteryVisit(
  data: PersistedMysteryVisitInput | PersistedMysteryVisit | null,
): PersistedMysteryVisit | null {
  if (!data) return null;
  return {
    event: { ...data.event, choices: data.event.choices.map(hydrateMysteryChoice) },
    chosenChoice: data.chosenChoice ? hydrateMysteryChoice(data.chosenChoice) : null,
    cardChoices: data.cardChoices?.map(hydrateCard) ?? null,
    grantedGear: [...(data.grantedGear ?? [])],
    chosenCardId: data.chosenCardId ?? null,
  };
}

function hydrateMysteryChoice(choice: PersistedMysteryChoiceInput): MysteryChoice {
  return {
    label: choice.label,
    effects: choice.effects.map((effect): MysteryEffect => {
      // Parsed optional fields may be explicitly undefined; live effects omit them.
      if (effect.kind === "chooseCard")
        return effect.tag ? { kind: "chooseCard", tag: effect.tag as KeywordId } : { kind: "chooseCard" };
      if (effect.kind === "gainGeneratedGear")
        return {
          kind: effect.kind,
          baseItemId: effect.baseItemId,
          ...(effect.astral ? { astral: effect.astral } : {}),
        };
      return effect;
    }),
  };
}
