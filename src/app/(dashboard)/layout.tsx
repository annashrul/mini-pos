export const dynamic = "force-dynamic";

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

  return <AppLayout>{children}</AppLayout>;
}
