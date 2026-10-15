export const STAGE_HEIGHT = 1080;
// Usable MacBook browser area, including the space taken by browser bars and Dock.
export const CONTENT_REFERENCE_VIEWPORT = { width: 1470, height: 738 } as const;
// Preserve the established 720p density; wider viewports gain playing space.
export const CONTENT_DENSITY_VIEWPORT = { width: 1280, height: 720 } as const;
export const CONTENT_LARGE_WINDOW_GROWTH = 0.72;
export const BATTLE_ACTOR_TOP = "39%";
export const BATTLE_ACTOR_VIEWPORT_OFFSET = STAGE_HEIGHT * 0.05;

export const COLLECTION_PAGE_SIZE = 8;
export const BESTIARY_PAGE_SIZE = 6;
export const TRINKET_PAGE_SIZE = 8;
