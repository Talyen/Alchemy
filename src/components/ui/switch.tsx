// Styled Radix switch primitive for options toggles.
// Depends on @radix-ui/react-switch and class-name utilities.
// Used by settings rows that need accessible boolean controls.
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { ref?: React.Ref<HTMLButtonElement> }) => (
  <SwitchPrimitive.Root
    className={cn(
      "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-foreground data-[state=unchecked]:bg-muted-foreground"
      )}
    />
  </SwitchPrimitive.Root>
);

export { Switch };
