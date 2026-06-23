// Reusable card flip widget — two absolutely-positioned faces in a 3D container.
// Parent controls `flipped` state and provides front/back content (typically <img> elements).
import type { CSSProperties, ReactNode } from "react";

interface CardFlipProps {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  className?: string;
  style?: CSSProperties;
  transition?: string;
  onFlipEnd?: () => void;
}

const DEFAULT_TRANSITION = "transform 460ms cubic-bezier(0.16, 1, 0.3, 1)";

export function CardFlip({
  flipped,
  front,
  back,
  className,
  style,
  transition = DEFAULT_TRANSITION,
  onFlipEnd,
}: CardFlipProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        transformStyle: "preserve-3d",
        transition,
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        ...style,
      }}
      onTransitionEnd={onFlipEnd}
    >
      <div className="card-face absolute inset-0">{front}</div>
      <div className="card-face-back absolute inset-0">{back}</div>
    </div>
  );
}
