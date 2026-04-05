import { Command } from "commander";
import fs from "fs";
import path from "path";
import pc from "picocolors";
import ora from "ora";
import { loadConfig } from "../config";
import { apiUploadBatch } from "../api";
import { ac } from "../abort";


function toSlug(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function collectSvgFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (!target.endsWith(".svg")) {
      throw new Error(`File '${target}' is not an SVG.`);
    }
    return [target];
  }
  if (stat.isDirectory()) {
    return fs
      .readdirSync(target)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => path.join(target, f));
  }
  throw new Error(`'${target}' is not a file or directory.`);
}

export const uploadCommand = new Command("upload")
  .description("Upload SVG file(s) to an Iconia collection")
  .argument("<path>", "SVG file or directory of SVGs")
  .requiredOption("-c, --collection <slug>", "Target collection slug")
  .option("--variant <slug>", "Target variant within the collection")
  .option(
    "--tags <tags>",
    "Comma-separated tags to apply to all uploaded icons",
  )
  .action(
    async (targetPath: string, opts: { collection: string; variant?: string; tags?: string }) => {
      const spinner = ora({ text: "Loading config...", discardStdin: false }).start();

      let config;
      try {
        config = await loadConfig();
      } catch (err) {
        spinner.fail(pc.red((err as Error).message));
        process.exit(1);
      }

      let files: string[];
      try {
        files = collectSvgFiles(path.resolve(process.cwd(), targetPath));
      } catch (err) {
        spinner.fail(pc.red((err as Error).message));
        process.exit(1);
      }

      if (files.length === 0) {
        spinner.warn(pc.yellow("No SVG files found."));
        return;
      }

      const tags = opts.tags
        ? opts.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      spinner.text = `Uploading ${files.length} file${files.length !== 1 ? "s" : ""} to '${opts.collection}'...`;

      let uploaded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < files.length; i += config.uploadBatchSize) {
        if (ac.signal.aborted) break;

        const batch = files.slice(i, i + config.uploadBatchSize);
        const items = [];

        for (const file of batch) {
          const slug = toSlug(file);
          if (!slug) {
            errors.push(`${path.basename(file)}: could not derive a valid slug`);
            failed++;
            continue;
          }
          items.push({
            slug,
            name: toName(slug),
            svgContent: fs.readFileSync(file, "utf-8"),
            tags,
          });
        }

        if (items.length === 0) continue;

        try {
          const results = await apiUploadBatch(config, opts.collection, items, opts.variant || undefined);
          for (const r of results) {
            if (r.status === "uploaded" || r.status === "duplicate") {
              uploaded++;
            } else {
              errors.push(`${r.slug}: ${r.error ?? "upload failed"}`);
              failed++;
            }
          }
        } catch (err) {
          for (const item of items) {
            errors.push(`${item.slug}: ${(err as Error).message}`);
            failed++;
          }
        }

        spinner.text = `Uploading... (${uploaded + failed}/${files.length})`;
      }

      if (failed === 0) {
        spinner.succeed(
          pc.green(
            `Uploaded ${uploaded} icon${uploaded !== 1 ? "s" : ""} to '${opts.collection}'`,
          ),
        );
      } else {
        spinner.warn(pc.yellow(`Uploaded ${uploaded}, failed ${failed}`));
        for (const e of errors) {
          console.log(pc.dim(`  ✗ ${e}`));
        }
      }
    },
  );
