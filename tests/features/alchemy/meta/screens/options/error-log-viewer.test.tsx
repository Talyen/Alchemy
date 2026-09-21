import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorLogViewer } from "@/features/alchemy/meta/screens/options/error-log-viewer";
import { useErrorLogStore } from "@/features/alchemy/shared/stores/error-log-store";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

describe("ErrorLogViewer", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    useErrorLogStore.getState().clearErrors();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when there are no logged errors", () => {
    render(<ErrorLogViewer onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Error Log" })).toBeTruthy();
    expect(screen.getByText("No errors logged.")).toBeTruthy();
    expect(screen.getByText("0 errors")).toBeTruthy();
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
    expect(document.activeElement).toBe(entry);

    await user.keyboard("{Enter}");
    expect(entry.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Stack:")).toBeNull();

    await user.keyboard(" ");
    expect(entry.getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByText("Error: at line 10"));
    expect(entry.getAttribute("aria-expanded")).toBe("true");
  });

  it("clears logged errors when Clear button is clicked", () => {
    useErrorLogStore.getState().pushError({
      message: "Test error to clear",
      source: "react",
    });

    render(<ErrorLogViewer onClose={vi.fn()} />);
    expect(screen.getByText("Test error to clear")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No errors logged.")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ErrorLogViewer onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
