import { loadManifest } from "./asset-manifest-cache.mjs";
import { writeTextIfChanged } from "./write-text-if-changed.mjs";

/**
 * Build and persist a generated module from an asset manifest.
 * @template {Record<string, unknown>} T
 * @param {{ manifestPath: string, outputFile: string, check?: boolean, build: (manifest: Record<string, unknown>) => { content: string } & T }} options
 * @returns {Promise<T & { wrote: boolean }>}
 */
export async function syncGeneratedModule({ manifestPath, outputFile, check = false, build }) {
  const manifest = await loadManifest(manifestPath);
  const result = build(manifest);
  const wrote = await writeTextIfChanged(outputFile, result.content, { check });
  return { ...result, wrote };
}
