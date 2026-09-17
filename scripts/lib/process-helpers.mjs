function formatProcessError(label, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`FAILED ${label}: ${detail}`);
  return { message: `FAILED ${label}: ${detail}`, entry: null };
}

export function targetErrorHandler(item, error) {
  const label = typeof item === "string" ? item : (item?.target ?? String(item));
  return formatProcessError(label, error);
}

export function failedOptimizeResult(results, skipLabel) {
  console.warn(`Skipping ${skipLabel} because optimization failed.`);
  return {
    ok: false,
    error: results
      .filter((result) => result.failed)
      .map((result) => result.message)
      .join(" "),
  };
}
