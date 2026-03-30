"use client";

import { ErrorMessage } from "@/components/common";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <ErrorMessage
        title="Terjadi Kesalahan"
        message="Aplikasi mengalami error. Silakan coba lagi."
        onRetry={reset}
      />
    </div>
  );
}
