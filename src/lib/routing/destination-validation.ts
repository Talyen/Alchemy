import { DESTINATIONS, type Destination } from "./destinations";

const VALID_DESTINATIONS = new Set<string>(Object.values(DESTINATIONS));

const LEGACY_DESTINATION_NAMES: Readonly<Record<string, Destination>> = {
  "Merchant's Shop": DESTINATIONS.CARD_SHOP,
  "Equipment Shop": DESTINATIONS.GEAR_SHOP,
};

function canonicalizeDestination(value: string): string {
  return LEGACY_DESTINATION_NAMES[value] ?? value;
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
    if (isValidDestination(canonical) && Number.isFinite(rounds) && rounds >= 0) {
      roundsSinceOffered[canonical] = rounds;
    }
  }
  return roundsSinceOffered;
}
