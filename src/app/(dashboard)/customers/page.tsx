import { customersService } from "@/features/customers";
import { CustomersContent } from "@/features/customers";

export default async function CustomersPage() {
  const data = await customersService.getCustomers();
  return <CustomersContent initialData={data} />;
}
