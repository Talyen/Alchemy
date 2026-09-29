import type { ViteDevServer } from "vite";

export function withReportServer<T>(fn: (server: ViteDevServer) => Promise<T>): Promise<T>;
