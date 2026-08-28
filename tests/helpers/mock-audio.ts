import { vi } from "vitest";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mocked = Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]));
  return { ...actual, ...mocked };
});
