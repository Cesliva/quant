"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface Shortcut {
  keys: string;
  description: string;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: Shortcut[];
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl+Z", description: "Undo last change" },
  { keys: "Ctrl+Y or Ctrl+Shift+Z", description: "Redo" },
  { keys: "Ctrl+Alt+1–50", description: "Jump to field by number (e.g. 10=Shape, 11=Size)" },
  { keys: "?", description: "Show keyboard shortcuts" },
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts = DEFAULT_SHORTCUTS,
}: KeyboardShortcutsModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
        role="dialog"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold text-slate-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          <ul className="space-y-3">
            {shortcuts.map((s, i) => (
              <li key={i} className="flex items-start gap-4">
                <kbd className="shrink-0 px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                  {s.keys}
                </kbd>
                <span className="text-sm text-slate-600">{s.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-mono">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
