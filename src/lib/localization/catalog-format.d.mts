export type Catalogs = Record<string, Record<string, string>>;
export interface CatalogAlias {
  id: string;
  values?: Record<string, string | number>;
  english?: string;
}
export interface PackedCatalogs {
  version: 1;
  languages: string[];
  messages: Record<string, Array<string | null>>;
  aliases: Record<string, CatalogAlias>;
}
export function packCatalogs(
  catalogs: Catalogs,
  source: Record<string, { aliasOf?: string; values?: Record<string, string | number> }>,
): PackedCatalogs;
export function unpackCatalogs(value: unknown): Catalogs;
