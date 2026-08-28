import { useState } from "react";

export function useChangeToken(value: number | string) {
  const [previousValue, setPreviousValue] = useState(value);
  const [token, setToken] = useState(0);

  if (!Object.is(previousValue, value)) {
    setPreviousValue(value);
    setToken((current) => current + 1);
  }

  return token;
}
