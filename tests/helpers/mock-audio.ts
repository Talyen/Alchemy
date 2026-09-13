/**
 * Blanket-mocks `@/lib/audio`: every export becomes a `vi.fn()`.
 *
 * Use for interaction/logic tests that only need audio calls to be silent
 * (e.g. shop actions, navigation). When the test must observe playback
 * behavior (src set, play/pause, volume, mute), use `installFakeAudio`
 * from `./fake-audio` instead, which stubs the global `Audio` element.
 */
import { vi } from "vitest";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mocked = Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()]));
  return { ...actual, ...mocked };
});
