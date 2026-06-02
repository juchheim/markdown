import { useEffect } from "react";
import { MainView } from "./components/MainView";
import { ResizeHandle } from "./components/ResizeHandle";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { useStore } from "./store";

function App() {
  const save = useStore((s) => s.save);
  const openFolder = useStore((s) => s.openFolder);
  const togglePreview = useStore((s) => s.togglePreview);
  const toggleSplit = useStore((s) => s.toggleSplit);
  const themePreference = useStore((s) => s.themePreference);
  const systemDark = useStore((s) => s.systemDark);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const setSidebarWidth = useStore((s) => s.setSidebarWidth);

  const onSidebarResize = (delta: number) => {
    setSidebarWidth(useStore.getState().sidebarWidth + delta);
  };

  useAppLifecycle();

  useEffect(() => {
    document.documentElement.dataset.theme = useStore.getState().effectiveTheme();
  }, [themePreference, systemDark]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        void save();
        return;
      }

      if (key === "o") {
        event.preventDefault();
        void openFolder();
        return;
      }

      if (key === "v" && event.shiftKey) {
        event.preventDefault();
        togglePreview();
        return;
      }

      if (key === "\\") {
        event.preventDefault();
        toggleSplit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save, openFolder, togglePreview, toggleSplit]);

  return (
    <div className="app">
      <Toolbar />
      <main className="body">
        <div className="sidebar-shell" style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>
        <ResizeHandle
          orientation="vertical"
          title="Drag to resize sidebar"
          onResize={onSidebarResize}
        />
        <MainView />
      </main>
    </div>
  );
}

export default App;
