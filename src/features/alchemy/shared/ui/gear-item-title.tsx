import { getGearInstanceShineGradient, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

interface Props {
  instance: GearInstance;
  className?: string;
}

export function GearItemTitle({ instance, className }: Props) {
  const title = getGearInstanceTitle(instance);
  const gradient = getGearInstanceShineGradient(instance);

  if (gradient) {
    return (
      <span
        className={cn(
          "boss-title-shine [background-size:300%_300%] bg-clip-text whitespace-nowrap text-transparent",
          className,
        )}
        style={{ backgroundImage: gradient }}
      >
        {title}
      </span>
    );
  }

  return <span className={cn("whitespace-nowrap text-stone-100", className)}>{title}</span>;
}
