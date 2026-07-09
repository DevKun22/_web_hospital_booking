"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function LazyMount({ children, fallback, rootMargin = "120px 0px" }: { children: ReactNode; fallback: ReactNode; rootMargin?: string }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    if (window.location.hash === "#booking" || window.location.search) {
      const timeoutId = window.setTimeout(() => setMounted(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    const anchor = anchorRef.current;
    if (!anchor || !("IntersectionObserver" in window)) {
      const timeoutId = window.setTimeout(() => setMounted(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setMounted(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return <div ref={anchorRef}>{mounted ? children : fallback}</div>;
}

export function IdleMount({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(() => setMounted(true), { timeout: 2500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timeoutId = window.setTimeout(() => setMounted(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return mounted ? children : null;
}
