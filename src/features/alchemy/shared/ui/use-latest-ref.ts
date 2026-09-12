import { useRef, type RefObject } from "react";

export function useLatestRef<T>(value: T): RefObject<T> {
  const valueRef = useRef(value);

  // eslint-disable-next-line react-hooks/refs -- latest-ref contract; not a render input
  valueRef.current = value;
  return valueRef;
}
