import { useState } from "react";

export function useChangeToken(value: number | string): number {
  const [previous, setPrevious] = useState({ value, token: 0 });

  if (!Object.is(previous.value, value)) {
    const next = { value, token: previous.token + 1 };
    setPrevious(next);
    return next.token;
  }

  return previous.token;
}
