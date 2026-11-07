function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[#e7edf5] ${className}`} />;
}

export default function DoctorDetailLoading() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172033]" aria-busy="true" aria-label="Đang tải thông tin bác sĩ">
      <header className="border-b border-[#dce3ee] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Block className="h-5 w-36" />
          <Block className="h-10 w-24" />
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="border border-[#dce3ee] bg-white p-5 sm:p-6">
            <div className="flex gap-4">
              <Block className="h-24 w-24 shrink-0" />
              <div className="flex-1 space-y-3"><Block className="h-8 w-3/5" /><Block className="h-5 w-2/5" /><Block className="h-4 w-full" /></div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div>
            <Block className="mt-8 h-7 w-48" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Block className="h-16" /><Block className="h-16" /><Block className="h-16" /><Block className="h-16" /></div>
          </article>
          <aside className="border border-[#dce3ee] bg-white p-5"><Block className="h-6 w-40" /><Block className="mt-5 h-11 w-full" /><div className="mt-4 space-y-3"><Block className="h-12" /><Block className="h-12" /><Block className="h-12" /></div></aside>
        </div>
      </section>
    </main>
  );
}
