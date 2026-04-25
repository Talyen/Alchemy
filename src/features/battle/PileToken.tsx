type PileTokenProps = {
  count: number;
  imagePath: string;
  label: string;
  subtitle?: string;
};

export function PileToken({ count, imagePath, label, subtitle }: PileTokenProps) {
  return (
    <div className="flex w-[108px] flex-col items-center gap-2">
      <div className="relative">
        <img alt={label} className="block h-[104px] w-[104px]" src={imagePath} />
        <span className="absolute right-1 top-1 inline-flex min-w-7 items-center justify-center rounded-full border border-primary/40 bg-primary px-2 py-1 text-xs font-bold text-primary-foreground shadow-panel">
          {count}
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <p className="font-bold">{label}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}