// Styled Radix switch primitive for options toggles.
// Depends on @radix-ui/react-switch and class-name utilities.
// Used by settings rows that need accessible boolean controls.
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { NO_FOCUS_RING } from "@/lib/ui/focus";
import { cn } from "@/lib/utils";

const Switch = ({ className, ref, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted focus-visible:border-amber-400/60 focus-visible:shadow-[0_0_0_2px_rgba(251,191,36,0.35)]",
      NO_FOCUS_RING,
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-5 w-5 rounded-full shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-foreground data-[state=unchecked]:bg-muted-foreground" />
  </SwitchPrimitive.Root>
);

export { Switch };
