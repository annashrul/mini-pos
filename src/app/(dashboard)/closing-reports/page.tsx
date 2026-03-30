import { getClosingReportList } from "@/server/actions/closing-report";
import { ClosingReportsContent } from "@/features/closing-reports";

export default async function ClosingReportsPage() {
    const data = await getClosingReportList();
    return <ClosingReportsContent initialData={data} />;
}
