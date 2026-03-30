import { NextResponse } from "next/server";
import { userServerService } from "@/server/services/user.service";
import { ok, fail, type ApiResponse } from "@/shared";

export async function GET() {
  try {
    const users = await userServerService.getAll();
    return NextResponse.json<ApiResponse<unknown[]>>(ok(users));
  } catch {
    return NextResponse.json<ApiResponse<null>>(fail("Gagal memuat data user"), { status: 500 });
  }
}
