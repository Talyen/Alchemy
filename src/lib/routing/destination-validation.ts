import { DESTINATIONS, type Destination } from "./destinations";

const VALID_DESTINATIONS = new Set<string>(Object.values(DESTINATIONS));

function canonicalizeDestination(value: string): string {
  if (value === "Merchant's Shop") return DESTINATIONS.CARD_SHOP;
  if (value === "Equipment Shop") return DESTINATIONS.GEAR_SHOP;
  return value;
}

function isValidDestination(value: string): value is Destination {
  return VALID_DESTINATIONS.has(value);
}

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
