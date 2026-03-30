import { LoadingTable } from "@/components/common";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="h-7 w-48 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
      </div>
      <LoadingTable rows={8} cols={5} />
    </div>
  );
}
