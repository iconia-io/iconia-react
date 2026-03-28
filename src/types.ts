export type IconNodeElement = [
  tagName: string,
  attrs: Record<string, string>,
  children?: IconNodeElement[],
];

export type IconNode = IconNodeElement[];
