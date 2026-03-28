import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig } from '../config';
import { apiUploadIcon } from '../api';

function toSlug(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function collectSvgFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (!target.endsWith('.svg')) {
      throw new Error(`File '${target}' is not an SVG.`);
    }
    return [target];
  }
  if (stat.isDirectory()) {
    return fs
      .readdirSync(target)
      .filter((f) => f.endsWith('.svg'))
      .map((f) => path.join(target, f));
  }
  throw new Error(`'${target}' is not a file or directory.`);
}

export const uploadCommand = new Command('upload')
  .description('Upload SVG file(s) to an Iconia collection')
  .argument('<path>', 'SVG file or directory of SVGs')
  .requiredOption('-c, --collection <slug>', 'Target collection slug')
  .option('--tags <tags>', 'Comma-separated tags to apply to all uploaded icons')
  .action(async (targetPath: string, opts: { collection: string; tags?: string }) => {
    const spinner = ora('Loading config...').start();

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
      spinner.warn(pc.yellow('No SVG files found.'));
      return;
    }

    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

    spinner.text = `Uploading ${files.length} file${files.length !== 1 ? 's' : ''} to '${opts.collection}'...`;

    let uploaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of files) {
      const slug = toSlug(file);
      if (!slug) {
        errors.push(`${path.basename(file)}: could not derive a valid slug`);
        failed++;
        continue;
      }

      const svgContent = fs.readFileSync(file, 'utf-8');

      try {
        await apiUploadIcon(config, {
          collectionSlug: opts.collection,
          name: toName(slug),
          slug,
          svgContent,
          tags,
        });
        uploaded++;
        spinner.text = `Uploading... (${uploaded}/${files.length})`;
      } catch (err) {
        errors.push(`${path.basename(file)}: ${(err as Error).message}`);
        failed++;
      }
    }

    if (failed === 0) {
      spinner.succeed(
        pc.green(`Uploaded ${uploaded} icon${uploaded !== 1 ? 's' : ''} to '${opts.collection}'`),
      );
    } else {
      spinner.warn(
        pc.yellow(`Uploaded ${uploaded}, failed ${failed}`),
      );
      for (const e of errors) {
        console.log(pc.dim(`  ✗ ${e}`));
      }
    }
  });
