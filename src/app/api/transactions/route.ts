import { NextResponse } from "next/server";
import { transactionServerService } from "@/server/services/transaction.service";
import { ok, fail, type ApiResponse } from "@/shared";

export async function GET() {
  try {
    const transactions = await transactionServerService.getAll();
    return NextResponse.json<ApiResponse<unknown[]>>(ok(transactions));
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      fail("Gagal memuat data transaksi"),
      { status: 500 },
    );
  }
}
