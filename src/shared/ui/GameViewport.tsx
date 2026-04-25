import type { ReactNode } from 'react';

type GameViewportProps = {
  children: ReactNode;
};

export function GameViewport({ children }: GameViewportProps) {
  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(73,106,161,0.14),transparent_24%),linear-gradient(180deg,rgba(10,12,18,1)_0%,rgba(4,6,11,1)_100%)]"
    >
      {children}
    </div>
  );
}
