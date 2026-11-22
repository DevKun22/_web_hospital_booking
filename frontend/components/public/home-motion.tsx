"use client";

import { useEffect } from "react";

// Hiệu ứng hiện dần khi cuộn ở trang chủ. Máy chủ vẫn dựng đủ nội dung; chỉ sau khi trang chạy trên trình duyệt mới "gài" trạng thái ẩn ban đầu
// (thuộc tính data-motion trên vùng nội dung), nên không có JavaScript, robot hoặc bật giảm chuyển động thì mọi thứ hiện sẵn.
// Phần tử có data-reveal tự hiện khi vào màn hình; vùng có data-reveal-group giao thuộc tính này cho từng phần tử con, kèm độ trễ nối tiếp.
// "up": trượt lên; "sides": phần tử đầu trượt từ trái, các phần tử sau từ phải.

export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const root = document.getElementById("home-content");
    if (!root) return;

    root.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
      const mode = group.dataset.revealGroup;
      Array.from(group.children).forEach((child, index) => {
        const element = child as HTMLElement;
        element.dataset.reveal = mode === "sides" ? (index === 0 ? "left" : "right") : "up";
        element.style.setProperty("--i", String(index));
      });
    });

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.in = "1";
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    // Phần tử đã nằm trong hoặc phía trên màn hình lúc gài (tải lại giữa trang) hiện luôn, không ẩn rồi hiện lại gây nháy và cảm giác trang đơ.
    const fold = window.innerHeight * 0.92;
    const pending = targets.filter((target) => {
      if (target.getBoundingClientRect().top < fold) {
        target.dataset.in = "1";
        return false;
      }
      return true;
    });
    root.dataset.motion = "armed";
    pending.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      delete root.dataset.motion;
      targets.forEach((target) => delete target.dataset.in);
    };
  }, []);

  return null;
}
