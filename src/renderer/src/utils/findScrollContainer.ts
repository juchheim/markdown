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
