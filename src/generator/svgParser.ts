import { optimize } from 'svgo';
import type { IconNode, IconNodeElement } from '../types';

export type { IconNode, IconNodeElement };

export type ParsedSvg = {
  viewBox: string;
  innerXml: string;
};

export function cleanSvg(svgContent: string): string {
  const result = optimize(svgContent, {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeTitle',
      'removeDesc',
    ],
  });
  // Remove width/height only from the root <svg> element
  return result.data.replace(/<svg([^>]*)>/i, (_, attrs: string) =>
    `<svg${attrs.replace(/\s+(width|height)=['"][^'"]*['"]/gi, '')}>`,
  );
}

export function parseSvg(svgContent: string): ParsedSvg {
  const cleaned = cleanSvg(svgContent);
  const viewBoxMatch = cleaned.match(/viewBox=["']([^"']+)["']/);
  const viewBox = viewBoxMatch?.[1] ?? '0 0 24 24';
  const innerMatch = cleaned.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const innerXml = innerMatch?.[1]?.trim() ?? '';
  return { viewBox, innerXml };
}

function parseAttributes(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // SVGO always uses double quotes, also handle single quotes
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    // Convert kebab-case and namespace prefixes to camelCase
    const key = m[1]
      .replace(/^xlink:/, '')
      .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    attrs[key] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

function parseXml(xml: string): IconNode {
  const nodes: IconNode = [];
  let i = 0;

  while (i < xml.length) {
    const tagStart = xml.indexOf('<', i);
    if (tagStart === -1) break;

    // Skip closing tags, comments, and processing instructions
    const nextChar = xml[tagStart + 1];
    if (nextChar === '/' || nextChar === '!' || nextChar === '?') {
      const end = xml.indexOf('>', tagStart);
      i = end === -1 ? xml.length : end + 1;
      continue;
    }

    // Find end of opening tag, respecting quoted attribute values
    let tagEnd = tagStart + 1;
    let inStr = false;
    let strChar = '';
    while (tagEnd < xml.length) {
      const ch = xml[tagEnd];
      if (inStr) {
        if (ch === strChar) inStr = false;
      } else if (ch === '"' || ch === "'") {
        inStr = true;
        strChar = ch;
      } else if (ch === '>') {
        break;
      }
      tagEnd++;
    }
    if (tagEnd >= xml.length) break;

    const rawTag = xml.slice(tagStart + 1, tagEnd);
    const selfClosing = rawTag.trimEnd().endsWith('/');
    const tagContent = selfClosing ? rawTag.slice(0, rawTag.lastIndexOf('/')).trim() : rawTag.trim();

    const spaceIdx = tagContent.search(/\s/);
    const tagName = spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx);
    if (!tagName) { i = tagEnd + 1; continue; }

    const attrStr = spaceIdx === -1 ? '' : tagContent.slice(spaceIdx + 1);
    const attrs = parseAttributes(attrStr);

    i = tagEnd + 1;

    if (selfClosing) {
      nodes.push([tagName, attrs]);
    } else {
      // Find matching closing tag, handling nested same-name elements
      const openTag = `<${tagName}`;
      const closeTag = `</${tagName}>`;
      let depth = 1;
      let pos = i;

      while (depth > 0 && pos < xml.length) {
        const nextOpen = xml.indexOf(openTag, pos);
        const nextClose = xml.indexOf(closeTag, pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen + openTag.length;
        } else {
          depth--;
          if (depth === 0) {
            const innerXml = xml.slice(i, nextClose);
            const children = parseXml(innerXml);
            const node: IconNodeElement =
              children.length > 0 ? [tagName, attrs, children] : [tagName, attrs];
            nodes.push(node);
            i = nextClose + closeTag.length;
          } else {
            pos = nextClose + closeTag.length;
          }
        }
      }

      if (depth > 0) {
        // Malformed — treat as self-closing
        nodes.push([tagName, attrs]);
      }
    }
  }

  return nodes;
}

export function svgToIconNode(svgContent: string): {
  iconNode: IconNode;
  svgAttrs: Record<string, string>;
} {
  const cleaned = cleanSvg(svgContent);

  const svgMatch = cleaned.match(/<svg([^>]*)>/i);
  const svgAttrs = parseAttributes(svgMatch?.[1] ?? '');
  delete svgAttrs.xmlns;
  delete svgAttrs.xmlnsXlink;
  // Keep viewBox, remove the rest of the clutter
  const { viewBox } = svgAttrs;
  const cleanSvgAttrs: Record<string, string> = viewBox ? { viewBox } : {};

  const innerMatch = cleaned.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const innerXml = innerMatch?.[1]?.trim() ?? '';

  return { iconNode: parseXml(innerXml), svgAttrs: cleanSvgAttrs };
}
