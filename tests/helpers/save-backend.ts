import type { SaveBackend } from "@/lib/platform-save-backend";

/** Successful asynchronous transport by default; exit writes fall back to it. */
export function createSaveBackend({
  writes = [],
  ...overrides
}: Partial<SaveBackend> & { writes?: string[] } = {}): SaveBackend {
  return {
    readCandidates: async () => ({ ok: true, candidates: [] }),
    write: async (_key, value) => {
      writes.push(value);
      return { ok: true };
    },
    writeSync: () => null,
    clear: async () => ({ ok: true }),
    ...overrides,
  };
}
