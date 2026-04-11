"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getPlanMenuAccessMap, getPlanActionAccessMap, getAllPlanAccessData } from "@/server/actions/plan-access";
import { getCompanyPlan } from "@/server/actions/plan";
import type { PlanKey } from "@/lib/plan-config";
import { useSession } from "next-auth/react";

const PLAN_ORDER: PlanKey[] = ["FREE", "PRO", "ENTERPRISE"];

interface PlanContextValue {
  plan: PlanKey;
  loaded: boolean;
  isPro: boolean;
  canMenu: (menuKey: string) => boolean;
  canAction: (menuKey: string, actionKey: string) => boolean;
  getRequiredPlan: (menuKey: string, actionKey: string) => { label: string; badge: string; tooltip: string };
  /** Returns upgrade message if plan blocks, or null if plan allows */
  getPlanBlockMessage: (menuKey: string, actionKey: string) => string | null;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown> | undefined)?.role as string;
  const [plan, setPlan] = useState<PlanKey>("PRO");
  const [menuAccess, setMenuAccess] = useState<Record<string, boolean>>({});
  const [actionAccess, setActionAccess] = useState<Record<string, boolean>>({});
  const [allMenus, setAllMenus] = useState<Record<string, Record<string, boolean>>>({});
  const [allActions, setAllActions] = useState<Record<string, Record<string, boolean>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!role || role === "PLATFORM_OWNER") {
      setLoaded(true);
      return;
    }

    Promise.all([
      getCompanyPlan(),
      getPlanMenuAccessMap(),
      getPlanActionAccessMap(),
      getAllPlanAccessData(),
    ])
      .then(([planResult, menuMap, actionMap, allData]) => {
        setPlan(planResult.plan as PlanKey);
        setMenuAccess(menuMap);
        setActionAccess(actionMap);
        setAllMenus(allData.menus);
        setAllActions(allData.actions);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [role]);

  const canMenu = useCallback((menuKey: string) => {
    if (!loaded) return true;
    return menuAccess[menuKey] !== false;
  }, [loaded, menuAccess]);

  const canAction = useCallback((menuKey: string, actionKey: string) => {
    if (!loaded) return true;
    if (menuAccess[menuKey] === false) return false;
    const key = `${menuKey}:${actionKey}`;
    if (key in actionAccess) return actionAccess[key] ?? true;
    return true;
  }, [loaded, menuAccess, actionAccess]);

  const getRequiredPlan = useCallback((menuKey: string, actionKey: string) => {
    const key = `${menuKey}:${actionKey}`;
    const planData = allActions[key] || allMenus[menuKey];

    if (!planData) {
      return { label: "Fitur dalam pengembangan", badge: "SOON", tooltip: "Fitur ini sedang dalam pengembangan" };
    }

    for (const p of PLAN_ORDER) {
      if (planData[p] === true) {
        return {
          label: `Upgrade ke ${p}`,
          badge: p,
          tooltip: `Fitur ini tersedia di plan ${p}. Klik untuk melihat plan.`,
        };
      }
    }

    return { label: "Fitur dalam pengembangan", badge: "SOON", tooltip: "Fitur ini sedang dalam pengembangan" };
  }, [allMenus, allActions]);

  const getPlanBlockMessage = useCallback((menuKey: string, actionKey: string): string | null => {
    if (!loaded) return null;
    if (canAction(menuKey, actionKey)) return null;
    const { badge } = getRequiredPlan(menuKey, actionKey);
    if (badge === "SOON") return "Fitur ini sedang dalam pengembangan.";
    return `Upgrade ke plan ${badge} untuk menggunakan fitur ini.`;
  }, [loaded, canAction, getRequiredPlan]);

  const value = useMemo(() => ({
    plan, loaded, isPro: plan === "PRO" || plan === "ENTERPRISE",
    canMenu, canAction, getRequiredPlan, getPlanBlockMessage,
  }), [plan, loaded, canMenu, canAction, getRequiredPlan, getPlanBlockMessage]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlanContext() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlanContext must be used within PlanProvider");
  return ctx;
}
