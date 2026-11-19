import { slugifyHeading } from "@/lib/markdown";
import type { ContentSection } from "@/lib/types";

// Neo của từng mục giới thiệu; trùng tiêu đề thì thêm số thứ tự. Mục đầu tiên khớp với liên kết nguồn mà chatbot trả về
// (backend dựng cùng kiểu neo từ tiêu đề mục).
export const sectionAnchors = (sections: ContentSection[] | undefined) => {
  const seen = new Map<string, number>();
  return (sections ?? [])
    .filter((section) => section.title.trim() && section.body.trim())
    .map((section) => {
      const base = slugifyHeading(section.title) || "muc";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { id: count === 0 ? base : `${base}-${count + 1}`, title: section.title, body: section.body };
    });
};
