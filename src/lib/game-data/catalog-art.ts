// Eager URL imports preserve static registration without decoding the images.
const catalogArt = import.meta.glob<string>("/src/assets/optimized/gear-*.webp", {
  eager: true,
  import: "default",
});

export const gearArtByDefinitionId: Record<string, string> = Object.fromEntries(
  Object.entries(catalogArt)
    .filter(([file]) => file.startsWith("/src/assets/optimized/gear-"))
    .map(([file, art]) => [file.slice("/src/assets/optimized/gear-".length, -".webp".length), art]),
);
