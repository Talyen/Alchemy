import { builtinEnvironments, type Environment } from "vitest/runtime";

export default {
  ...builtinEnvironments.jsdom,
  async setup(global, options) {
    const storageDescriptors = new Map<string, PropertyDescriptor>();
    const restoreStorage = () => {
      for (const [key, descriptor] of storageDescriptors) Object.defineProperty(global, key, descriptor);
    };
    try {
      // Node's optional storage getters can throw or shadow the browser's storage.
      // Remove them before Vitest decides which JSDOM globals it needs to install.
      for (const key of ["localStorage", "sessionStorage"]) {
        const descriptor = Object.getOwnPropertyDescriptor(global, key);
        if (descriptor) {
          storageDescriptors.set(key, descriptor);
          delete global[key];
        }
      }
      const environment = await builtinEnvironments.jsdom.setup(global, options);
      return {
        async teardown(global) {
          try {
            await environment.teardown(global);
          } finally {
            restoreStorage();
          }
        },
      };
    } catch (error) {
      restoreStorage();
      throw error;
    }
  },
} satisfies Environment;
