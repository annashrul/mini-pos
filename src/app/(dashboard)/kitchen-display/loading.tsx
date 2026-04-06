function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-800 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Bar Skeleton */}
      <header className="px-4 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Bone className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Bone className="h-7 w-48" />
              <Bone className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-11 w-11 rounded-xl" />
            <Bone className="h-11 w-11 rounded-xl" />
            <Bone className="h-11 w-11 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bone key={i} className="h-10 w-28 rounded-xl shrink-0" />
          ))}
        </div>
      </header>

      {/* Kanban Skeleton */}
      <main className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full">
          {Array.from({ length: 4 }).map((_, colIdx) => (
            <div key={colIdx} className="flex flex-col rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
              <Bone className="h-12 w-full rounded-none" />
              <div className="p-3 space-y-3">
                {Array.from({ length: colIdx === 3 ? 1 : 3 }).map((_, cardIdx) => (
                  <div key={cardIdx} className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
                    <Bone className="h-14 w-full rounded-none" />
                    <div className="p-4 space-y-3">
                      <Bone className="h-4 w-full" />
                      <Bone className="h-4 w-3/4" />
                      <Bone className="h-4 w-1/2" />
                    </div>
                    <div className="px-4 pb-4">
                      <Bone className="h-12 w-full rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
