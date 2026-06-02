import { ErrorBoundary } from "@/components/error-boundary";
import type { ReactNode } from "react";

export function withScreenBoundary(label: string, children: ReactNode) {
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>;
}
