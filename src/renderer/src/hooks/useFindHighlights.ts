import { useEffect } from "react";
import {
  clearFindHighlight,
  updateFindHighlight,
} from "../codemirror/findHighlight";
import { useStore } from "../store";
import {
  applyPreviewFindHighlights,
  clearPreviewFindHighlights,
} from "../utils/previewFindHighlight";

export function useFindHighlights(): void {
  const findOpen = useStore((s) => s.findOpen);
  const findQuery = useStore((s) => s.findQuery);
  const findCaseSensitive = useStore((s) => s.findCaseSensitive);
  const findMatchIndex = useStore((s) => s.findMatchIndex);
  const findNavigated = useStore((s) => s.findNavigated);
  const content = useStore((s) => s.content);
  const editorView = useStore((s) => s.editorView);
  const previewSearchRoot = useStore((s) => s.previewSearchRoot);
  const viewMode = useStore((s) => s.viewMode);

  useEffect(() => {
    const spec = {
      query: findQuery,
      caseSensitive: findCaseSensitive,
      activeIndex: findMatchIndex,
      navigated: findNavigated,
      enabled: findOpen,
    };

    if (editorView) {
      if (findOpen && findQuery) {
        updateFindHighlight(editorView, spec);
      } else {
        clearFindHighlight(editorView);
      }
    }

    const highlightPreview =
      findOpen && findQuery && (viewMode === "preview" || viewMode === "split");

    if (highlightPreview && previewSearchRoot) {
      applyPreviewFindHighlights(
        previewSearchRoot,
        findQuery,
        findCaseSensitive,
        findMatchIndex,
        findNavigated,
        true,
      );
    } else {
      clearPreviewFindHighlights();
    }

    return () => {
      clearPreviewFindHighlights();
    };
  }, [
    findOpen,
    findQuery,
    findCaseSensitive,
    findMatchIndex,
    findNavigated,
    content,
    editorView,
    previewSearchRoot,
    viewMode,
  ]);
}
