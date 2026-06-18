import { getGearInstanceShineGradient, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

type Props = {
  instance: GearInstance;
  className?: string;
};

export function GearItemTitle({ instance, className }: Props) {
  const title = getGearInstanceTitle(instance);
  const gradient = getGearInstanceShineGradient(instance);

  if (gradient) {
    return (
      <span
        className={cn(
          "boss-title-shine whitespace-nowrap bg-clip-text text-transparent [background-size:300%_300%]",
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
