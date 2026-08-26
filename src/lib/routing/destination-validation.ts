import { DESTINATIONS, type Destination } from "./destinations";

const VALID_DESTINATIONS = new Set<string>(Object.values(DESTINATIONS));

/** Pre-rename destination labels still present in in-progress saves. */
function canonicalizeDestination(value: string): string {
  return value === "Merchant's Shop" ? DESTINATIONS.CARD_SHOP : value;
}

function isValidDestination(value: string): value is Destination {
  return VALID_DESTINATIONS.has(value);
}

/** Filter unknown destination strings; used at hydrate/resume/session write boundaries. */
export function filterValidDestinations(values: string[] | undefined | null): Destination[] {
  if (!values?.length) return [];
  return values.map(canonicalizeDestination).filter(isValidDestination);
}

export function filterValidDestinationRounds(
  values: Record<string, number> | undefined | null,
): Partial<Record<Destination, number>> {
  if (!values) return {};
  const roundsSinceOffered: Partial<Record<Destination, number>> = {};
  for (const [destination, rounds] of Object.entries(values)) {
    const canonical = canonicalizeDestination(destination);
    if (isValidDestination(canonical) && typeof rounds === "number" && rounds >= 0) {
      roundsSinceOffered[canonical] = rounds;
    }
  }
  return roundsSinceOffered;
}
