import type { BuildConfig } from "bun";
import dts from "bun-plugin-dts";

const defaultBuildConfig: BuildConfig = {
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  external: ["react"],
  minify: true,
};

await Promise.all([
  // ESM library + .d.ts types
  Bun.build({
    ...defaultBuildConfig,
    plugins: [dts()],
    format: "esm",
    naming: "[dir]/[name].js",
  }),
  // CJS library
  Bun.build({
    ...defaultBuildConfig,
    format: "cjs",
    naming: "[dir]/[name].cjs",
  }),
  // CLI binary (ESM with shebang)
  Bun.build({
    entrypoints: ["./src/cli/index.ts"],
    outdir: "./dist/cli",
    format: "esm",
    target: "node",
    banner: "#!/usr/bin/env node",
    external: ["commander", "ora", "picocolors", "prettier", "svgo", "zod"],
    minify: true,
  }),
]);
