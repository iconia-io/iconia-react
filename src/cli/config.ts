import { z } from "zod";
import path from "path";

// Public-facing type for iconia.config.ts
export type IconiaConfig = {
  apiKey?: string;
  collections?: string[];
  uploadBatchSize?: number;
};

const configSchema = z.object({
  apiKey: z.string().optional(),
  collections: z.array(z.string()).default([]),
  uploadBatchSize: z.number().int().min(1).max(100).default(50),
});

// Internal resolved config used by CLI commands
export type ResolvedConfig = {
  apiKey: string;
  collections: string[];
  uploadBatchSize: number;
  apiUrl: string;
};

const API_URL = "https://api.iconia.io";

export async function loadConfig(): Promise<ResolvedConfig> {
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
        "Could not find iconia.config.ts or iconia.config.js\nRun `npx @iconia/react init` to create one.",
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

  const apiKey = process.env.ICONIA_API_KEY || result.data.apiKey;
  if (!apiKey) {
    throw new Error(
      "No API key found. Set the ICONIA_API_KEY environment variable or add apiKey to iconia.config.ts.",
    );
  }

  const internal = (rawConfig as { __internal?: { endpoint?: string } })
    .__internal;
  const apiUrl = internal?.endpoint ?? API_URL;

  return { ...result.data, apiKey, apiUrl };
}
