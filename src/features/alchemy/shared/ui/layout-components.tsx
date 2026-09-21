import { DeckInspectButton } from "./deck-inspect-button";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { screenDescriptionClass, screenShellPaddingClass, screenTitleClass } from "../config";
import { ChromeIconButton } from "./chrome-icon-button";
import { HamburgerTrigger } from "./navigation";
import { useOptionalAppScreenChrome } from "@/app/app-screen-chrome-context";

export function ScreenHeader({
  title,
  eyebrow,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {eyebrow ? (
        <p className="mb-1 text-sm font-semibold tracking-[0.22em] text-gold-pale/60 uppercase">{eyebrow}</p>
      ) : null}
      <h1 className={cn("font-sans", screenTitleClass)}>{title}</h1>
      <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-gold-pale/75 to-transparent" />
    </div>
  );
}

export function ScreenHeaderRow({
  title,
  eyebrow,
  leading,
  trailing,
  onBack,
  onMenu,
  className,
  leadingClassName,
  trailingClassName,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  className?: string;
  leadingClassName?: string;
  trailingClassName?: string;
}) {
  const chrome = useOptionalAppScreenChrome();
  const effectiveBack = onBack ?? chrome?.onBack;
  const effectiveMenu = onMenu ?? chrome?.openGameMenu;

  const leadingContent =
    leading ??
    (effectiveBack ? (
      <ChromeIconButton onClick={effectiveBack} aria-label="Back">
        <ArrowLeft className="h-7 w-7" />
      </ChromeIconButton>
    ) : null);

  const menuButton = effectiveMenu ? (
    <HamburgerTrigger onClick={effectiveMenu} label="Open game menu" active={chrome?.isMenuOpen} />
  ) : null;
  const trailingContent =
    trailing || menuButton ? (
      <div className="flex items-center gap-2">
        {trailing}
        {menuButton}
      </div>
    ) : null;

  return (
    <div className={cn("flex min-h-10 w-full items-center justify-center", className)}>
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className={cn("flex items-center gap-2", leadingClassName)}>
            {leadingContent}
            {chrome?.deckInspection ? <DeckInspectButton {...chrome.deckInspection} /> : null}
          </div>
          <div className="flex min-w-0 flex-col items-center px-3 text-center">
            {eyebrow ? (
              <p className="mb-1 text-sm font-semibold tracking-[0.22em] text-gold-pale/60 uppercase">{eyebrow}</p>
            ) : null}
            <h1 className={cn("text-center font-sans", screenTitleClass)}>{title}</h1>
          </div>
          <div className={cn("flex items-center justify-end gap-2", trailingClassName)}>{trailingContent}</div>
        </div>
        <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-gold-pale/75 to-transparent" />
      </div>
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
  eyebrow,
  children,
  className,
  maxWidthClass,
  minHeightClass,
  align,
  headerActions,
  leading,
  onBack,
  onMenu,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  minHeightClass?: string;
  align?: "center" | "start";
  headerActions?: ReactNode;
  leading?: ReactNode;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageLayout {...(align ? { align } : {})}>
        <ScreenShell
          className={cn("relative z-10", className)}
          {...(maxWidthClass ? { maxWidthClass } : {})}
          {...(minHeightClass ? { minHeightClass } : {})}
        >
          <ScreenHeaderRow
            title={title}
            eyebrow={eyebrow}
            leading={leading}
            trailing={headerActions}
            onBack={onBack}
            onMenu={onMenu}
          />
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
