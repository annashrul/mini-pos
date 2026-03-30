import { expensesService } from "@/features/expenses";
import { ExpensesContent } from "@/features/expenses";

export default async function ExpensesPage() {
  const data = await expensesService.getExpenses();
  return <ExpensesContent initialData={data} />;
}
