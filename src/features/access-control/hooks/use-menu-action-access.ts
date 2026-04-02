"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getSidebarMenuAccess } from "@/features/access-control";
import type { AccessMenu } from "@/types";

type AccessMap = Record<string, boolean>;

const CACHE_KEY = "sidebar-menus";

function buildActionAccess(menus: AccessMenu[], role: string, menuKey: string): AccessMap {
  const menu = menus.find((m) => m.key === menuKey);
  if (!menu) return {};
  const menuAllowed = Boolean(menu.permissions[role]);
  const access: AccessMap = { view: menuAllowed };
  for (const action of menu.actions) {
    access[action.key] = menuAllowed && Boolean(action.permissions[role]);
  }
  return access;
}

export function useMenuActionAccess(menuKey: string) {
  const { data: session } = useSession();
  const role = String(session?.user?.role ?? "");
  const [accessMap, setAccessMap] = useState<AccessMap>({});

  useEffect(() => {
    if (!role) return; // Wait for session to load

    let mounted = true;

    const applyFromPayload = (menus: AccessMenu[], accessRole: string) => {
      if (!mounted) return;
      setAccessMap(buildActionAccess(menus, accessRole, menuKey));
    };

    // Try cache first — if hit, use it and DON'T fetch from server
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { role: string; menus: AccessMenu[] };
        if (parsed.role === role) {
          applyFromPayload(parsed.menus, parsed.role);
          return; // Cache hit — no server call needed
        }
      }
    } catch {}

    // Cache miss or role mismatch — fetch from server once
    const load = async () => {
      const result = await getSidebarMenuAccess();
      if (!mounted) return;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
      applyFromPayload(result.menus as AccessMenu[], result.role);
    };
    void load();

    return () => { mounted = false; };
  }, [menuKey, role]);

  const canAction = useCallback((actionKey: string) => {
    if (!(actionKey in accessMap)) return false;
    return Boolean(accessMap[actionKey]);
  }, [accessMap]);

  const cannotMessage = useMemo(() => (actionLabel: string) => `Anda tidak memiliki izin untuk aksi ${actionLabel}`, []);

  return { canAction, cannotMessage };
}
