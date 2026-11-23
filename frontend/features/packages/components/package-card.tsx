/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { EntityMark } from "@/components/public/entity-mark";
import { formatCurrency } from "@/lib/format";
import type { MedicalPackage } from "@/lib/types";

const PACKAGE_ITEMS_FEATURED = 4;
const PACKAGE_ITEMS_STANDARD = 2;

export function PackageCard({ item, featured }: { item: MedicalPackage; featured?: boolean }) {
  const included = (item.items || []).filter((entry) => entry.included);
  const shown = included.slice(0, featured ? PACKAGE_ITEMS_FEATURED : PACKAGE_ITEMS_STANDARD);
  const more = included.length - shown.length;
  const detailHref = `/goi-kham/${item.slug || item.id}`;
  const body = (
    <>
      <div className={`relative overflow-hidden bg-[var(--public-primary-soft)] ${featured ? "aspect-[16/9] md:aspect-auto md:min-h-[13rem]" : "aspect-[5/2]"}`}>
        {item.image ? (
          <img src={item.image} alt="" width={800} height={450} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover/pack:scale-105 motion-reduce:transition-none motion-reduce:group-hover/pack:scale-100" />
        ) : (
          <EntityMark name={item.name} className={featured ? "text-5xl" : "text-4xl"} />
        )}
        {item.isPopular || item.isBHYTSupport ? (
          <p className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {item.isPopular ? <span className="rounded-full bg-[var(--public-solid)] px-3 py-1 text-sm font-medium text-white shadow">Nổi bật</span> : null}
            {item.isBHYTSupport ? <span className="rounded-full bg-[var(--public-surface)] px-3 py-1 text-sm font-medium text-[var(--public-success)] shadow">Hỗ trợ BHYT</span> : null}
          </p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.department?.name ? <p className="text-sm text-[var(--public-muted)]">{item.department.name}</p> : null}
        <h3 className={`mt-1 font-semibold text-[var(--public-ink)] ${featured ? "text-xl" : "text-lg"} leading-snug`}>
          <Link href={detailHref} className="hover:text-[var(--public-primary)]">{item.name}</Link>
        </h3>
        {shown.length ? (
          <ul className={`mt-2 gap-x-4 gap-y-1 text-base text-[var(--public-text-soft)] ${featured ? "grid sm:grid-cols-2" : "space-y-1.5"}`}>
            {shown.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--public-success)]" aria-hidden="true" />{entry.name}</li>
            ))}
          </ul>
        ) : item.summary ? (
          <p className="mt-3 line-clamp-3 text-base text-[var(--public-text-soft)]">{item.summary}</p>
        ) : null}
        {more > 0 ? <Link href={detailHref} className="mt-2 inline-flex min-h-8 items-center text-sm font-medium text-[var(--public-primary)] underline-offset-4 hover:underline">+ {more} hạng mục khác</Link> : null}
        {item.resultTime ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--public-muted)]"><Clock className="h-4 w-4" aria-hidden="true" />Có kết quả: {item.resultTime}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-[var(--public-divider)] pt-3">
          <p className="text-sm text-[var(--public-muted)]">Chi phí dự kiến<span className="block text-xl font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</span></p>
          <Link href={`/dat-lich?packageId=${item.id}`} className="public-button-primary inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold">Chọn gói</Link>
        </div>
      </div>
    </>
  );
  if (featured) {
    return (
      <div className="group/pack grid overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm transition duration-200 hover:border-[var(--public-primary)] hover:shadow-lg motion-reduce:transition-none md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">{body}</div>
    );
  }
  return <div className="group/pack flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">{body}</div>;
}
