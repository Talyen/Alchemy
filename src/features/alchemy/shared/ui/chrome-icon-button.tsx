import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHROME_ICON_BUTTON_CLASS =
  "h-11 w-11 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground";

const CHROME_ICON_BUTTON_ACTIVE_CLASS = "bg-muted/40 text-foreground";

export function ChromeIconButton({
  active = false,
  variant = "ghost",
  className,
  ...props
}: ComponentProps<"button"> & {
  active?: boolean | undefined;
  variant?: "ghost" | "primary";
}) {
  const showActive = active && variant === "ghost";
  return (
    <Button
      variant={variant}
      size="icon"
      className={cn(
        "h-11 w-11",
        variant === "ghost" && CHROME_ICON_BUTTON_CLASS,
        showActive && CHROME_ICON_BUTTON_ACTIVE_CLASS,
        className,
      )}
      {...props}
    />
  );
}
