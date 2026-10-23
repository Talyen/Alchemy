import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorLogViewer } from "@/features/alchemy/meta/screens/options/error-log-viewer";
import { useErrorLogStore } from "@/features/alchemy/shared/stores/react/error-log-store";
import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

describe("ErrorLogViewer", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    useErrorLogStore.getState().clearErrors();
  });

  afterEach(async () => {
    cleanup();
    await localization.changeLanguage("en");
  });

  it("expands logged errors with click, Enter, and Space while exposing the expanded state", async () => {
    const user = userEvent.setup();
    useErrorLogStore.getState().pushError({
      message: "Network test failure",
      source: "global",
      stack: "Error: at line 10",
      context: { url: "https://example.com" },
    });

    render(<ErrorLogViewer onClose={vi.fn()} />);

    expect(screen.getByText("Network test failure")).toBeTruthy();
    expect(screen.getByText("1 error")).toBeTruthy();

    const entry = screen.getByRole("button", { name: /Network test failure/, expanded: false });
    await user.click(entry);
    expect(entry.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Stack:")).toBeTruthy();
    expect(screen.getByText("Error: at line 10")).toBeTruthy();
    expect(within(entry.parentElement!).getAllByText("Network test failure")).toHaveLength(2);
    expect(document.activeElement).toBe(entry);

    await user.keyboard("{Enter}");
    expect(entry.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Stack:")).toBeNull();

    await user.keyboard(" ");
    expect(entry.getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByText("Error: at line 10"));
    expect(entry.getAttribute("aria-expanded")).toBe("true");
  });

  it("switches counts, source labels and dates without translating diagnostic evidence", async () => {
    installCatalogs(catalogs);
    const user = userEvent.setup();
    useErrorLogStore.getState().pushError({ message: "Battle", source: "storage", stack: "Error: at line 10" });
    const entry = useErrorLogStore.getState().errors[0]!;
    render(<ErrorLogViewer onClose={vi.fn()} />);
    for (const [locale, expected] of [
      ["de", "1 Fehler"],
      ["zh-Hans", "1个错误"],
      ["ru", "1 ошибка"],
      ["es", "1 error"],
      ["pt-BR", "1 erro"],
    ] as const) {
      await act(async () => {
        await localization.changeLanguage(locale);
      });
      expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.getByText("Battle")).toBeTruthy();
      const date = new Date(entry.timestamp).toLocaleString(locale);
      expect(screen.getByText(date, { normalizer: (value) => value })).toBeTruthy();
    }
    await act(async () => {
      await localization.changeLanguage("ru");
    });
    act(() => useErrorLogStore.getState().pushError({ message: "Second failure", source: "global" }));
    expect(screen.getByText("2 ошибки")).toBeTruthy();
    for (let index = 0; index < 3; index++)
      act(() => useErrorLogStore.getState().pushError({ message: `Failure ${index}`, source: "other" }));
    expect(screen.getByText("5 ошибок")).toBeTruthy();
    expect(screen.getByText("Данные сохранения")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Battle/ }));
    expect(screen.getByText("Error: at line 10")).toBeTruthy();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByRole("button", { name: "Скопировать всё" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("[storage] Battle"));
  });

  it("invalidates copy feedback when a full log replaces its oldest entry", async () => {
    const user = userEvent.setup();
    for (let index = 0; index < 100; index++) {
      useErrorLogStore.getState().pushError({ message: `Failure ${index}`, source: "global" });
    }
    render(<ErrorLogViewer onClose={vi.fn()} />);
    // Limit accessible-name computation to the controls instead of all 100 entry buttons.
    const controls = within(screen.getByText("100 errors").parentElement!);
    await user.click(controls.getByRole("button", { name: "Copy All" }));
    expect(screen.getByText("Copied · 100 errors")).toBeTruthy();
    act(() => useErrorLogStore.getState().pushError({ message: "New failure", source: "global" }));
    expect(screen.getByText("100 errors")).toBeTruthy();
    expect(screen.queryByText(/Copied ·/)).toBeNull();
    expect(screen.queryByText("Failure 0")).toBeNull();
    expect(screen.getByText("Failure 1")).toBeTruthy();
    expect(screen.getByText("Failure 99")).toBeTruthy();
    expect(screen.getByText("New failure")).toBeTruthy();
  });

  it("reports clipboard rejection without clearing the log", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("Clipboard unavailable"));
    useErrorLogStore.getState().pushError({ message: "Retained failure", source: "global" });
    render(<ErrorLogViewer onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Copy All" }));
    expect(screen.getByText("Copy failed · 1 error")).toBeTruthy();
    expect(screen.getByText("Retained failure")).toBeTruthy();
  });

  it("exports healthy and unserializable errors with their diagnostic details", async () => {
    const user = userEvent.setup();
    const context: Record<string, unknown> = {};
    context.self = context;
    useErrorLogStore.getState().pushError({
      message: "Circular context",
      source: "react",
      context,
      componentStack: "at BattleScreen",
    });
    useErrorLogStore.getState().pushError({ message: "Healthy context", source: "global", context: { detail: 42 } });
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<ErrorLogViewer onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Copy All" }));
    expect(screen.getByText("Copied · 2 errors")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Context could not be displayed."));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("component stack: at BattleScreen"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('context: {"detail":42}'));
    await user.click(screen.getByRole("button", { name: /Circular context/ }));
    expect(screen.getByText("Context could not be displayed.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No errors logged")).toBeTruthy();
  });
});
