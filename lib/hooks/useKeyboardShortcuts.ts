/**
 * Keyboard Shortcuts Hook
 * Provides keyboard shortcut handling for power users
 */

import { useEffect } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          e.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Common keyboard shortcuts for the estimating grid
 */
export const ESTIMATING_SHORTCUTS = {
  ADD_LINE: { key: "n", ctrl: true, description: "Add new line" },
  SAVE: { key: "s", ctrl: true, description: "Save changes" },
  DELETE: { key: "Delete", description: "Delete selected line" },
  DUPLICATE: { key: "d", ctrl: true, description: "Duplicate line" },
  SEARCH: { key: "f", ctrl: true, description: "Search" },
  EXPAND_ALL: { key: "e", ctrl: true, shift: true, description: "Expand all rows" },
  COLLAPSE_ALL: { key: "e", ctrl: true, description: "Collapse all rows" },
} as const;

