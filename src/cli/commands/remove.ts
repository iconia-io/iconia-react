import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig } from '../config';
import { deleteCollection } from '../generate';
import { readLock, writeLock, removeLockCollection } from '../lock';
import { findConfigPath, readConfigCollections, writeConfigCollections } from '../configWriter';

export const removeCommand = new Command('remove')
  .description('Remove a collection from your project (updates config and deletes generated files)')
  .argument('<slug>', 'Collection slug')
  .action(async (slug: string) => {
    let config;
    try {
      config = await loadConfig();
    } catch (err) {
      console.error(pc.red((err as Error).message));
      process.exit(1);
    }

    if (!config.collections.includes(slug)) {
      console.warn(pc.yellow(`Collection '${slug}' is not in your config.`));
    } else {
      // Update config file
      const configPath = findConfigPath();
      if (configPath) {
        const current = readConfigCollections(configPath) ?? config.collections;
        const updated = current.filter((s) => s !== slug);
        const ok = writeConfigCollections(configPath, updated);
        if (!ok) {
          console.warn(
            pc.yellow(`Could not update config automatically. Remove '${slug}' from collections in iconia.config.ts manually.`),
          );
        }
      }
    }

    // Delete generated files
    deleteCollection(slug);

    // Remove from lock
    let lock = readLock();
    lock = removeLockCollection(lock, slug);
    writeLock(lock);

    console.log(pc.green(`✓ Removed collection '${slug}'`));
  });
