/** Prefer an element that is actually scrollable; otherwise return the first candidate. */
export function findScrollContainer(
  ...candidates: (HTMLElement | null | undefined)[]
): HTMLElement | null {
  const elements = candidates.filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  if (elements.length === 0) return null;

  for (const el of elements) {
    const { overflowY } = getComputedStyle(el);
    const canScroll =
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay";
    if (canScroll && el.scrollHeight > el.clientHeight + 1) return el;
  }

  return elements[0];
}

/** Scroll within a container only — never call scrollIntoView on the document. */
export function scrollRangeIntoContainer(
  scrollContainer: HTMLElement,
  range: Range,
  alignment: "center" | "nearest" = "nearest",
): void {
  const rect = range.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const offsetTop = rect.top - containerRect.top + scrollContainer.scrollTop;
  const offsetBottom = offsetTop + rect.height;

  const viewTop = scrollContainer.scrollTop;
  const viewBottom = viewTop + scrollContainer.clientHeight;

  let next = scrollContainer.scrollTop;

  if (alignment === "center") {
    next = offsetTop - scrollContainer.clientHeight / 2 + rect.height / 2;
  } else if (offsetTop < viewTop) {
    next = offsetTop;
  } else if (offsetBottom > viewBottom) {
    next = offsetBottom - scrollContainer.clientHeight;
  } else {
    return;
  }

  scrollContainer.scrollTop = Math.max(
    0,
    Math.min(
      next,
      scrollContainer.scrollHeight - scrollContainer.clientHeight,
    ),
  );
}
