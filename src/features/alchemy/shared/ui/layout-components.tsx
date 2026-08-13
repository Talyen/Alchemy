// Shared page scaffolding for game screens.
// Depends on text animation and class-name utilities.
// Used by screens that need consistent header, description, and scroll layout.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { screenDescriptionClass, screenTitleClass } from "../config";
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
  // Outer scroller + inner min-h-full center: keeps justify-center from jumping when
  // abspos feedback (combat text, ghosts, hurt sparks) changes scrollHeight.
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
  minHeightClass = "min-h-[57.78cqh]", // 1.2× former 48.15cqh
}: {
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  minHeightClass?: string;
}) {
  return (
    <div
      className={cn(
        "alchemy-shell mx-auto flex w-full flex-col rounded-shell-screen p-[2.1rem]",
        minHeightClass,
        maxWidthClass,
        className,
      )}
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
}: {
  title: ReactNode;
  onOpenMenu: (rect?: DOMRect) => void;
  menuLabel: string;
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  minHeightClass?: string;
  align?: "center" | "start";
}) {
  return (
    <PageLayout {...(align ? { align } : {})}>
      <ScreenShell
        {...(maxWidthClass ? { maxWidthClass } : {})}
        {...(minHeightClass ? { minHeightClass } : {})}
        {...(className ? { className } : {})}
      >
        <ScreenHeaderRow title={title} trailing={<HamburgerTrigger onClick={onOpenMenu} label={menuLabel} />} />
        {children}
      </ScreenShell>
    </PageLayout>
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
