// CLI probes intercept every launch; their parent already owns the test lane.
export const isolatedTestResources = `
  const { registerHooks } = await import('node:module');
  registerHooks({ load(url, context, next) {
    if (!url.endsWith('/lib/verification/local-test-lane.mjs')) return next(url, context);
    return { format: 'module', shortCircuit: true, source:
      'export * from ' + JSON.stringify(url + '?probe') +
      '; export async function acquireTestResources() { return { kind: "broad", release: async () => {} }; }'
    };
  }});
`;
