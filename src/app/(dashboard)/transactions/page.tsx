import { transactionsService } from "@/features/transactions";
import { TransactionsContent } from "@/features/transactions";

export default async function TransactionsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string; dateFrom?: string; dateTo?: string; status?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;

    const data = await transactionsService.getTransactions({
        page,
        ...(params.search ? { search: params.search } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.status ? { status: params.status } : {}),
    });

    return <TransactionsContent data={data} filters={params} />;
}
