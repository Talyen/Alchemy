export function extractBuildResources(
  html: string,
  documentUrl: string,
): Array<{ url: string; type: "script" | "style" }>;
export function verifyBuildResources(html: string, documentUrl: string): Promise<void>;
/** An explicit port of zero requests an OS-assigned port for isolated callers. */
export function smokePreview(options?: { port?: number; rootDir?: string }): Promise<void>;
