import { auditLogsService } from "@/features/audit-logs";
import { AuditLogsContent } from "@/features/audit-logs";

export default async function AuditLogsPage() {
  const data = await auditLogsService.getAuditLogs();
  return <AuditLogsContent initialData={data} />;
}
