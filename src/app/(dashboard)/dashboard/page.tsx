import { auth } from "@/lib/auth";
import { DashboardContent } from "@/features/dashboard";
import { PlatformDashboard } from "@/features/dashboard/components/platform-dashboard";

export default async function DashboardPage() {
    const session = await auth();
    const role = (session?.user as Record<string, unknown> | undefined)?.role;

    if (role === "PLATFORM_OWNER") {
        return <PlatformDashboard />;
    }

    return <DashboardContent />;
}
