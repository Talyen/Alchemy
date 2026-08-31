import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
            <Button
              type="button"
              size="lg"
              onClick={() => {
                this.handleReset();
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
