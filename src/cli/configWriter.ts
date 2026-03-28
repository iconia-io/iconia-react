import fs from 'fs';
import path from 'path';

/** Find the config file path (ts or js) */
export function findConfigPath(): string | null {
  const ts = path.resolve(process.cwd(), 'iconia.config.ts');
  const js = path.resolve(process.cwd(), 'iconia.config.js');
  if (fs.existsSync(ts)) return ts;
  if (fs.existsSync(js)) return js;
  return null;
}

/**
 * Read the collections array from the config file text.
 * Returns slugs or null if it couldn't parse.
 */
export function readConfigCollections(filePath: string): string[] | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/collections:\s*\[([\s\S]*?)\]/);
  const inner = match?.[1];
  if (!inner) return null;
  const slugs: string[] = [];
  const itemRe = /['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(inner)) !== null) {
    const slug = m[1];
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/**
 * Write a new collections array back into the config file.
 * Returns true on success, false if the pattern wasn't found.
 */
export function writeConfigCollections(filePath: string, slugs: string[]): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  const arrayLiteral = slugs.length === 0
    ? '[]'
    : `[\n${slugs.map((s) => `    '${s}'`).join(',\n')},\n  ]`;
  const updated = content.replace(/collections:\s*\[[\s\S]*?\]/, `collections: ${arrayLiteral}`);
  if (updated === content) return false;
  fs.writeFileSync(filePath, updated, 'utf-8');
  return true;
}
