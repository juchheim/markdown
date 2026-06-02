import { Moon, Save, Sun, SunMoon } from "lucide-react";
import { useStore, type ViewMode } from "../store";
import type { ThemePreference } from "../types";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "markdown", label: "Markdown" },
  { id: "split", label: "Split" },
  { id: "preview", label: "Preview" },
];

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "dark") return <Moon size={16} />;
  if (preference === "light") return <Sun size={16} />;
  return <SunMoon size={16} />;
}

export function Toolbar() {
  const save = useStore((s) => s.save);
  const setViewMode = useStore((s) => s.setViewMode);
  const cycleTheme = useStore((s) => s.cycleTheme);
  const viewMode = useStore((s) => s.viewMode);
  const themePreference = useStore((s) => s.themePreference);
  const activePath = useStore((s) => s.activePath);
  const dirty = useStore((s) => s.content !== s.savedContent);

  const fileName = activePath
    ? (activePath.split(/[\\/]/).pop() ?? activePath)
    : "No file selected";
  const canSave = Boolean(activePath) && dirty;

  return (
    <header className="toolbar">
      <div className="toolbar-doc">
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
        <span className="toolbar-filename">{fileName}</span>
      </div>
      <div className="toolbar-actions">
        <div className="segmented" role="group" aria-label="View mode">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`segmented-item ${viewMode === mode.id ? "active" : ""}`}
              onClick={() => setViewMode(mode.id)}
              disabled={!activePath}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={cycleTheme}
          title={`Theme: ${themePreference} (click to cycle)`}
          aria-label="Cycle theme"
        >
          <ThemeIcon preference={themePreference} />
        </button>
        <button
          type="button"
          className={`icon-button ${dirty ? "icon-button-dirty" : ""}`}
          onClick={() => void save()}
          disabled={!canSave}
          title="Save (Ctrl+S)"
          aria-label="Save file"
        >
          <Save size={16} />
        </button>
      </div>
    </header>
  );
}
