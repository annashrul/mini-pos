"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const isPOS = pathname === "/pos";

  // POS fullscreen: no sidebar, no header, edge-to-edge
  if (isPOS) {
    return (
      <div className="h-screen bg-[#F1F5F9] overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border/60 bg-white flex items-center justify-end px-6 shrink-0 sticky top-0 z-20">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
