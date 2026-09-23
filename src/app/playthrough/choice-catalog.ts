import type { PlayerChoice } from "./types";

export type OfferChoice = (kind: string, id: string, score: number, execute: () => unknown, index?: number) => void;

function choiceKey(choice: Pick<PlayerChoice, "kind" | "id" | "index">): string {
  return JSON.stringify([choice.kind, choice.id, choice.index ?? null]);
}

export function createChoiceCatalog() {
  let choices: PlayerChoice[] = [];
  const commands = new Map<string, () => unknown>();

  const offer: OfferChoice = (kind, id, score, execute, index) => {
    const choice: PlayerChoice = { kind, id, score, ...(index === undefined ? {} : { index }) };
    const key = choiceKey(choice);
    if (commands.has(key)) throw new Error(`Duplicate playthrough choice: ${JSON.stringify(choice)}`);
    commands.set(key, execute);
    choices.push(choice);
  };

  return {
    beginObservation(): PlayerChoice[] {
      choices = [];
      commands.clear();
      return choices;
    },
    offer,
    execute: (choice: PlayerChoice): unknown => {
      const action = commands.get(choiceKey(choice));
      if (!action) throw new Error(`Replay choice unavailable: ${JSON.stringify(choice)}`);
      return action();
    },
  };
}
