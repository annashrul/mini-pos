import { Suspense } from "react";
import { AppLayout } from "@/components/layouts";
import { hasMenuAccessByPath, findMenuKeyByPath } from "@/lib/access-control";
import { isPlanMenuAllowed, isPlanActionAllowed } from "@/server/actions/plan-access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlanBlockedOverlay } from "@/components/layouts/plan-blocked-overlay";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "/dashboard";
  const skipCheck = pathname === "/unauthorized" || pathname === "/dashboard" || pathname === "/plan" || pathname.startsWith("/subscription") || pathname === "/tenants" || pathname.startsWith("/platform-") || pathname === "/plan-management";

  let planBlocked = false;

  if (!skipCheck) {
    const allowed = await hasMenuAccessByPath(pathname, "view");
    if (!allowed) {
      redirect(`/unauthorized?page=${encodeURIComponent(pathname)}`);
    }

    const menuKey = await findMenuKeyByPath(pathname);
    if (menuKey) {
      const [menuAllowed, viewAllowed] = await Promise.all([
        isPlanMenuAllowed(menuKey),
        isPlanActionAllowed(menuKey, "view"),
      ]);
      if (!menuAllowed || !viewAllowed) {
        planBlocked = true;
      }
    }
  }

  return (
    <AppLayout>
      {planBlocked ? (
        <PlanBlockedOverlay />
      ) : (
        <Suspense fallback={
          <div className="p-6 space-y-4">
            <div className="h-7 w-48 bg-muted/50 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
            <div className="rounded-2xl bg-white border border-border/40 p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        }>{children}</Suspense>
      )}
    </AppLayout>
  );
}
