import { expect, it } from "vitest";
import { reactCompilerPlugin } from "../../scripts/lib/vite-react-compiler.mjs";

async function transform(command: string, sourcemap: boolean | string) {
  const plugin = await reactCompilerPlugin();
  const environment = { name: "client", config: { consumer: "client" } };
  await plugin.configResolved({ command, build: { sourcemap } });
  const apply = plugin.applyToEnvironment as (environment: unknown) => boolean;
  expect(apply(environment)).toBe(true);
  const hook = plugin.transform as {
    handler: (
      this: unknown,
      code: string,
      id: string,
      options: { moduleType: string },
    ) => Promise<{ code: string; map: unknown }>;
  };
  return hook.handler.call(
    {
      environment,
      error: (error: unknown) => {
        throw error;
      },
    },
    "export function Greeting({ name }: { name: string }) { return <h1>Hello {name}</h1>; }",
    "/fixture/Greeting.tsx",
    { moduleType: "tsx" },
  );
}

it("omits discarded maps without changing compiled component code", async () => {
  const withoutMaps = await transform("build", false);
  const hiddenMaps = await transform("build", "hidden");
  expect(withoutMaps.map).toBeNull();
  expect(hiddenMaps.map).toMatchObject({ sources: expect.arrayContaining(["Greeting.tsx"]) });
  expect(withoutMaps.code).toBe(hiddenMaps.code);
  expect(withoutMaps.code).toContain("react/compiler-runtime");
});

it("retains maps for development and explicit build overrides", async () => {
  for (const [command, sourcemap] of [
    ["serve", false],
    ["build", true],
    ["build", "inline"],
  ] as const) {
    const result = await transform(command, sourcemap);
    expect(result.map).toMatchObject({ sources: expect.arrayContaining(["Greeting.tsx"]) });
  }
});
