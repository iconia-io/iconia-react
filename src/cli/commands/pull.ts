import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig } from '../config';
import { apiGetIcons } from '../api';
import { generateCollection, ensureWildcardExport } from '../generate';
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

    // Group by collection
    const byCollection = new Map<string, typeof icons>();
    for (const icon of icons) {
      const list = byCollection.get(icon.collectionSlug) ?? [];
      list.push(icon);
      byCollection.set(icon.collectionSlug, list);
    }

    let lock = readLock();
    let totalGenerated = 0;
    const generated: string[] = [];

    for (const [slug, colIcons] of byCollection) {
      const count = generateCollection(slug, colIcons);
      if (count === 0) continue;
      totalGenerated += count;
      generated.push(slug);
      lock = updateLockCollection(lock, slug, colIcons.map((i) => ({ slug: i.slug, fingerprint: i.fingerprint })));
    }

    writeLock(lock);
    ensureWildcardExport();

    spinner.succeed(
      pc.green(`Generated ${totalGenerated} icon${totalGenerated !== 1 ? 's' : ''} across ${generated.length} collection${generated.length !== 1 ? 's' : ''}`),
    );

    if (generated.length > 0) {
      const first = generated[0] ?? '';
      const example = toPascalCase(byCollection.get(first)?.[0]?.name ?? 'MyIcon');
      console.log(`\nImport icons:\n  ${pc.cyan(`import { ${example} } from '@iconia/react/${first}'`)}`);
    }
  });
