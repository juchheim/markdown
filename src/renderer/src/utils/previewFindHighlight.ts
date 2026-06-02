import {
  findScrollContainer,
  scrollRangeIntoContainer,
} from "./findScrollContainer";

function collectPreviewMatchRanges(
  root: HTMLElement,
  query: string,
  caseSensitive: boolean,
): Range[] {
  if (!query) return [];

  const ranges: Range[] = [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const text = node.textContent ?? "";
    const hay = caseSensitive ? text : text.toLowerCase();
    let pos = 0;

    while (pos <= hay.length) {
      const idx = hay.indexOf(needle, pos);
      if (idx === -1) break;

      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + query.length);
      ranges.push(range);

      pos = idx + (needle.length || 1);
    }

    node = walker.nextNode();
  }

  return ranges;
}

function getPreviewScrollContainer(root: HTMLElement): HTMLElement | null {
  return findScrollContainer(
    root.querySelector<HTMLElement>(".mdxeditor-root-contenteditable"),
    root.querySelector<HTMLElement>(".preview-mdx-content"),
    root.querySelector<HTMLElement>('[contenteditable="true"]'),
    root,
  );
}

export function applyPreviewFindHighlights(
  root: HTMLElement | null,
  query: string,
  caseSensitive: boolean,
  activeIndex: number,
  navigated: boolean,
  enabled: boolean,
): void {
  if (!("highlights" in CSS)) return;

  CSS.highlights.delete("find-match");
  CSS.highlights.delete("find-match-active");

  if (!enabled || !query || !root) return;

  const ranges = collectPreviewMatchRanges(root, query, caseSensitive);
  if (ranges.length === 0) return;

  CSS.highlights.set("find-match", new Highlight(...ranges));

  if (navigated && activeIndex >= 0 && activeIndex < ranges.length) {
    CSS.highlights.set(
      "find-match-active",
      new Highlight(ranges[activeIndex]),
    );
  }
}

export function clearPreviewFindHighlights(): void {
  if (!("highlights" in CSS)) return;
  CSS.highlights.delete("find-match");
  CSS.highlights.delete("find-match-active");
}

export function scrollPreviewToMatch(
  root: HTMLElement,
  query: string,
  matchIndex: number,
  caseSensitive: boolean,
): boolean {
  if (!query) return false;

  const ranges = collectPreviewMatchRanges(root, query, caseSensitive);
  const range = ranges[matchIndex];
  if (!range) return false;

  const scrollContainer = getPreviewScrollContainer(root);
  if (!scrollContainer) return false;

  scrollRangeIntoContainer(scrollContainer, range, "nearest");
  return true;
}
