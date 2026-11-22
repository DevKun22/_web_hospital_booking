// Khung chờ khi mở bài viết: hiện ngay lúc bấm (không đợi máy chủ lấy bài), cùng bố cục với trang thật nên không nhảy chỗ khi nội dung đến.
export default function KnowledgeArticleLoading() {
  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]" aria-busy="true" aria-label="Đang tải bài viết">
      <div className="bg-[linear-gradient(120deg,var(--hero-from)_0%,var(--hero-via)_58%,var(--hero-to)_100%)] text-white">
        <div className="ui-container pb-9 pt-5 sm:pb-11 sm:pt-7">
          <div className="mb-3 h-4 w-48 animate-pulse rounded bg-white/25 motion-reduce:animate-none" />
          <div className="h-8 w-full max-w-xl animate-pulse rounded bg-white/25 motion-reduce:animate-none sm:h-9" />
          <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded bg-white/20 motion-reduce:animate-none" />
          <div className="mt-5 h-5 w-72 max-w-full animate-pulse rounded bg-white/20 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="ui-container py-5 sm:py-8">
        <div className="max-w-3xl space-y-3">
          <div className="aspect-[16/9] w-full animate-pulse rounded-xl bg-[var(--public-surface-muted)] motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded bg-[var(--public-surface-muted)] motion-reduce:animate-none" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-[var(--public-surface-muted)] motion-reduce:animate-none" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--public-surface-muted)] motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
