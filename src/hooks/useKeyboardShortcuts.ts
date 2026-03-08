import { useEffect } from "react";

interface ShortcutHandlers {
  onExport?: () => void;
  onTemplates?: () => void;
  onTogglePanel?: () => void;
  onToggleHistory?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Escape — close panels/dropdowns
      if (e.key === "Escape") {
        e.preventDefault();
        handlers.onEscape?.();
        return;
      }

      // Ctrl+E — export
      if (isCtrl && e.key === "e") {
        e.preventDefault();
        handlers.onExport?.();
        return;
      }

      // Ctrl+/ — templates
      if (isCtrl && e.key === "/") {
        e.preventDefault();
        handlers.onTemplates?.();
        return;
      }

      // Ctrl+B — toggle panel
      if (isCtrl && e.key === "b") {
        e.preventDefault();
        handlers.onTogglePanel?.();
        return;
      }

      // Ctrl+H — toggle history
      if (isCtrl && e.key === "h") {
        e.preventDefault();
        handlers.onToggleHistory?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
};
