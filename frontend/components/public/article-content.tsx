import Link from "next/link";
import type { Block, InlineNode } from "@/lib/markdown";

// Hiển thị nội dung bài viết từ cấu trúc do lib/markdown tạo ra (không dùng dangerouslySetInnerHTML).

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return node.text;
        if (node.type === "bold") return <strong key={index}>{<Inline nodes={node.children} />}</strong>;
        if (node.type === "italic") return <em key={index}>{<Inline nodes={node.children} />}</em>;
        const external = /^https?:\/\//i.test(node.href);
        return external ? (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-[var(--public-primary)] underline underline-offset-2">
            <Inline nodes={node.children} />
          </a>
        ) : (
          <Link key={index} href={node.href} className="font-medium text-[var(--public-primary)] underline underline-offset-2">
            <Inline nodes={node.children} />
          </Link>
        );
      })}
    </>
  );
}

export function ArticleContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 text-base leading-8 text-[var(--public-text-soft)]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={index}
              id={block.id}
              className={`scroll-mt-24 font-bold text-[var(--public-ink)] ${block.level === 2 ? "mt-8 border-t border-[var(--public-divider)] pt-6 text-xl" : "mt-5 text-lg"}`}
            >
              <Inline nodes={block.children} />
            </Tag>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className={`space-y-1.5 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={index} className="border-l-4 border-[var(--public-primary)] bg-[var(--public-primary-soft)] px-4 py-2 text-[var(--public-ink)]">
              <Inline nodes={block.children} />
            </blockquote>
          );
        }
        return (
          <p key={index}>
            <Inline nodes={block.children} />
          </p>
        );
      })}
    </div>
  );
}
