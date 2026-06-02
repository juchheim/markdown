export type TextRange = { from: number; to: number };

export function findMatches(
  content: string,
  query: string,
  caseSensitive: boolean,
): TextRange[] {
  if (!query) return [];

  const matches: TextRange[] = [];
  const hay = caseSensitive ? content : content.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  let pos = 0;

  while (pos <= hay.length) {
    const idx = hay.indexOf(needle, pos);
    if (idx === -1) break;
    matches.push({ from: idx, to: idx + query.length });
    pos = idx + (needle.length || 1);
  }

  return matches;
}
