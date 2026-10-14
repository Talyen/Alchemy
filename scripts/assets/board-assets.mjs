import { ART_PRESETS } from "./asset-constants.mjs";
import catalog from "../../src/lib/boards/catalog.json" with { type: "json" };

// Explicit catalog selections: new library files are never adopted automatically.
export const boardAssets = catalog.flatMap(({ id, sourceFilename }) => [
  {
    source: `2d Assets/Game Sources/Interface/Board Backgrounds/${sourceFilename}`,
    target: `board-${id}.webp`,
    ...ART_PRESETS.board,
    lossless: true,
  },
  {
    source: `2d Assets/Game Sources/Interface/Board Backgrounds/${sourceFilename}`,
    target: `board-${id}-thumbnail.webp`,
    ...ART_PRESETS.boardThumbnail,
  },
]);
