import { useEffect } from "react";

function scrollRatio(element: HTMLElement): number {
  const max = element.scrollHeight - element.clientHeight;
  if (max <= 0) return 0;
  return element.scrollTop / max;
}

function applyScrollRatio(element: HTMLElement, ratio: number): void {
  const max = element.scrollHeight - element.clientHeight;
  element.scrollTop = max <= 0 ? 0 : ratio * max;
}

/**
 * Bidirectional scroll-ratio sync between two scroll containers.
 */
export function usePairScrollSync(
  sourceA: HTMLElement | null,
  sourceB: HTMLElement | null,
): void {
  useEffect(() => {
    if (!sourceA || !sourceB) return;

    let syncing = false;
    let unlockRaf = 0;

    const releaseSync = () => {
      cancelAnimationFrame(unlockRaf);
      unlockRaf = requestAnimationFrame(() => {
        unlockRaf = requestAnimationFrame(() => {
          syncing = false;
        });
      });
    };

    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (syncing) return;

      const ratio = scrollRatio(source);
      if (Math.abs(scrollRatio(target) - ratio) < 0.002) return;

      syncing = true;
      applyScrollRatio(target, ratio);
      releaseSync();
    };

    const onAScroll = () => sync(sourceA, sourceB);
    const onBScroll = () => sync(sourceB, sourceA);

    const opts: AddEventListenerOptions = { passive: true };
    sourceA.addEventListener("scroll", onAScroll, opts);
    sourceB.addEventListener("scroll", onBScroll, opts);

    return () => {
      cancelAnimationFrame(unlockRaf);
      sourceA.removeEventListener("scroll", onAScroll);
      sourceB.removeEventListener("scroll", onBScroll);
    };
  }, [sourceA, sourceB]);
}
