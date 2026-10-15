/** One release operation, callable explicitly or owned by a `using` scope. */
export function createCleanup(cleanup: () => void): (() => void) & Disposable {
  let active = true;
  const release = () => {
    if (!active) return;
    active = false;
    cleanup();
  };
  return Object.assign(release, { [Symbol.dispose]: release });
}
