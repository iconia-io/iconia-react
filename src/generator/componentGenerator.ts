import type { IconNode } from '../types';

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^(.)/, (_, char: string) => char.toUpperCase());
}

type IconEntry = {
  name: string;
  iconNode: IconNode;
  svgAttrs: Record<string, string>;
};

/**
 * Generates an ESM JavaScript file for a collection.
 * The file uses forwardRef + createElement directly (no internal imports).
 */
export function generateCollectionFile(icons: IconEntry[]): string {
  if (icons.length === 0) return '';

  const lines: string[] = [
    `import { forwardRef, createElement } from 'react';`,
    ``,
    // Inline recursive renderer helper
    `const _r = (n) => n.map(([t, a, c], i) => createElement(t, { key: i, ...a }, ...(c ? _r(c) : [])));`,
    ``,
  ];

  for (const { name, iconNode, svgAttrs } of icons) {
    const componentName = toPascalCase(name);
    const svgAttrsMerged = { viewBox: '0 0 24 24', ...svgAttrs };
    const nodeStr = JSON.stringify(iconNode);
    const attrsStr = JSON.stringify(svgAttrsMerged);

    lines.push(
      `export const ${componentName} = /*#__PURE__*/forwardRef(({ children, ...props }, ref) =>`,
      `  createElement('svg', { ref, xmlns: 'http://www.w3.org/2000/svg', ...${attrsStr}, ...props },`,
      `    ..._r(${nodeStr}),`,
      `    children`,
      `  )`,
      `);`,
      `${componentName}.displayName = '${componentName}';`,
      ``,
    );
  }

  return lines.join('\n');
}

/**
 * Generates a TypeScript declaration file for a collection.
 */
export function generateCollectionDts(componentNames: string[]): string {
  const lines: string[] = [
    `import type { ForwardRefExoticComponent, SVGProps, RefAttributes } from 'react';`,
    ``,
    `type IconComponent = ForwardRefExoticComponent<SVGProps<SVGSVGElement> & RefAttributes<SVGSVGElement>>;`,
    ``,
  ];

  for (const name of componentNames) {
    lines.push(`export declare const ${toPascalCase(name)}: IconComponent;`);
  }

  lines.push('');
  return lines.join('\n');
}
