import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useChooserHover } from "@/features/alchemy/shared/ui/use-chooser-hover";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installFocusInputForTests(true);

beforeEach(() => useUiStore.setState({ hoveredCardId: null, shimmerState: null }));

it("gives keyboard chooser focus shimmer feedback and clears hover on departure", () => {
  const { result } = renderHook(() => useChooserHover("hero", "mage", false));
  act(() => result.current.onFocusCapture());
  expect(result.current.visible).toBe(true);
  expect(result.current.shimmerActive).toBe(true);
  act(() => result.current.onBlurCapture());
  expect(useUiStore.getState().hoveredCardId).toBeNull();
});

it("keeps locked chooser tooltips available without shimmer", () => {
  const { result } = renderHook(() => useChooserHover("hero", "mage", true));
  act(() => result.current.onFocusCapture());
  expect(result.current.visible).toBe(true);
  expect(result.current.shimmerActive).toBe(false);
  expect(useUiStore.getState().hoveredCardId).toBeNull();
});
