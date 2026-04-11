"use client";

import { useEffect, useState } from "react";
import { getCompanyPlan } from "@/server/actions/plan";
import { useSession } from "next-auth/react";
import { AlertTriangle, Crown, X } from "lucide-react";
import Link from "next/link";

export function PlanExpiryBanner() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown> | undefined)?.role as string;
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show for tenant users, not PLATFORM_OWNER
    if (!role || role === "PLATFORM_OWNER") return;

    getCompanyPlan()
      .then((result) => {
        if (!result.expiresAt) return;
        const diff = new Date(result.expiresAt).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days <= 7) setDaysLeft(days);
      })
      .catch(() => {});
  }, [role]);

  if (daysLeft === null || dismissed) return null;

  const isExpired = daysLeft <= 0;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 lg:px-6 py-2 text-sm ${isExpired ? "bg-red-50 border-b border-red-100" : "bg-amber-50 border-b border-amber-100"}`}>
      <div className="flex items-center gap-2 min-w-0">
        {isExpired ? (
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <Crown className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <p className={`text-xs sm:text-sm truncate ${isExpired ? "text-red-700" : "text-amber-700"}`}>
          {isExpired
            ? "Langganan Anda telah berakhir. Fitur PRO tidak dapat diakses."
            : `Langganan Anda akan berakhir dalam ${daysLeft} hari.`}
          {" "}
          <Link href="/plan" className="underline font-semibold hover:no-underline">
            {isExpired ? "Perpanjang sekarang" : "Lihat plan"}
          </Link>
        </p>
      </div>
      <button onClick={() => setDismissed(true)} className={`shrink-0 p-1 rounded-md transition-colors ${isExpired ? "hover:bg-red-100 text-red-400" : "hover:bg-amber-100 text-amber-400"}`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
