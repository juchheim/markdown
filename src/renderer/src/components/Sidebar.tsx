import { FolderOpen, FolderTree } from "lucide-react";
import { useStore } from "../store";
import { FileTree } from "./FileTree";

export function Sidebar() {
  const tree = useStore((s) => s.tree);
  const rootPath = useStore((s) => s.rootPath);
  const openFolder = useStore((s) => s.openFolder);

  const folderName = rootPath ? rootPath.split(/[\\/]/).pop() : null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button
          type="button"
          className="button button-primary sidebar-open-btn"
          onClick={() => void openFolder()}
          title="Open folder (Ctrl+O)"
        >
          <FolderOpen size={15} />
          <span>{rootPath ? "Change Folder" : "Open Folder"}</span>
        </button>
      </div>

      {!rootPath ? (
        <div className="sidebar-empty">
          <FolderTree size={32} strokeWidth={1.25} className="sidebar-empty-icon" />
          <p className="sidebar-empty-title">No project open</p>
          <p className="sidebar-empty-copy">
            Choose a folder to browse and edit markdown files.
          </p>
        </div>
      ) : (
        <>
          <div className="sidebar-project">
            <span className="sidebar-label">Explorer</span>
            <span className="sidebar-folder" title={rootPath}>
              {folderName}
            </span>
          </div>
          <div className="sidebar-tree">
            <FileTree nodes={tree} />
          </div>
        </>
      )}
    </aside>
  );
}
