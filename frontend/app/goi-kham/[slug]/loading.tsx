function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[#e7edf5] ${className}`} />;
}

export default function PackageDetailLoading() {
  return (
    <main className="min-h-screen bg-[#f6f8fb]" aria-busy="true" aria-label="Đang tải thông tin gói khám">
      <header className="border-b border-[#dce3ee] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><Block className="h-5 w-36" /><Block className="h-10 w-28" /></div></header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><article className="border border-[#dce3ee] bg-white p-5 sm:p-6"><div className="flex gap-2"><Block className="h-6 w-24" /><Block className="h-6 w-28" /></div><Block className="mt-5 h-10 w-3/5" /><Block className="mt-4 h-20 w-full" /><div className="mt-6 grid gap-3 sm:grid-cols-3"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div><Block className="mt-8 h-7 w-52" /><div className="mt-4 space-y-3"><Block className="h-20" /><Block className="h-20" /><Block className="h-20" /></div></article><aside className="h-fit border border-[#dce3ee] bg-white p-5"><Block className="h-5 w-24" /><Block className="mt-4 h-10 w-40" /><Block className="mt-5 h-36" /><Block className="mt-5 h-12" /></aside></div></section>
    </main>
  );
}
