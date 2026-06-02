import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useRef, useState } from "react";
import type { FileNode } from "../types";
import { useStore } from "../store";

type Props = {
  nodes: FileNode[];
  level?: number;
};

export function FileTree({ nodes, level = 0 }: Props) {
  const activePath = useStore((s) => s.activePath);
  const renamingPath = useStore((s) => s.renamingPath);
  const openFile = useStore((s) => s.openFile);
  const showFileContextMenu = useStore((s) => s.showFileContextMenu);

  return (
    <div>
      {nodes.map((node) => {
        if (node.type === "directory") {
          return <DirectoryNode key={node.path} node={node} level={level} />;
        }

        const isMarkdown = node.name.toLowerCase().endsWith(".md");
        const isActive = node.path === activePath;

        if (isMarkdown && renamingPath === node.path) {
          return (
            <RenameFileInput
              key={node.path}
              filePath={node.path}
              initialName={node.name}
              level={level}
            />
          );
        }

        return (
          <button
            key={node.path}
            className={`tree-row ${isActive ? "active" : ""}`}
            style={{ paddingLeft: `${8 + level * 14}px` }}
            onClick={() => void openFile(node.path)}
            onContextMenu={(event) => {
              if (!isMarkdown) return;
              event.preventDefault();
              void showFileContextMenu(node.path);
            }}
            disabled={!isMarkdown}
            title={node.path}
          >
            <FileText size={12} />
            <span className={!isMarkdown ? "muted" : ""}>{node.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function RenameFileInput({
  filePath,
  initialName,
  level,
}: {
  filePath: string;
  initialName: string;
  level: number;
}) {
  const renameFile = useStore((s) => s.renameFile);
  const cancelRename = useStore((s) => s.cancelRename);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const res = await renameFile(filePath, name);
    busyRef.current = false;
    if (!res.ok && res.error) {
      setError(res.error);
    } else if (!res.ok) {
      cancelRename();
    }
  };

  return (
    <div
      className="tree-rename"
      style={{ paddingLeft: `${8 + level * 14}px` }}
    >
      <input
        autoFocus
        className="tree-rename-input"
        value={name}
        spellCheck={false}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelRename();
          }
        }}
        onBlur={() => {
          if (!busyRef.current) cancelRename();
        }}
      />
      {error && <span className="tree-rename-error">{error}</span>}
    </div>
  );
}

function DirectoryNode({ node, level }: { node: FileNode; level: number }) {
  const [open, setOpen] = useState(true);
  const children = node.children ?? [];
  return (
    <div>
      <button
        className="tree-row directory"
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => setOpen((v) => !v)}
        title={node.path}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Folder size={12} />
        <span>{node.name}</span>
      </button>
      {open && children.length > 0 ? <FileTree nodes={children} level={level + 1} /> : null}
    </div>
  );
}
