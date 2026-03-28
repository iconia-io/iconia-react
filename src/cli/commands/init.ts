import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';

const TEMPLATE = `import type { IconiaConfig } from 'iconia';

const config: IconiaConfig = {
  apiKey: process.env.ICONIA_API_KEY ?? '',
  collections: ['my-icons'],
  apiUrl: 'https://api.iconia.io',
};

export default config;
`;

export const initCommand = new Command('init')
  .description('Create an iconia.config.ts file in the current directory')
  .action(() => {
    const configPath = path.resolve(process.cwd(), 'iconia.config.ts');

    if (fs.existsSync(configPath)) {
      console.log(pc.yellow('iconia.config.ts already exists. Skipping.'));
      return;
    }

    fs.writeFileSync(configPath, TEMPLATE);
    console.log(pc.green('✓ Created iconia.config.ts'));

    console.log('\nNext steps:');
    console.log(`  1. Set ${pc.cyan('ICONIA_API_KEY')} in your environment`);
    console.log(`  2. Edit ${pc.cyan('iconia.config.ts')} to add your collections`);
    console.log(`  3. Run ${pc.cyan('npx iconia pull')} to fetch icons`);
    console.log(
      `\nImport icons: ${pc.cyan("import { MyIcon } from 'iconia/my-collection'")}`,
    );
  });
