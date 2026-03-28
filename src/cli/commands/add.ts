import { Command } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig } from '../config';
import { apiGetCollections, apiGetIcons } from '../api';
import { generateCollection } from '../generate';
import { readLock, writeLock, updateLockCollection } from '../lock';
import { findConfigPath, readConfigCollections, writeConfigCollections } from '../configWriter';
import { toPascalCase } from '../../generator/componentGenerator';

export const addCommand = new Command('add')
  .description('Add a collection to your project (updates config and downloads icons)')
  .argument('<slug>', 'Collection slug')
  .action(async (slug: string) => {
    const spinner = ora('Loading config...').start();

    let config;
    try {
      config = await loadConfig();
    } catch (err) {
      spinner.fail(pc.red((err as Error).message));
      process.exit(1);
    }

    if (config.collections.includes(slug)) {
      spinner.info(pc.yellow(`Collection '${slug}' is already in your config. Running pull...`));
    } else {
      spinner.text = 'Verifying collection...';

      let remoteCollections;
      try {
        remoteCollections = await apiGetCollections(config);
      } catch (err) {
        spinner.fail(pc.red(`Failed to fetch collections: ${(err as Error).message}`));
        process.exit(1);
      }

      const found = remoteCollections.find((c) => c.slug === slug);
      if (!found) {
        spinner.fail(
          pc.red(`Collection '${slug}' not found. Available: ${remoteCollections.map((c) => c.slug).join(', ') || 'none'}`),
        );
        process.exit(1);
      }

      // Update config file
      const configPath = findConfigPath();
      if (!configPath) {
        spinner.fail(pc.red('Config file not found. Run `npx iconia init` first.'));
        process.exit(1);
      }

      const current = readConfigCollections(configPath) ?? config.collections;
      const updated = [...current, slug];
      const ok = writeConfigCollections(configPath, updated);
      if (!ok) {
        spinner.warn(
          pc.yellow(`Could not update config automatically. Add '${slug}' to collections in iconia.config.ts manually.`),
        );
      } else {
        spinner.text = `Added '${slug}' to config. Fetching icons...`;
      }
    }

    spinner.text = `Fetching icons for '${slug}'...`;

    let icons;
    try {
      icons = await apiGetIcons(config, [slug]);
    } catch (err) {
      spinner.fail(pc.red(`Failed to fetch icons: ${(err as Error).message}`));
      process.exit(1);
    }

    if (icons.length === 0) {
      spinner.warn(pc.yellow(`No icons in collection '${slug}'.`));
      return;
    }

    spinner.text = `Generating ${icons.length} icon${icons.length !== 1 ? 's' : ''}...`;

    const count = generateCollection(slug, icons);
    let lock = readLock();
    lock = updateLockCollection(lock, slug, icons.map((i) => ({ slug: i.slug, fingerprint: i.fingerprint })));
    writeLock(lock);

    spinner.succeed(pc.green(`Added '${slug}' — ${count} icon${count !== 1 ? 's' : ''} generated`));

    const example = toPascalCase(icons[0]?.name ?? 'Icon');
    console.log(`\nImport icons:\n  ${pc.cyan(`import { ${example} } from 'iconia/${slug}'`)}`);
  });
