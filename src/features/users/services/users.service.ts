export * from "@/server/actions/users";
import * as userActions from "@/server/actions/users";
export { getActiveRoles } from "@/server/actions/roles";
import { getActiveRoles } from "@/server/actions/roles";

export const usersService = {
  ...userActions,
  getActiveRoles,
};
