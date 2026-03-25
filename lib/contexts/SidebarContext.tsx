"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  setCollapsed: (value: boolean) => void;
  sidebarWidth: number; // px
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const sidebarWidth = isCollapsed ? 64 : 256;

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value);
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setCollapsed, sidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function useSidebarOptional() {
  return useContext(SidebarContext);
}
