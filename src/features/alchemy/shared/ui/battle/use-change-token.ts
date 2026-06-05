// Small UI hook for replaying value-change animations.
// Depends only on React state/effects.
// Used by battle widgets that animate health or mana when numeric values change.
import { useEffect, useRef, useState } from "react";

// Returns a token that changes after a value update so keyed elements can replay animation.
export function useChangeToken(value: number | string) {
  const previousValueRef = useRef(value);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    setToken((current) => current + 1);
  }, [value]);

  return token;
}
