import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameMenuState } from "@/app/use-app-navigation";
import { readActiveRunScreen } from "@/features/alchemy/shared/stores/run-reads";
const state = vi.hoisted(() => ({ listener: null as (() => void) | null }));
vi.mock("@/lib/desktop-api", () => ({
  getDesktopApi: () => ({
    onExternalFocusLost: (listener: () => void) => {
      state.listener = listener;
      return () => {
        state.listener = null;
      };
    },
  }),
}));
vi.mock("@/features/alchemy/shared/stores/run-reads", async (original) => ({
  ...(await original<typeof import("@/features/alchemy/shared/stores/run-reads")>()),
  readActiveRunScreen: vi.fn(),
}));
afterEach(cleanup);
describe("desktop interruption pause", () => {
  it("opens the battle menu and stays paused until explicitly dismissed", () => {
    vi.mocked(readActiveRunScreen).mockReturnValue("battle");
    const { result } = renderHook(useGameMenuState);
    act(() => state.listener!());
    expect(result.current.gameMenuOpen).toBe(true);
    act(() => result.current.closeGameMenu());
    expect(result.current.gameMenuOpen).toBe(false);
  });
  it("does not open an undismissible pause layer over the main menu", () => {
    vi.mocked(readActiveRunScreen).mockReturnValue("menu");
    const { result } = renderHook(useGameMenuState);
    act(() => state.listener!());
    expect(result.current.gameMenuOpen).toBe(false);
  });
});
