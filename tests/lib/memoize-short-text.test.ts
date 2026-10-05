import { expect, it, vi } from "vitest";
import { memoizeShortText } from "@/lib/memoize-short-text";

it("bounds retention, refreshes recently used entries, and bypasses oversized input", () => {
  const parse = vi.fn((text: string) => ({ text }));
  const read = memoizeShortText(parse);
  const first = read("0");
  const second = read("1");
  for (let index = 2; index < 256; index++) read(String(index));
  expect(read("0")).toBe(first);
  read("256");
  expect(read("0")).toBe(first);
  expect(read("1")).not.toBe(second);
  const oversized = "x".repeat(1025);
  expect(read(oversized)).not.toBe(read(oversized));
  expect(parse.mock.calls.filter(([text]) => text === "0")).toHaveLength(1);
  expect(parse.mock.calls.filter(([text]) => text === "1")).toHaveLength(2);
});
