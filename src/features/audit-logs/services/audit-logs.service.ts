export * from "@/server/actions/audit-logs";
import * as featureActions from "@/server/actions/audit-logs";

export const auditLogsService = {
  ...featureActions,
};
