import { usersService } from "@/features/users";
import { branchesService } from "@/features/branches";
import { UsersContent } from "@/features/users";

export default async function UsersPage() {
    const [data, roles, branches] = await Promise.all([
        usersService.getUsers(),
        usersService.getActiveRoles(),
        branchesService.getBranches({ perPage: 200 }),
    ]);
    return <UsersContent initialData={data} roles={roles} branches={branches.branches} />;
}
