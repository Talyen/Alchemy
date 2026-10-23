import { useGameTranslation } from "@/components/use-game-translation";

import { DeckInspectButton } from "./deck-inspect-button";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { screenDescriptionClass, screenShellPaddingClass, screenTitleClass } from "../config";
import { ChromeIconButton } from "./chrome-icon-button";
import { HamburgerTrigger } from "./navigation";
import { useOptionalAppScreenChrome } from "@/app/app-screen-chrome-context";

export function ScreenHeader({ title, className }: { title: ReactNode; className?: string }) {
  useGameTranslation();
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <h1 className={cn("font-sans", screenTitleClass)}>{title}</h1>
      <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-gold-pale/75 to-transparent" />
    </div>
  );
}

export function ScreenHeaderRow({
  title,
  leading,
  trailing,
  onBack,
  onMenu,
  className,
}: {
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  className?: string;
}) {
  const i18n = useGameTranslation();
  const chrome = useOptionalAppScreenChrome();
  const effectiveBack = onBack ?? chrome?.onBack;
  const effectiveMenu = onMenu ?? chrome?.openGameMenu;

  const leadingContent =
    leading ??
    (effectiveBack ? (
      <ChromeIconButton onClick={effectiveBack} aria-label={i18n.text("ui.layout-components.1", "Back")}>
        <ArrowLeft />
      </ChromeIconButton>
    ) : null);

  const menuButton = effectiveMenu ? (
    <HamburgerTrigger
      onClick={effectiveMenu}
      label={i18n.text("ui.layout-components.2", "Open game menu")}
      active={chrome?.isMenuOpen}
    />
  ) : null;
  const trailingContent =
    trailing || menuButton ? (
      <div className="flex items-center gap-2">
        {trailing}
        {i18n.displayText(menuButton)}
      </div>
    ) : null;

  return (
    <div className={cn("flex min-h-10 w-full items-center justify-center", className)}>
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-3">
          <div className="flex items-center gap-2">
            {i18n.displayText(leadingContent)}
            {chrome?.deckInspection ? <DeckInspectButton {...chrome.deckInspection} /> : null}
          </div>
          <div className="flex min-w-0 flex-col items-center px-3 text-center">
            <h1 className={cn("text-center font-sans", screenTitleClass)}>{title}</h1>
          </div>
          <div className="flex items-center justify-end gap-2">{i18n.displayText(trailingContent)}</div>
        </div>
        <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-gold-pale/75 to-transparent" />
      </div>
    </div>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  useGameTranslation();
  return (
    <div className="game-page-scroll h-full w-full overflow-x-hidden overflow-y-auto px-5 py-7">
      <div className="flex min-h-full w-full flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function ScreenShell({
  children,
  className,
  maxWidthClass = "max-w-5xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
}) {
  useGameTranslation();
  return (
    <div className={cn("mx-auto flex w-full flex-col", screenShellPaddingClass, "min-h-0", maxWidthClass, className)}>
      {children}
    </div>
  );
}

export function TitledScreenShell({
  title,
  children,
  className,
  maxWidthClass,
  headerActions,
  leading,
  onBack,
  onMenu,
  aboveHeader,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
  headerActions?: ReactNode;
  leading?: ReactNode;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
  aboveHeader?: ReactNode;
}) {
  useGameTranslation();
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PageLayout>
        <ScreenShell className={cn("relative z-10", className)} {...(maxWidthClass ? { maxWidthClass } : {})}>
          {aboveHeader ? <div className="mb-3 flex justify-center">{aboveHeader}</div> : null}
          <ScreenHeaderRow title={title} leading={leading} trailing={headerActions} onBack={onBack} onMenu={onMenu} />
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
  useGameTranslation();
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
