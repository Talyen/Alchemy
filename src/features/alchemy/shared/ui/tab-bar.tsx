import { useGameTranslation } from "@/components/use-game-translation";

import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";

export interface TabBarProps<T extends string> {
  tabs: Array<{
    id: T;
    label: string;
    ariaLabel?: string;
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
  const i18n = useGameTranslation();
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
            onClick={() => {
              onSelectTab(tab.id);
              if (tab.id !== activeTab) playUISound("selection");
            }}
            className={tab.id === activeTab ? activeClassName : undefined}
            wrapperClassName="shrink-0"
            aria-label={i18n.displayText(
              isDisabled
                ? i18n.text("ui.tab-bar.d1", "{{value0}} (Locked)", {
                    value0: i18n.displayText(tab.ariaLabel ?? tab.label),
                  })
                : (tab.ariaLabel ?? tab.label),
            )}
            aria-pressed={tab.id === activeTab}
          >
            <Icon className={tab.iconClassName} />
            {i18n.displayText(tab.label)}
          </Button>
        );
      })}
    </div>
  );
}
