"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { safeHref } from "@/lib/safe-href";
import type { Banner } from "@/lib/types";

// Trình chiếu ở bên phải hero: các banner "Hero" do quản trị cấu hình (ảnh, tiêu đề, mô tả, đường dẫn, ảnh riêng cho điện thoại).
// Tự chuyển chậm, dừng khi rê chuột hoặc đang dùng bàn phím trong khung; có nút tạm dừng; tắt tự chuyển khi hệ điều hành bật "giảm chuyển động".

const AUTOPLAY_MS = 6500;

export function HomeHeroSlider({ banners }: { banners: Banner[] }) {
  const slides = banners.slice(0, 5);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const paused = manualPause || hovering || reducedMotion || count < 2;

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [go, index, paused]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Thông tin nổi bật"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-white/30"
    >
      <div className="relative aspect-[16/10] bg-slate-100">
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
                  className="h-full w-full object-cover"
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                  fetchPriority={slideIndex === 0 ? "high" : "auto"}
                  decoding="async"
                />
              </picture>
            </div>
          );
        })}
      </div>

      <div className="p-4 sm:p-5">
        <div aria-live={paused ? "polite" : "off"} className="min-h-[4.5rem]">
          <p className="text-base font-semibold leading-snug">{slides[index].title}</p>
          {slides[index].subtitle ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{slides[index].subtitle}</p> : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {slides[index].linkUrl ? (
            <Link href={safeHref(slides[index].linkUrl)} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#07549c] underline-offset-4 hover:underline">
              Xem chi tiết
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
          {count > 1 ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => go(index - 1)} aria-label="Slide trước" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <ul className="flex items-center gap-1.5" aria-label="Chọn slide">
                {slides.map((banner, dotIndex) => (
                  <li key={banner.id}>
                    <button
                      type="button"
                      onClick={() => go(dotIndex)}
                      aria-label={`Slide ${dotIndex + 1}`}
                      aria-current={dotIndex === index}
                      className="inline-flex h-6 w-6 items-center justify-center"
                    >
                      <span className={`block h-2 rounded-full transition-all ${dotIndex === index ? "w-5 bg-[#07549c]" : "w-2 bg-slate-300"}`} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => go(index + 1)} aria-label="Slide kế tiếp" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setManualPause((current) => !current)}
                aria-label={manualPause ? "Tiếp tục tự chuyển slide" : "Tạm dừng tự chuyển slide"}
                aria-pressed={manualPause}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {manualPause ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
