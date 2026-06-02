import { FilePlus, FolderOpen, FolderTree } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "../store";
import { FileTree } from "./FileTree";

export function Sidebar() {
  const tree = useStore((s) => s.tree);
  const rootPath = useStore((s) => s.rootPath);
  const openFolder = useStore((s) => s.openFolder);
  const creatingFile = useStore((s) => s.creatingFile);
  const beginCreateFile = useStore((s) => s.beginCreateFile);

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
            <div className="sidebar-project-info">
              <span className="sidebar-label">Explorer</span>
              <span className="sidebar-folder" title={rootPath}>
                {folderName}
              </span>
            </div>
            <button
              type="button"
              className="icon-button sidebar-new-file"
              onClick={() => beginCreateFile()}
              title="New markdown file (Ctrl+N)"
              aria-label="New markdown file"
            >
              <FilePlus size={15} />
            </button>
          </div>
          <div className="sidebar-tree">
            {creatingFile && <NewFileInput />}
            <FileTree nodes={tree} />
          </div>
        </>
      )}
    </aside>
  );
}

function NewFileInput() {
  const createFile = useStore((s) => s.createFile);
  const cancelCreateFile = useStore((s) => s.cancelCreateFile);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const res = await createFile(name);
    busyRef.current = false;
    if (!res.ok && res.error) {
      setError(res.error);
    } else if (!res.ok) {
      cancelCreateFile();
    }
  };

  return (
    <div className="new-file">
      <input
        autoFocus
        className="new-file-input"
        placeholder="filename.md"
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
            cancelCreateFile();
          }
        }}
        onBlur={() => {
          if (!busyRef.current) cancelCreateFile();
        }}
      />
      {error && <span className="new-file-error">{error}</span>}
    </div>
  );
}
