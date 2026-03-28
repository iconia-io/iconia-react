import { z } from "zod";
import path from "path";

const configSchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
  collections: z
    .array(z.string())
    .min(1, "At least one collection is required"),
});

export type IconiaConfig = z.infer<typeof configSchema> & { apiUrl?: string };

const API_URL = "https://api.iconia.io";

export async function loadConfig(): Promise<IconiaConfig> {
  const configPath = path.resolve(process.cwd(), "iconia.config.ts");
  const jsConfigPath = path.resolve(process.cwd(), "iconia.config.js");

  let rawConfig: unknown;

  try {
    const mod = await import(configPath);
    rawConfig = mod.default ?? mod;
  } catch {
    try {
      const mod = await import(jsConfigPath);
      rawConfig = mod.default ?? mod;
    } catch {
      throw new Error(
        "Could not find iconia.config.ts or iconia.config.js\nRun `npx iconia init` to create one.",
      );
    }
  }

  const result = configSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid iconia config:\n${issues}`);
  }

  return { ...result.data, apiUrl: API_URL };
}
