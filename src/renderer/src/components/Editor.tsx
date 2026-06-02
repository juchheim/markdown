import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import type { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import { useStore } from "../store";

type Props = {
  onScrollRoot?: (element: HTMLElement | null) => void;
};

export function Editor({ onScrollRoot }: Props) {
  const content = useStore((s) => s.content);
  const setContent = useStore((s) => s.setContent);
  const isDark = useStore((s) => s.effectiveTheme() === "dark");
  useEffect(() => {
    return () => onScrollRoot?.(null);
  }, [onScrollRoot]);

  const handleCreateEditor = (view: EditorView) => {
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
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
        ]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
        }}
      />
    </div>
  );
}
