import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type UseLocalStorageOptions<T> = {
  defaultValue: T;
  key: string;
};

function resolveValue<T>(value: T | (() => T)) {
  return value instanceof Function ? value() : value;
}

export function useLocalStorage<T>({ defaultValue, key }: UseLocalStorageOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return defaultValue;
    }

    try {
      return JSON.parse(storedValue) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    setState((current) => resolveValue(value instanceof Function ? () => value(current) : value));
  };

  return [state, setValue];
}