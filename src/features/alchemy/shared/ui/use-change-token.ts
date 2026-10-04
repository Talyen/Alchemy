import { useState } from "react";

export function useChangeToken(value: number | string) {
  const [previous, setPrevious] = useState({ value, token: 0 });

  if (!Object.is(previous.value, value)) {
    setPrevious({ value, token: previous.token + 1 });
  }

  return previous.token;
}
