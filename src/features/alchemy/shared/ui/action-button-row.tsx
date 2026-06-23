import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_TIER_CLASS, type ButtonWidthTier } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";

interface ActionButtonConfig {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface ActionButtonRowProps {
  secondary?: ActionButtonConfig | undefined;
  primary: ActionButtonConfig;
  size?: "default" | "lg";
  width?: ButtonWidthTier;
  className?: string;
}

export function ActionButtonRow({
  secondary,
  primary,
  size = "lg",
  width = "dialog",
  className,
}: ActionButtonRowProps) {
  const widthClass = BUTTON_WIDTH_TIER_CLASS[width];

  return (
    <div className={cn("flex flex-wrap justify-center gap-3", width === "dialog" && "gap-4", className)}>
      {secondary ? (
        <Button
          size={size}
          variant="outline"
          className={cn(widthClass, secondary.className)}
          disabled={secondary.disabled}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </Button>
      ) : null}
      <Button
        size={size}
        variant="primary"
        className={cn(widthClass, primary.className)}
        disabled={primary.disabled}
        onClick={primary.onClick}
      >
        {primary.label}
      </Button>
    </div>
  );
}
