process.on('SIGINT', () => process.exit(130));

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { pullCommand } from './commands/pull';
import { addCommand } from './commands/add';
import { removeCommand } from './commands/remove';
import { syncCommand } from './commands/sync';
import { uploadCommand } from './commands/upload';

const program = new Command('iconia')
  .version('0.1.0')
  .description('CLI for fetching and generating React icon components from Iconia')
  .addCommand(initCommand)
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(pullCommand)
  .addCommand(syncCommand)
  .addCommand(uploadCommand);

program.parse(process.argv);
