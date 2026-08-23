// Reusable tab bar with rectangular buttons.
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TabBarProps<T extends string> {
  tabs: Array<{
    id: T;
    label: string;
    icon: ElementType;
    disabled?: boolean;
    iconClassName?: string;
  }>;
  activeTab: T;
  onSelectTab: (tab: T) => void;
  activeClassName?: string;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  activeClassName = "ring-2 ring-primary/70 ring-offset-1 ring-offset-background",
  className,
}: TabBarProps<T>) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-3", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isDisabled = tab.disabled ?? false;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="outline"
            size="lg"
            disabled={isDisabled}
            onClick={() => onSelectTab(tab.id)}
            className={tab.id === activeTab ? activeClassName : "hover:border-border"}
            wrapperClassName="shrink-0"
            aria-label={isDisabled ? `${tab.label} (Locked)` : tab.label}
          >
            <Icon className={cn("h-7 w-7", tab.iconClassName)} />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
