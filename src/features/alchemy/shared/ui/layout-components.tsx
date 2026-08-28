import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { screenDescriptionClass, screenShellPaddingClass, screenTitleClass } from "../config";
import { HamburgerTrigger } from "./navigation";

export function ScreenHeader({ title, className }: { title: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <h1 className={cn("font-sans", screenTitleClass)}>{title}</h1>
      <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-amber-100/75 to-transparent" />
    </div>
  );
}

export function ScreenHeaderRow({
  title,
  trailing,
  className,
  trailingClassName,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
  trailingClassName?: string;
}) {
  return (
    <div className={cn("relative flex w-full items-center justify-center", className)}>
      <ScreenHeader title={title} />
      {trailing ? (
        <div className={cn("absolute top-1/2 right-0 -translate-y-1/2", trailingClassName)}>{trailing}</div>
      ) : null}
    </div>
  );
}

export function PageLayout({ children, align = "center" }: { children: ReactNode; align?: "center" | "start" }) {
  return (
    <div className="game-page-scroll h-full w-full overflow-x-hidden overflow-y-auto px-5 py-7">
      <div
        className={cn(
          "flex min-h-full w-full flex-col items-center",
          align === "start" ? "justify-start" : "justify-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ScreenShell({
  children,
  className,
  maxWidthClass = "max-w-5xl",
  minHeightClass = "min-h-[57.78cqh]",
}: {
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  minHeightClass?: string;
}) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col", screenShellPaddingClass, minHeightClass, maxWidthClass, className)}
    >
      {children}
    </div>
  );
}

export function TitledScreenShell({
  title,
  onOpenMenu,
  menuLabel,
  children,
  className,
  maxWidthClass,
  minHeightClass,
  align,
  headerActions,
}: {
  title: ReactNode;
  onOpenMenu: (rect?: DOMRect) => void;
  menuLabel: string;
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  minHeightClass?: string;
  align?: "center" | "start";
  headerActions?: ReactNode;
}) {
  const trailing = headerActions ? (
    <div className="flex items-center gap-2">
      {headerActions}
      <HamburgerTrigger onClick={onOpenMenu} label={menuLabel} />
    </div>
  ) : (
    <HamburgerTrigger onClick={onOpenMenu} label={menuLabel} />
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageLayout {...(align ? { align } : {})}>
        <ScreenShell
          className={cn("relative z-10", className)}
          {...(maxWidthClass ? { maxWidthClass } : {})}
          {...(minHeightClass ? { minHeightClass } : {})}
        >
          <ScreenHeaderRow title={title} trailing={trailing} />
          {children}
        </ScreenShell>
      </PageLayout>
    </div>
  );
}

export function ScreenDescription({
  children,
  className,
  tone,
}: {
  children: string;
  className?: string;
  tone?: "default" | "danger";
}) {
  return (
    <p
      className={cn(
        "mx-auto max-w-lg text-center",
        screenDescriptionClass,
        tone === "danger" ? "text-red-100/75" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
