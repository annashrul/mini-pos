export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AppLayout } from "@/components/layouts";
import { hasMenuAccessByPath } from "@/lib/access-control";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") || "/dashboard";
  const allowed = await hasMenuAccessByPath(pathname, "view");
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <AppLayout>
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
    </AppLayout>
  );
}
