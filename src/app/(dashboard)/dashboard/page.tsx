import { dashboardService } from "@/features/dashboard";
import { DashboardContent } from "@/features/dashboard";

export default async function DashboardPage() {
    const stats = await dashboardService.getStats();
    return <DashboardContent stats={stats} />;
}
