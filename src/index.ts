import { forwardRef, createElement } from 'react';
import type { SVGProps, ForwardRefExoticComponent, RefAttributes } from 'react';
import type { IconNode, IconNodeElement } from './types';

export type { IconNode, IconNodeElement } from './types';

export type IconComponent = ForwardRefExoticComponent<
  SVGProps<SVGSVGElement> & RefAttributes<SVGSVGElement>
>;

function renderNode(nodes: IconNode): ReturnType<typeof createElement>[] {
  return nodes.map(([tag, attrs, children], i) =>
    createElement(
      tag as keyof SVGElementTagNameMap,
      { key: i, ...attrs },
      ...(children ? renderNode(children) : []),
    ),
  );
}

export function createIconiaIcon(
  displayName: string,
  iconNode: IconNode,
  svgAttrs: Record<string, string> = {},
): IconComponent {
  const Component = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
    ({ children, ...props }, ref) =>
      createElement(
        'svg',
        { ref, xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', ...svgAttrs, ...props },
        ...renderNode(iconNode),
        children,
      ),
  );
  Component.displayName = displayName;
  return Component;
}

export type { IconiaConfig } from './cli/config';
