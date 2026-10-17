import { useRef } from "react";

export function useChangeToken(value: number | string): number {
  const ref = useRef({ value, token: 0 });

  if (!Object.is(ref.current.value, value)) {
    ref.current = { value, token: ref.current.token + 1 };
  }

  return ref.current.token;
}
