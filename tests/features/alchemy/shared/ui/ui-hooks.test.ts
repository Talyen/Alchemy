import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { useChangeToken } from "@/features/alchemy/shared/ui/use-change-token";

describe("useLatestRef", () => {
  it("exposes the latest value immediately after render", () => {
    const { result, rerender } = renderHook(({ value }) => useLatestRef(value), {
      initialProps: { value: 1 },
    });

    expect(result.current.current).toBe(1);
    rerender({ value: 2 });
    expect(result.current.current).toBe(2);
  });
});

describe("useChangeToken", () => {
  it("stays at 0 until the value changes, then increments immediately", () => {
    const { result, rerender } = renderHook(({ value }) => useChangeToken(value), {
      initialProps: { value: 10 as number | string },
    });

    expect(result.current).toBe(0);

    rerender({ value: 9 });
    expect(result.current).toBe(1);

    rerender({ value: 9 });
    expect(result.current).toBe(1);

    rerender({ value: "9-10" });
    expect(result.current).toBe(2);
  });
});
