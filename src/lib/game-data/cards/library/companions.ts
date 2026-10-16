import { companionLibrary } from "../../companions";
import { summonCompanionCard } from "../card-builders";

export const companionCards = Object.values(companionLibrary).map(({ id }) =>
  summonCompanionCard({ id: `${id}-companion`, companionId: id }),
);
