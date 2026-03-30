import { accessControlService } from "@/features/access-control";
import { AccessControlContent } from "@/features/access-control";

export default async function AccessControlPage() {
  const [result, appRoles] = await Promise.all([
    accessControlService.getAccessControlMatrix(),
    accessControlService.getRoles(),
  ]);
  return <AccessControlContent initialData={result} appRoles={appRoles} />;
}
