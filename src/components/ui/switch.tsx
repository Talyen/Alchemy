import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<ComponentProps<"input">, "onChange" | "checked"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function Switch({ className, checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <span className={cn("relative inline-flex h-6 w-10 shrink-0", className)}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full border-2 border-transparent transition-colors not-checked:bg-muted checked:bg-primary focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0.5 block h-5 w-5 rounded-full shadow transition-transform peer-not-checked:bg-muted-foreground peer-checked:translate-x-4 peer-checked:bg-foreground"
      />
    </span>
  );
}

export { Switch };
