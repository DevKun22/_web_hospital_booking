function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[#e7edf5] ${className}`} />;
}

export default function DepartmentDetailLoading() {
  return (
    <main className="min-h-screen bg-[#f6f8fb]" aria-busy="true" aria-label="Đang tải thông tin chuyên khoa">
      <header className="border-b border-[#dce3ee] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><Block className="h-5 w-40" /><Block className="h-10 w-24" /></div></header>
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <article className="grid overflow-hidden border border-[#dce3ee] bg-white lg:grid-cols-2"><div className="space-y-4 p-6"><Block className="h-4 w-24" /><Block className="h-10 w-3/5" /><Block className="h-20 w-full" /><div className="grid gap-3 sm:grid-cols-3"><Block className="h-20" /><Block className="h-20" /><Block className="h-20" /></div></div><Block className="min-h-80 rounded-none" /></article>
        <div><Block className="h-8 w-64" /><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Block className="h-52" /><Block className="h-52" /><Block className="h-52" /><Block className="h-52" /></div></div>
        <div><Block className="h-8 w-56" /><div className="mt-5 grid gap-4 lg:grid-cols-3"><Block className="h-56" /><Block className="h-56" /><Block className="h-56" /></div></div>
      </section>
    </main>
  );
}
