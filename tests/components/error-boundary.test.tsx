import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";
import * as errorLogger from "@/lib/error-logger";

afterEach(cleanup);

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test explosion");
  }
  return <div>Healthy Child</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Healthy Child")).toBeDefined();
  });

  it("catches errors, calls logError and onError callback, and displays error UI", () => {
    const logSpy = vi.spyOn(errorLogger, "logError").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary label="battle-screen" onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reload" })).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith(
      "ErrorBoundary (battle-screen): Test explosion",
      "react",
      { screen: "battle-screen" },
      expect.anything(),
      expect.anything(),
      expect.any(Error),
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it("renders custom fallback node when provided", () => {
    vi.spyOn(errorLogger, "logError").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom Error View</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom Error View")).toBeDefined();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("renders fallback render function with reset callback", () => {
    vi.spyOn(errorLogger, "logError").mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <span>Error: {error?.message}</span>
            <button onClick={reset}>Try Again</button>
          </div>
        )}
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Error: Test explosion")).toBeDefined();
    const tryAgainBtn = screen.getByRole("button", { name: "Try Again" });
    expect(tryAgainBtn).toBeDefined();
  });
});
