import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";

/** Preserve debugging maps, but avoid constructing maps that the bundle discards. */
export async function reactCompilerPlugin() {
  const options = {
    include: /\.(?:[jt]sx|ts)$/,
    presets: [reactCompilerPreset()],
    sourceMap: true,
  };
  const plugin = await babel(options);
  const resolvedHook = plugin.configResolved;
  return {
    ...plugin,
    configResolved(config) {
      // Use resolved settings: CLI --sourcemap overrides the config-file default.
      options.sourceMap = config.command === "serve" || Boolean(config.build.sourcemap);
      const handler = typeof resolvedHook === "function" ? resolvedHook : resolvedHook?.handler;
      return handler?.call(this, config);
    },
  };
}
