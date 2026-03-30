export * from "@/server/actions/access-control";
import * as featureActions from "@/server/actions/access-control";
import { createRole, deleteRole, getRoles, updateRole } from "@/server/actions/roles";

export const accessControlService = {
  ...featureActions,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
};
