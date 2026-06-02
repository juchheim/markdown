import { useEffect } from "react";
import { useStore } from "../store";

export function useAppLifecycle(): void {
  const handleFileChanged = useStore((s) => s.handleFileChanged);
  const setSystemDark = useStore((s) => s.setSystemDark);
  const requestAppClose = useStore((s) => s.requestAppClose);
  const setUpdateStatus = useStore((s) => s.setUpdateStatus);

  useEffect(() => {
    if (!window.api?.getSystemDark) return;

    void window.api.getSystemDark().then(setSystemDark);

    const unsubTheme = window.api.onThemeChanged?.(setSystemDark);
    const unsubFiles = window.api.onFileChanged?.(handleFileChanged);
    const unsubClose = window.api.onRequestClose?.(() => {
      void requestAppClose();
    });
    const unsubUpdate = window.api.onUpdateStatus?.(setUpdateStatus);

    return () => {
      unsubTheme?.();
      unsubFiles?.();
      unsubClose?.();
      unsubUpdate?.();
    };
  }, [handleFileChanged, setSystemDark, requestAppClose, setUpdateStatus]);
}

export function useThemeEffect(): void {
  const effectiveTheme = useStore((s) => s.effectiveTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme();
  });
}
