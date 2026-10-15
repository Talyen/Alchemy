export const COMBATANT_FRAME_OPTIONS = [
  { value: "charcoal", label: "Charcoal Leather" },
  { value: "saddle", label: "Saddle Leather" },
  { value: "walnut", label: "Walnut & Leather" },
  { value: "oak", label: "Oak & Leather" },
  { value: "none", label: "Original" },
] as const;

export type CombatantFrameStyle = (typeof COMBATANT_FRAME_OPTIONS)[number]["value"];
