import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import type { EditorView } from "@codemirror/view";
import { useEffect, useMemo } from "react";
import { findHighlightExtension } from "../codemirror/findHighlight";
import { useStore } from "../store";

type Props = {
  onScrollRoot?: (element: HTMLElement | null) => void;
};

export function Editor({ onScrollRoot }: Props) {
  const content = useStore((s) => s.content);
  const setContent = useStore((s) => s.setContent);
  const setEditorView = useStore((s) => s.setEditorView);
  const isDark = useStore((s) => s.effectiveTheme() === "dark");

  useEffect(() => {
    return () => {
      setEditorView(null);
      onScrollRoot?.(null);
    };
  }, [onScrollRoot, setEditorView]);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      findHighlightExtension,
    ],
    [],
  );

  const handleCreateEditor = (view: EditorView) => {
    setEditorView(view);
    onScrollRoot?.(view.scrollDOM);
  };

  return (
    <div className="editor-pane">
      <CodeMirror
        className="editor-cm"
        value={content}
        onChange={setContent}
        onCreateEditor={handleCreateEditor}
        theme={isDark ? "dark" : "light"}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
        }}
      />
    </div>
  );
}
