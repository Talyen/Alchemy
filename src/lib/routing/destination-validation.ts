import { DESTINATIONS, type Destination } from "./destinations";

const VALID_DESTINATIONS = new Set<string>(Object.values(DESTINATIONS));

function isValidDestination(value: string): value is Destination {
  return VALID_DESTINATIONS.has(value);
}

/** Filter unknown destination strings; used at hydrate/resume/session write boundaries. */
export function filterValidDestinations(values: string[] | undefined | null): Destination[] {
  if (!values?.length) return [];
  return values.filter(isValidDestination);
}

export function filterValidDestinationRounds(
  values: Record<string, number> | undefined | null,
): Partial<Record<Destination, number>> {
  if (!values) return {};
  const roundsSinceOffered: Partial<Record<Destination, number>> = {};
  for (const [destination, rounds] of Object.entries(values)) {
    if (isValidDestination(destination) && typeof rounds === "number" && rounds >= 0) {
      roundsSinceOffered[destination] = rounds;
    }
  }
  return roundsSinceOffered;
}
