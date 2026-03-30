"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>Terjadi kesalahan saat memuat data.</p>
      <Button onClick={reset} variant="outline" className="mt-3">Coba Lagi</Button>
    </div>
  );
}
