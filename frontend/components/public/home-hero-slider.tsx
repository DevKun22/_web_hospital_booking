"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { safeHref } from "@/lib/safe-href";
import type { Banner } from "@/lib/types";

// Trình chiếu ở bên phải hero: các banner "Hero" do quản trị cấu hình (ảnh, tiêu đề, mô tả, đường dẫn, ảnh riêng cho điện thoại).
// Tự chuyển chậm, dừng khi rê chuột hoặc đang dùng bàn phím trong khung và tắt khi hệ điều hành bật "giảm chuyển động".
// Dùng chuột được: kéo ngang trên ảnh để sang slide, hai mũi tên hiện khi rê vào ảnh, bấm chấm để chọn slide, bấm ảnh để mở liên kết.

const AUTOPLAY_MS = 6500;
const DRAG_THRESHOLD_PX = 50;

export function HomeHeroSlider({ banners }: { banners: Banner[] }) {
  const slides = banners.slice(0, 5);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStart = useRef<{ x: number; id: number } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const paused = hovering || reducedMotion || count < 2;

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [go, index, paused]);

  if (!count) return null;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragStart.current = { x: event.clientX, id: event.pointerId };
    didDrag.current = false;
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.id !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) > 8 && !dragging) {
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const delta = event.clientX - start.x;
    if (dragging && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    if (Math.abs(delta) >= DRAG_THRESHOLD_PX) {
      didDrag.current = true;
      go(index + (delta < 0 ? 1 : -1));
    }
  };

  const current = slides[index];
  const href = current.linkUrl ? safeHref(current.linkUrl) : null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Thông tin nổi bật"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group overflow-hidden rounded-2xl bg-[var(--public-surface)] text-[var(--public-ink)] shadow-2xl ring-1 ring-white/30"
    >
      <div
        className={`relative aspect-[16/10] touch-pan-y select-none bg-[var(--public-surface-muted)] ${count > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {slides.map((banner, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} / ${count}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <picture>
                {banner.mobileImage ? <source media="(max-width: 639px)" srcSet={banner.mobileImage} /> : null}
                <img
                  src={banner.image}
                  alt=""
                  width={960}
                  height={600}
                  draggable={false}
                  className="h-full w-full object-cover"
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                  fetchPriority={slideIndex === 0 ? "high" : "auto"}
                  decoding="async"
                />
              </picture>
            </div>
          );
        })}

        {href ? (
          <Link
            href={href}
            tabIndex={-1}
            aria-hidden="true"
            draggable={false}
            onClick={(event) => {
              // Kéo ảnh để sang slide không được tính là bấm vào liên kết.
              if (didDrag.current) {
                event.preventDefault();
                didDrag.current = false;
              }
            }}
            className="absolute inset-0 z-[1]"
          />
        ) : null}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Slide trước"
              className="absolute left-3 top-1/2 z-[2] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--public-surface)] text-[var(--public-ink)] opacity-0 shadow-md transition hover:bg-[var(--public-surface-muted)] focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Slide kế tiếp"
              className="absolute right-3 top-1/2 z-[2] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--public-surface)] text-[var(--public-ink)] opacity-0 shadow-md transition hover:bg-[var(--public-surface-muted)] focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pb-3 pt-4 sm:px-5">
        <div aria-live={paused ? "polite" : "off"} className="min-h-[4.25rem]">
          <p className="text-base font-semibold leading-snug">{current.title}</p>
          {current.subtitle ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--public-muted)]">{current.subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--public-primary)] underline-offset-4 hover:underline">
            Xem chi tiết
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        {count > 1 ? (
          <ul className="mt-1 flex items-center justify-center gap-1.5" aria-label="Chọn slide">
            {slides.map((banner, dotIndex) => (
              <li key={banner.id}>
                <button
                  type="button"
                  onClick={() => go(dotIndex)}
                  aria-label={`Slide ${dotIndex + 1}`}
                  aria-current={dotIndex === index}
                  className="inline-flex h-7 w-7 items-center justify-center"
                >
                  <span className={`block h-2 rounded-full transition-all ${dotIndex === index ? "w-6 bg-[var(--public-solid)]" : "w-2 bg-[var(--public-border)]"}`} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
