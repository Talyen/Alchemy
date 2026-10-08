import type { Server } from "node:http";
export function serveReview(
  output: string,
  report: { media: Record<string, { available: boolean; original: string; matched: string }> },
  port?: number,
): Promise<Server>;
