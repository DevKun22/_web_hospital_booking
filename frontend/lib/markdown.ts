// Bộ đọc Markdown tối giản cho bài viết kiến thức sức khỏe: chỉ phần cần cho bài viết (tiêu đề mục, đoạn văn, danh sách,
// trích dẫn, in đậm, in nghiêng, liên kết). Trả về cấu trúc dữ liệu thay vì HTML nên không có đường nào chèn mã vào trang:
// liên kết chỉ nhận http, https hoặc đường dẫn nội bộ.

import { createSlug } from "./slug";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type Block =
  | { type: "heading"; level: 2 | 3; id: string; children: InlineNode[]; text: string }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "quote"; children: InlineNode[] };

/** Cùng cách tạo neo với backend (createSlug) để liên kết nguồn của chatbot trỏ đúng mục. */
export const slugifyHeading = createSlug;

const isSafeHref = (href: string) => /^(https?:\/\/|\/(?!\/)|#)/i.test(href.trim());

const INLINE = /\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])|\[([^\]]+)\]\(([^)\s]+)\)/;

export const parseInline = (text: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) nodes.push({ type: "text", text: rest.slice(0, match.index) });
    if (match[1] !== undefined) nodes.push({ type: "bold", children: parseInline(match[1]) });
    else if (match[2] !== undefined) nodes.push({ type: "italic", children: parseInline(match[2]) });
    else if (isSafeHref(match[4])) nodes.push({ type: "link", href: match[4], children: parseInline(match[3]) });
    else nodes.push({ type: "text", text: match[3] });
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
};

const plainText = (nodes: InlineNode[]): string =>
  nodes.map((node) => (node.type === "text" ? node.text : plainText(node.children))).join("");

export const parseMarkdown = (source: string): Block[] => {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const usedIds = new Map<string, number>();

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const children = parseInline(heading[2]);
      const text = plainText(children);
      const base = slugifyHeading(text) || "muc";
      const count = usedIds.get(base) ?? 0;
      usedIds.set(base, count + 1);
      blocks.push({ type: "heading", level: heading[1].length === 2 ? 2 : 3, id: count ? `${base}-${count + 1}` : base, children, text });
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", children: parseInline(quote[1]) });
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
};

/** Mục lục từ các tiêu đề cấp 2. */
export const getOutline = (blocks: Block[]) =>
  blocks.flatMap((block) => (block.type === "heading" && block.level === 2 ? [{ id: block.id, text: block.text }] : []));

/** Thời gian đọc ước tính (khoảng 200 từ mỗi phút), tối thiểu 1 phút. */
export const estimateReadingMinutes = (source: string) => Math.max(1, Math.round(source.split(/\s+/).filter(Boolean).length / 200));
