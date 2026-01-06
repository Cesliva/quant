/**
 * Simple Toast Notification Utility
 * Creates temporary toast messages for user feedback
 */

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  duration?: number; // milliseconds, default 3000
  type?: ToastType; // default "info"
}

let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("getToastContainer called in non-browser environment");
  }

  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none";
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message: string, options: ToastOptions = {}) {
  // Only work in browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    console.warn("showToast called in non-browser environment:", message);
    return;
  }

  const { duration = 3000, type = "info" } = options;
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `px-4 py-3 rounded-lg shadow-lg pointer-events-auto animate-in slide-in-from-right-4 fade-in ${
    type === "success"
      ? "bg-green-600 text-white"
      : type === "error"
      ? "bg-red-600 text-white"
      : type === "warning"
      ? "bg-amber-600 text-white"
      : "bg-blue-600 text-white"
  }`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add("animate-out", "fade-out", "slide-out-to-right-4");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);

  return toast;
}

