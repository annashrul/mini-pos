import { Crown } from "lucide-react";
import Link from "next/link";

export function PlanBlockedOverlay() {
  return (
    <div className="relative min-h-[60vh]">
      {/* Fake blurred content */}
      <div className="p-6 space-y-4 blur-[6px] opacity-30 pointer-events-none select-none" aria-hidden>
        <div className="h-8 w-56 bg-muted rounded-lg" />
        <div className="h-4 w-36 bg-muted/60 rounded" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl" />
          ))}
        </div>
        <div className="rounded-2xl bg-white border border-border/40 p-6">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200/50">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Fitur Premium</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Halaman ini memerlukan upgrade plan untuk diakses. Upgrade sekarang untuk membuka semua fitur dan meningkatkan produktivitas bisnis Anda.
          </p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-200/50 hover:shadow-xl hover:scale-105 transition-all"
          >
            <Crown className="w-4 h-4" />
            Lihat Plan & Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
