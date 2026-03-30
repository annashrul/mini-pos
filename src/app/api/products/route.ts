import { NextResponse } from "next/server";
import { productServerService } from "@/server/services/product.service";
import { ok, fail, type ApiResponse } from "@/shared";

export async function GET() {
  try {
    const products = await productServerService.getAll();
    return NextResponse.json<ApiResponse<unknown[]>>(ok(products));
  } catch {
    return NextResponse.json<ApiResponse<null>>(
      fail("Gagal memuat data produk"),
      { status: 500 },
    );
  }
}
