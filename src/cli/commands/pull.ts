import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import ora from 'ora';
import { loadConfig, type IconiaConfig } from '../config';
import { svgToIconNode } from '../../generator/svgParser';
import { generateCollectionFile, generateCollectionDts, toPascalCase } from '../../generator/componentGenerator';

type IconPayload = {
  id: string;
  name: string;
  slug: string;
  svgContent: string;
  collectionSlug: string;
  tags: string[];
};

async function fetchIcons(config: IconiaConfig): Promise<IconPayload[]> {
  const url = new URL('/v1/collections/icons', config.apiUrl);
  url.searchParams.set('collections', config.collections.join(','));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `ApiKey ${config.apiKey}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `API error ${res.status}: ${(body as { error?: string }).error ?? res.statusText}`,
    );
  }

  const data = (await res.json()) as { icons: IconPayload[] };
  return data.icons;
}

export const pullCommand = new Command('pull')
  .description('Fetch icons from your Iconia collections and generate React components')
  .action(async () => {
    const spinner = ora('Loading config...').start();

    let config: IconiaConfig;
    try {
      config = await loadConfig();
    } catch (err) {
      spinner.fail(pc.red((err as Error).message));
      process.exit(1);
    }

    spinner.text = 'Fetching icons...';

    let icons: IconPayload[];
    try {
      icons = await fetchIcons(config);
    } catch (err) {
      spinner.fail(pc.red(`Failed to fetch icons: ${(err as Error).message}`));
      process.exit(1);
    }

    if (icons.length === 0) {
      spinner.warn(pc.yellow('No icons found in the specified collections.'));
      return;
    }

    spinner.text = `Generating ${icons.length} icon${icons.length !== 1 ? 's' : ''}...`;

    // Package root: dist/cli/index.js → ../../ = iconia package root
    const packageDir = path.resolve(__dirname, '../..');

    // Group icons by collection
    const byCollection = new Map<string, IconPayload[]>();
    for (const icon of icons) {
      const col = icon.collectionSlug;
      if (!byCollection.has(col)) byCollection.set(col, []);
      byCollection.get(col)!.push(icon);
    }

    let totalGenerated = 0;
    const collections: string[] = [];

    for (const [collectionSlug, collectionIcons] of byCollection) {
      const entries: Array<{ name: string; iconNode: ReturnType<typeof svgToIconNode>['iconNode']; svgAttrs: Record<string, string> }> = [];

      for (const icon of collectionIcons) {
        try {
          const { iconNode, svgAttrs } = svgToIconNode(icon.svgContent);
          entries.push({ name: icon.name, iconNode, svgAttrs });
        } catch (err) {
          console.warn(pc.yellow(`  ⚠ Skipped ${icon.name}: ${(err as Error).message}`));
        }
      }

      if (entries.length === 0) continue;

      const jsContent = generateCollectionFile(entries);
      const dtsContent = generateCollectionDts(entries.map((e) => e.name));

      fs.writeFileSync(path.join(packageDir, `${collectionSlug}.js`), jsContent, 'utf-8');
      fs.writeFileSync(path.join(packageDir, `${collectionSlug}.d.ts`), dtsContent, 'utf-8');

      totalGenerated += entries.length;
      collections.push(collectionSlug);
    }

    spinner.succeed(
      pc.green(
        `Generated ${totalGenerated} icon${totalGenerated !== 1 ? 's' : ''} across ${collections.length} collection${collections.length !== 1 ? 's' : ''}`,
      ),
    );

    if (collections.length > 0) {
      const exampleCollection = collections[0];
      const exampleIcon = toPascalCase(byCollection.get(exampleCollection)![0]?.name ?? 'MyIcon');
      console.log(
        `\nImport icons:\n  ${pc.cyan(`import { ${exampleIcon} } from 'iconia/${exampleCollection}'`)}`,
      );
    }
  });
