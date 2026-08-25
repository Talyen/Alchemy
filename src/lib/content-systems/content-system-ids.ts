export const CONTENT_SYSTEM_IDS = ["campaign", "labyrinth", "wildwood"] as const;
export type ContentSystemId = (typeof CONTENT_SYSTEM_IDS)[number];
