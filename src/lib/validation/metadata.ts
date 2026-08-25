/**
 * Minimum supported save schema. Pre-launch floor: older local saves are unsupported
 * (no players yet). Schema migration steps exist only for versions >= this baseline.
 */
export const LAUNCH_SAVE_SCHEMA_VERSION = 11;
export const CURRENT_SAVE_SCHEMA_VERSION = 13;
// CURRENT_GAME_BUILD_VERSION is generated from package.json — run npm run sync:version.
export { CURRENT_GAME_BUILD_VERSION } from "./metadata.generated";
export const CURRENT_CONTENT_VERSION = 3;
