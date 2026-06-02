import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useEffect, useMemo, useRef } from "react";
import { findScrollContainer } from "../utils/findScrollContainer";
import { useStore } from "../store";

type Props = {
  /** Full toolbar in preview-only mode; compact chrome in split. */
  showToolbar?: boolean;
  onScrollRoot?: (element: HTMLElement | null) => void;
};

export function Preview({ showToolbar = true, onScrollRoot }: Props) {
  const content = useStore((s) => s.content);
  const setContent = useStore((s) => s.setContent);
  const setPreviewSearchRoot = useStore((s) => s.setPreviewSearchRoot);
  const isDark = useStore((s) => s.effectiveTheme() === "dark");
  const editorRef = useRef<MDXEditorMethods>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const skipExternalSync = useRef(false);
  const themeClass = isDark ? "dark-theme" : "light-theme";

  const plugins = useMemo(() => {
    const base = [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
    ];
    if (showToolbar) {
      base.unshift(
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <BoldItalicUnderlineToggles />
              <ListsToggle />
              <BlockTypeSelect />
            </>
          ),
        }),
      );
    }
    return base;
  }, [showToolbar]);

  useEffect(() => {
    const pane = paneRef.current;
    if (pane) setPreviewSearchRoot(pane);
    return () => setPreviewSearchRoot(null);
  }, [setPreviewSearchRoot]);

  useEffect(() => {
    if (!onScrollRoot) return;

    const pane = paneRef.current;
    if (!pane) return;

    let disposed = false;

    const publishScrollRoot = () => {
      if (disposed) return;
      const root = findScrollContainer(
        pane.querySelector<HTMLElement>(".mdxeditor-root-contenteditable"),
        pane.querySelector<HTMLElement>(".preview-mdx-content"),
        pane.querySelector<HTMLElement>('[contenteditable="true"]'),
        pane,
      );
      if (root) onScrollRoot(root);
    };

    publishScrollRoot();

    const observer = new MutationObserver(() => publishScrollRoot());
    observer.observe(pane, { childList: true, subtree: true });

    let attempts = 0;
    const interval = window.setInterval(() => {
      publishScrollRoot();
      attempts += 1;
      if (attempts >= 30) window.clearInterval(interval);
    }, 100);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(interval);
      onScrollRoot(null);
    };
  }, [onScrollRoot, showToolbar]);

  useEffect(() => {
    if (skipExternalSync.current) {
      skipExternalSync.current = false;
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getMarkdown() !== content) {
      editor.setMarkdown(content);
    }
  }, [content]);

  const handleChange = (markdown: string, initialMarkdownNormalize: boolean) => {
    skipExternalSync.current = true;
    if (initialMarkdownNormalize) {
      if (markdown !== content) setContent(markdown);
      return;
    }
    setContent(markdown);
  };

  return (
    <div
      ref={paneRef}
      className={`preview-pane preview-editor ${themeClass}`}
    >
      <MDXEditor
        ref={editorRef}
        className={`preview-mdx-editor ${themeClass}`}
        contentEditableClassName="preview-mdx-content"
        markdown={content}
        onChange={handleChange}
        plugins={plugins}
        placeholder="Start writing…"
      />
    </div>
  );
}
