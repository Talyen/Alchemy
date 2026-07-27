// Neutral run-flow seam: destination sampling and campaign start helpers shared by
// run-setup and run-loop without cross-phase imports.
// Deep imports from ./destination-flow, ./campaign-start, and ./resolve-available-destinations
// are preferred inside features; this barrel is the shell-facing entry.
export { resolveAvailableDestinations } from "./resolve-available-destinations";
export type { DestinationOptionsInput } from "./destination-flow";
