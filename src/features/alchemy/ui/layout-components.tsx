// Shared page scaffolding for game screens.
// Depends on text animation and class-name utilities.
// Used by screens that need consistent header, description, and scroll layout.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TextAnimate } from "@/components/ui/text-animate";

export function ScreenHeader({ title, className }: { title: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <h1 className="font-display text-lg font-black uppercase tracking-[0.15em] text-amber-100/75 sm:text-xl">
        {title}
      </h1>
      <div className="mt-2 h-px w-44 bg-gradient-to-r from-transparent via-amber-100/75 to-transparent" />
    </div>
  );
}

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="game-page-scroll flex h-full w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-6">
      {children}
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
    <TextAnimate
      once
      className={cn(
        "mx-auto max-w-lg text-center text-sm leading-relaxed",
        tone === "danger" ? "text-red-100/75" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </TextAnimate>
  );
}
