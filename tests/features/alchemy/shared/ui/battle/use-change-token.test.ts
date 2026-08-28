import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChangeToken } from "@/features/alchemy/shared/ui/battle/use-change-token";

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
