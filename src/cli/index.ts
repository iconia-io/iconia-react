import { Command } from 'commander';
import { initCommand } from './commands/init';
import { pullCommand } from './commands/pull';

const program = new Command('iconia')
  .version('0.1.0')
  .description('CLI for fetching and generating React icon components from Iconia')
  .addCommand(initCommand)
  .addCommand(pullCommand);

program.parse(process.argv);
