import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig } from '../config';
import { apiGetIcons } from '../api';
import { generateCollection, generateVariant, ensureWildcardExport } from '../generate';
import { readLock, writeLock, updateLockCollection } from '../lock';

export const syncCommand = new Command('sync')
  .description('Sync icons: add new, update changed, remove deleted — without full re-fetch')
  .option('-c, --collection <slug>', 'Sync only this collection')
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

    let remoteIcons;
    try {
      remoteIcons = await apiGetIcons(config, slugs);
    } catch (err) {
      spinner.fail(pc.red(`Failed to fetch icons: ${(err as Error).message}`));
      process.exit(1);
    }

    // Group by collection
    const byCollection = new Map<string, typeof remoteIcons>();
    for (const icon of remoteIcons) {
      const list = byCollection.get(icon.collectionSlug) ?? [];
      list.push(icon);
      byCollection.set(icon.collectionSlug, list);
    }

    let lock = readLock();
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;
    let regenerated = 0;

    for (const slug of slugs) {
      const remoteList = byCollection.get(slug) ?? [];
      const localLock = lock.collections[slug]?.icons ?? {};

      // remote fingerprint map
      const remoteMap = new Map(remoteList.map((i) => [i.slug, i]));
      const localSlugs = new Set(Object.keys(localLock));
      const remoteSlugs = new Set(remoteMap.keys());

      const added = [...remoteSlugs].filter((s) => !localSlugs.has(s));
      const removed = [...localSlugs].filter((s) => !remoteSlugs.has(s));
      const changed = [...remoteSlugs].filter(
        (s) => localSlugs.has(s) && localLock[s] !== remoteMap.get(s)!.fingerprint,
      );

      if (added.length === 0 && removed.length === 0 && changed.length === 0) {
        console.log(pc.dim(`  ${slug}: up to date`));
        continue;
      }

      // Log diff
      if (added.length > 0) {
        console.log(pc.green(`  ${slug}: +${added.length} added`) + pc.dim(` (${added.slice(0, 5).join(', ')}${added.length > 5 ? '…' : ''})`));
      }
      if (changed.length > 0) {
        console.log(pc.blue(`  ${slug}: ~${changed.length} updated`) + pc.dim(` (${changed.slice(0, 5).join(', ')}${changed.length > 5 ? '…' : ''})`));
      }
      if (removed.length > 0) {
        console.log(pc.red(`  ${slug}: -${removed.length} removed`) + pc.dim(` (${removed.slice(0, 5).join(', ')}${removed.length > 5 ? '…' : ''})`));
      }

      // Regenerate collection files split by variant
      if (remoteList.length > 0) {
        const noVariant = remoteList.filter((i) => !i.variantSlug);
        if (noVariant.length > 0) generateCollection(slug, noVariant);

        const byVariant = new Map<string, typeof remoteList>();
        for (const icon of remoteList) {
          if (!icon.variantSlug) continue;
          const list = byVariant.get(icon.variantSlug) ?? [];
          list.push(icon);
          byVariant.set(icon.variantSlug, list);
        }
        for (const [variant, variantIcons] of byVariant) {
          generateVariant(slug, variant, variantIcons);
        }
      }

      lock = updateLockCollection(lock, slug, remoteList.map((i) => ({ slug: i.slug, fingerprint: i.fingerprint })));

      totalAdded += added.length;
      totalUpdated += changed.length;
      totalRemoved += removed.length;
      regenerated++;
    }

    writeLock(lock);
    if (regenerated > 0) ensureWildcardExport();

    if (regenerated === 0) {
      spinner.succeed(pc.green('Everything is up to date.'));
    } else {
      spinner.succeed(
        pc.green(`Sync complete: ${totalAdded} added, ${totalUpdated} updated, ${totalRemoved} removed across ${regenerated} collection${regenerated !== 1 ? 's' : ''}`),
      );
    }
  });
