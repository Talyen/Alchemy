import type { Plugin } from "vite";

export function reactCompilerPlugin(): Promise<
  Omit<Plugin, "configResolved"> & {
    configResolved(config: { command: string; build: { sourcemap: boolean | string } }): void | Promise<void>;
  }
>;
