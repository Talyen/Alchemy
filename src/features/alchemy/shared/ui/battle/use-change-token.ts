// Small UI hook for replaying value-change animations.
// Used by battle widgets that animate health or mana when numeric values change.
import { useState } from "react";

// Returns a token that changes after a value update so keyed elements can replay animation.
export function useChangeToken(value: number | string) {
  const [previousValue, setPreviousValue] = useState(value);
  const [token, setToken] = useState(0);

  if (!Object.is(previousValue, value)) {
    setPreviousValue(value);
    setToken((current) => current + 1);
  }

  return token;
}
