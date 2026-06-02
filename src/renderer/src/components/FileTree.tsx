import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useState } from "react";
import type { FileNode } from "../types";
import { useStore } from "../store";

type Props = {
  nodes: FileNode[];
  level?: number;
};

export function FileTree({ nodes, level = 0 }: Props) {
  const activePath = useStore((s) => s.activePath);
  const openFile = useStore((s) => s.openFile);

  return (
    <div>
      {nodes.map((node) => {
        if (node.type === "directory") {
          return <DirectoryNode key={node.path} node={node} level={level} />;
        }

        const isMarkdown = node.name.toLowerCase().endsWith(".md");
        const isActive = node.path === activePath;
        return (
          <button
            key={node.path}
            className={`tree-row ${isActive ? "active" : ""}`}
            style={{ paddingLeft: `${8 + level * 14}px` }}
            onClick={() => void openFile(node.path)}
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
