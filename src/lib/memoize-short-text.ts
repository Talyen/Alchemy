/** Bound recurring descriptions while leaving long or transient input uncached. */
export function memoizeShortText<T>(parse: (text: string) => T): (text: string) => T {
  const cache = new Map<string, T>();
  return (text) => {
    if (text.length > 1024) return parse(text);
    const value = cache.has(text) ? cache.get(text)! : parse(text);
    cache.delete(text);
    cache.set(text, value);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    return value;
  };
}
