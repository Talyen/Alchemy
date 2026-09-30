export const STAGE_HEIGHT = 1080;
// Usable MacBook browser area, including the space taken by browser bars and Dock.
export const CONTENT_REFERENCE_VIEWPORT = { width: 1470, height: 738 } as const;
export const BATTLE_ACTOR_TOP = "34%";

export const COLLECTION_PAGE_SIZE = 8;
export const BESTIARY_PAGE_SIZE = 6;
export const TRINKET_PAGE_SIZE = 8;

// Visible top-card bounds within the 420 x 560 discard-pile artwork. Shared by
// the landing anchor and the flying back so their pixels coincide on arrival.
export const DISCARD_PILE_TOP_CARD_BOUNDS = {
  x: 25 / 420,
  y: 25 / 560,
  width: 328 / 420,
  height: 432 / 560,
} as const;
