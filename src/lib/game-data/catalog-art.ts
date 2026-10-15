import { boardCatalog } from "../boards/catalog";

// Eager URL imports preserve static registration without decoding the images.
// Selection remains catalog-owned; files in the directory never unlock boards.
const catalogArt = import.meta.glob<string>("/src/assets/optimized/{board,gear}-*.webp", {
  eager: true,
  import: "default",
});

function boardImage(id: string): string {
  const art = catalogArt[`/src/assets/optimized/board-${id}.webp`];
  if (!art) throw new Error(`Missing board artwork: ${id}`);
  return art;
}

export const boardArt: Record<string, { full: string; thumbnail: string }> = Object.fromEntries(
  boardCatalog.map(({ id }) => [id, { full: boardImage(id), thumbnail: boardImage(`${id}-thumbnail`) }]),
);

export const gearArtByDefinitionId: Record<string, string> = Object.fromEntries(
  Object.entries(catalogArt)
    .filter(([file]) => file.startsWith("/src/assets/optimized/gear-"))
    .map(([file, art]) => [file.slice("/src/assets/optimized/gear-".length, -".webp".length), art]),
);
