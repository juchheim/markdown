import { FileText } from "lucide-react";
import { useRef, useState } from "react";
import { usePairScrollSync } from "../hooks/usePairScrollSync";
import { Editor } from "./Editor";
import { FileChangeBanner } from "./FileChangeBanner";
import { FindBar } from "./FindBar";
import { Preview } from "./Preview";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store";

export function MainView() {
  const activePath = useStore((s) => s.activePath);
  const viewMode = useStore((s) => s.viewMode);
  const splitRef = useRef<HTMLDivElement>(null);
  const splitRatio = useStore((s) => s.splitRatio);
  const setSplitRatio = useStore((s) => s.setSplitRatio);
  const [editorScrollRoot, setEditorScrollRoot] = useState<HTMLElement | null>(
    null,
  );
  const [previewScrollRoot, setPreviewScrollRoot] = useState<HTMLElement | null>(
    null,
  );

  usePairScrollSync(
    viewMode === "split" ? editorScrollRoot : null,
    viewMode === "split" ? previewScrollRoot : null,
  );

  if (!activePath) {
    return (
      <section className="main main-empty">
        <FileText size={40} strokeWidth={1.25} className="main-empty-icon" />
        <p className="main-empty-title">Select a markdown file</p>
        <p className="main-empty-copy">
          Open a folder in the sidebar, then choose a <code>.md</code> file to
          start editing.
        </p>
      </section>
    );
  }

  const handleSplitResize = (delta: number) => {
    const el = splitRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    if (width <= 0) return;
    setSplitRatio(useStore.getState().splitRatio + delta / width);
  };

  return (
    <section className="main main-editor">
      <FileChangeBanner />
      <FindBar />
      <div className="main-content-area">
        {viewMode === "markdown" && <Editor />}
        {viewMode === "preview" && <Preview showToolbar />}
        {viewMode === "split" && (
          <div className="split" ref={splitRef}>
            <div className="split-pane" style={{ flex: splitRatio }}>
              <Editor onScrollRoot={setEditorScrollRoot} />
            </div>
            <ResizeHandle
              orientation="vertical"
              title="Drag to resize markdown and preview panes"
              onResize={handleSplitResize}
            />
            <div className="split-pane" style={{ flex: 1 - splitRatio }}>
              <Preview showToolbar={false} onScrollRoot={setPreviewScrollRoot} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
