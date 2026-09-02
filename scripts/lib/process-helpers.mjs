export function formatProcessError(label, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`FAILED ${label}: ${detail}`);
  return { message: `FAILED ${label}: ${detail}`, entry: null };
}
