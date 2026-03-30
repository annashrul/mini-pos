import { usersService } from "@/features/users";
import { UsersContent } from "@/features/users";

export default async function UsersPage() {
    const [data, roles] = await Promise.all([usersService.getUsers(), usersService.getActiveRoles()]);
    return <UsersContent initialData={data} roles={roles} />;
}
