import { ArrowUp, Check, LockKeyhole } from "lucide-react";
import { type Ref } from "react";
import { cn } from "@/lib/utils";
import { Surface } from "../../../shared/ui/surface";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadArtwork({ node }: { node: HomesteadNodeModel }) {
  return (
    <img
      src={node.art}
      alt={node.title}
      draggable={false}
      className={cn(
        "block h-auto w-full rounded-xl",
        !node.discovered ? "opacity-45 grayscale" : node.level === 0 && "opacity-60 grayscale",
      )}
    />
  );
}

export function HomesteadGalleryNode({
  node,
  onInspect,
  buttonRef,
}: {
  node: HomesteadNodeModel;
  onInspect: () => void;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
}) {
  const complete = node.level >= node.maxLevel;
  return (
    <Surface
      as="button"
      buttonRef={buttonRef}
      onClick={onInspect}
      ariaLabel={`View ${node.title}${node.affordable ? `, ${node.action.toLowerCase()} available` : ""}`}
      clipContents={false}
      className="group w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <div className="overflow-hidden rounded-xl border border-border/60 transition-colors group-hover:border-foreground/30">
        <HomesteadArtwork node={node} />
      </div>
      <div className="mt-3 flex min-h-6 items-start justify-between gap-3 px-1">
        <span className="text-base font-medium text-foreground/90">{node.title}</span>
        <span className="shrink-0 text-base font-medium">
          {node.affordable ? (
            <span className="inline-flex items-center gap-1 text-gold-pale">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              {node.action}
            </span>
          ) : complete ? (
            <Check className="h-4 w-4 text-muted-foreground" aria-label={node.companion ? "Max bond" : "Complete"} />
          ) : !node.discovered ? (
            <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-label="Undiscovered" />
          ) : null}
        </span>
      </div>
    </Surface>
  );
}
