import { useStore } from "../store";

export function FileChangeBanner() {
  const externalChangePath = useStore((s) => s.externalChangePath);
  const dismiss = useStore((s) => s.dismissExternalChange);
  const reload = useStore((s) => s.applyExternalReload);

  if (!externalChangePath) return null;

  const fileName =
    externalChangePath.split(/[\\/]/).pop() ?? externalChangePath;

  return (
    <div className="file-change-banner" role="status">
      <span>
        <strong>{fileName}</strong> changed on disk.
      </span>
      <div className="file-change-actions">
        <button type="button" className="button" onClick={() => void reload()}>
          Reload
        </button>
        <button type="button" className="button subtle" onClick={dismiss}>
          Keep my changes
        </button>
      </div>
    </div>
  );
}
