// React error boundary that logs component stacks via the centralized error logger
// and shows a reload fallback.
// Used at the root so render failures do not leave the game on a blank page.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/error-logger";

interface Props {
  children: ReactNode;
  /** Optional label for nested boundaries (e.g. screen name) */
  label?: string;
  /** Called when an error is caught, before the fallback UI shows */
  onError?: (error: Error, info: ErrorInfo) => void;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
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

  override render() {
    if (this.state.hasError) {
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
                this.setState({ hasError: false });
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
