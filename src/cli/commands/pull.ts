import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig } from '../config';
import { apiGetIcons } from '../api';
import { generateCollection, generateVariant, ensureWildcardExport } from '../generate';
import { readLock, writeLock, updateLockCollection } from '../lock';
import { toPascalCase } from '../../generator/componentGenerator';

export const pullCommand = new Command('pull')
  .description('Fetch icons and regenerate all collection files (replaces existing)')
  .option('-c, --collection <slug>', 'Pull only this collection')
  .action(async (opts: { collection?: string }) => {
    const spinner = ora('Loading config...').start();

    let config;
    try {
      config = await loadConfig();
    } catch (err) {
      spinner.fail(pc.red((err as Error).message));
      process.exit(1);
    }

    const slugs = opts.collection ? [opts.collection] : config.collections;

    if (slugs.length === 0) {
      spinner.warn(pc.yellow('No collections in config. Add one with `iconia add <slug>`.'));
      return;
    }

    if (opts.collection && !config.collections.includes(opts.collection)) {
      spinner.fail(pc.red(`Collection '${opts.collection}' is not in your config.`));
      process.exit(1);
    }

    spinner.text = `Fetching icons for ${slugs.join(', ')}...`;

    let icons;
    try {
      icons = await apiGetIcons(config, slugs);
    } catch (err) {
      spinner.fail(pc.red(`Failed to fetch icons: ${(err as Error).message}`));
      process.exit(1);
    }

    if (icons.length === 0) {
      spinner.warn(pc.yellow('No icons found.'));
      return;
    }

    spinner.text = `Generating ${icons.length} icon${icons.length !== 1 ? 's' : ''}...`;

    // Group by collection, then by variant (null = no variant)
    const byCollection = new Map<string, Map<string | null, typeof icons>>();
    for (const icon of icons) {
      if (!byCollection.has(icon.collectionSlug)) {
        byCollection.set(icon.collectionSlug, new Map());
      }
      const byVariant = byCollection.get(icon.collectionSlug)!;
      const key = icon.variantSlug || null;
      const list = byVariant.get(key) ?? [];
      list.push(icon);
      byVariant.set(key, list);
    }

    let lock = readLock();
    let totalGenerated = 0;
    const generatedCollections: string[] = [];
    let firstExampleIcon: string | undefined;
    let firstExamplePath: string | undefined;

    for (const [colSlug, byVariant] of byCollection) {
      let colGenerated = 0;

      // Icons without a variant → dist/{colSlug}.js
      const noVariantIcons = byVariant.get(null) ?? [];
      if (noVariantIcons.length > 0) {
        const count = generateCollection(colSlug, noVariantIcons);
        colGenerated += count;
        if (!firstExampleIcon && noVariantIcons[0]) {
          firstExampleIcon = noVariantIcons[0].name;
          firstExamplePath = colSlug;
        }
      }

      // Icons with a variant → dist/{colSlug}/{variantSlug}.js
      for (const [variant, variantIcons] of byVariant) {
        if (variant === null) continue;
        const count = generateVariant(colSlug, variant, variantIcons);
        colGenerated += count;
        if (!firstExampleIcon && variantIcons[0]) {
          firstExampleIcon = variantIcons[0].name;
          firstExamplePath = `${colSlug}/${variant}`;
        }
      }

      if (colGenerated === 0) continue;
      totalGenerated += colGenerated;
      generatedCollections.push(colSlug);
      lock = updateLockCollection(lock, colSlug, [...byVariant.values()].flat().map((i) => ({ slug: i.slug, fingerprint: i.fingerprint })));
    }

    writeLock(lock);
    ensureWildcardExport();

    spinner.succeed(
      pc.green(`Generated ${totalGenerated} icon${totalGenerated !== 1 ? 's' : ''} across ${generatedCollections.length} collection${generatedCollections.length !== 1 ? 's' : ''}`),
    );

    if (firstExamplePath && firstExampleIcon) {
      const example = toPascalCase(firstExampleIcon);
      console.log(`\nImport icons:\n  ${pc.cyan(`import { ${example} } from '@iconia/react/${firstExamplePath}'`)}`);
    }
  });
