import { useEffect, useRef, useState } from 'react';

type SizeState<T extends HTMLElement> = {
  height: number;
  ref: React.RefObject<T | null>;
  width: number;
};

export function useElementSize<T extends HTMLElement>(): SizeState<T> {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;

      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : {
              width: nextWidth,
              height: nextHeight,
            },
      );
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    height: size.height,
    ref,
    width: size.width,
  };
}