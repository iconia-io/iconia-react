import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';
import { svgToIconNode } from '../generator/svgParser';
import { generateCollectionFile, generateCollectionDts } from '../generator/componentGenerator';
import type { RemoteIcon } from './api';

/** Directory where generated collection files are written (the package root) */
export function getPackageDir(): string {
  // import.meta.url resolves at runtime to the actual installed location,
  // unlike __dirname which Bun bakes in as the build-machine path.
  // dist/cli/index.js → ../../ = package root (node_modules/iconia/)
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

/**
 * Generate .js and .d.ts files for a collection.
 * Returns number of icons successfully generated.
 */
export function generateCollection(
  collectionSlug: string,
  collectionIcons: RemoteIcon[],
): number {
  const entries: Array<{
    name: string;
    iconNode: ReturnType<typeof svgToIconNode>['iconNode'];
    svgAttrs: Record<string, string>;
  }> = [];

  for (const icon of collectionIcons) {
    try {
      const { iconNode, svgAttrs } = svgToIconNode(icon.svgContent);
      entries.push({ name: icon.name, iconNode, svgAttrs });
    } catch (err) {
      console.warn(pc.yellow(`  ⚠ Skipped ${icon.name}: ${(err as Error).message}`));
    }
  }

  if (entries.length === 0) return 0;

  const packageDir = getPackageDir();
  fs.writeFileSync(
    path.join(packageDir, `${collectionSlug}.js`),
    generateCollectionFile(entries),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(packageDir, `${collectionSlug}.d.ts`),
    generateCollectionDts(entries.map((e) => e.name)),
    'utf-8',
  );

  return entries.length;
}

/**
 * Ensure the installed package.json has a wildcard export so that
 * `import { ... } from 'iconia/collection-slug'` works without reinstall.
 * Safe to call repeatedly — only writes if the entry is missing.
 */
export function ensureWildcardExport(): void {
  const pkgPath = path.join(getPackageDir(), 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
    const exports = (pkg['exports'] ?? {}) as Record<string, unknown>;
    if (exports['./*']) return; // already present
    pkg['exports'] = {
      '.': exports['.'] ?? {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.cjs',
      },
      './*': { import: './*.js', types: './*.d.ts' },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch {
    // non-fatal — older Node/bundlers resolve files without exports map anyway
  }
}

/** Delete generated files for a collection */
export function deleteCollection(collectionSlug: string): void {
  const packageDir = getPackageDir();
  const js = path.join(packageDir, `${collectionSlug}.js`);
  const dts = path.join(packageDir, `${collectionSlug}.d.ts`);
  if (fs.existsSync(js)) fs.unlinkSync(js);
  if (fs.existsSync(dts)) fs.unlinkSync(dts);
}
