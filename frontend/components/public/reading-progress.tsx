"use client";

import { useEffect, useRef } from "react";
import { scrollProgress } from "@/lib/scroll-progress";

// Vạch tiến độ đọc mảnh: nằm ngay dưới dải đầu bài, cuộn qua dải thì dính dưới header. Chạy theo vị trí cuộn trong vùng bài viết (targetId); chỉ dùng transform.
export function ReadingProgress({ targetId }: { targetId: string }) {
  const barRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = document.getElementById(targetId);
      const bar = barRef.current;
      if (!target || !bar) return;
      const top = target.getBoundingClientRect().top + window.scrollY;
      bar.style.transform = `scaleX(${scrollProgress(window.scrollY, top, target.offsetHeight, window.innerHeight)})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return (
    <div aria-hidden="true" className="sticky top-14 z-30 h-[3px] bg-[var(--public-border)] xl:top-[4.25rem]">
      <span ref={barRef} className="block h-full origin-left scale-x-0 bg-[var(--public-primary)]" />
    </div>
  );
}
