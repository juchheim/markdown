import { useStore } from "../store";

export function UpdateToast() {
  const status = useStore((s) => s.updateStatus);
  const dismiss = useStore((s) => s.dismissUpdate);
  const restart = useStore((s) => s.restartToUpdate);

  if (!status) return null;

  if (status.state === "available") {
    return (
      <div className="update-toast" role="status">
        <div className="update-toast-text">
          <strong>Update available</strong>
          <span className="update-toast-sub">
            Version {status.version} is downloading in the background…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="update-toast" role="status">
      <div className="update-toast-text">
        <strong>Update ready · v{status.version}</strong>
        <span className="update-toast-sub">
          Restart Markdown to finish updating. Closing and reopening the app also
          applies it.
        </span>
      </div>
      <div className="update-toast-actions">
        <button type="button" className="button" onClick={restart}>
          Restart now
        </button>
        <button type="button" className="button subtle" onClick={dismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
