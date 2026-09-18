import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "@/lib/error-logger";

interface FallbackProps {
  error: Error | undefined;
  reset: () => void;
}

interface Props {
  children: ReactNode;
  label?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
}

interface State {
  hasError: boolean;
  error?: Error | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? undefined;
    logError(
      label ? `ErrorBoundary (${label}): ${error.message}` : `ErrorBoundary: ${error.message}`,
      "react",
      label ? { screen: label } : undefined,
      error.stack ?? undefined,
      info.componentStack ?? undefined,
      error,
    );
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: Props) {
    // A stuck error screen must not survive navigation: the same boundary
    // instance is reused across screens (label={screen}), so a screen change
    // clears the latch and lets the new screen render.
    if (this.state.hasError && prevProps.label !== this.props.label) {
      this.handleReset();
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === "function"
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      return (
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-balance">Something went wrong</h1>
            <p className="mb-6 text-balance text-muted-foreground">
              An unexpected error occurred. Please reload the page.
            </p>
            {/* Intentionally a native button: the default fallback must render
                even when the shared Button primitive (or its imports) is the
                thrower. Keep styling close to Button size="lg". */}
            <button
              type="button"
              onClick={() => {
                this.handleReset();
                window.location.reload();
              }}
              className="inline-flex h-16 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-xl font-semibold whitespace-nowrap text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
