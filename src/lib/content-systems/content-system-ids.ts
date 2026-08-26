export const CONTENT_SYSTEMS = {
  CAMPAIGN: "campaign",
  LABYRINTH: "labyrinth",
  WILDWOOD: "wildwood",
} as const;

export const CONTENT_SYSTEM_IDS = [
  CONTENT_SYSTEMS.CAMPAIGN,
  CONTENT_SYSTEMS.LABYRINTH,
  CONTENT_SYSTEMS.WILDWOOD,
] as const;
export type ContentSystemId = (typeof CONTENT_SYSTEM_IDS)[number];
