"use client";

import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DsButton, DsInput } from "@/components/ds";

// Trình soạn bài kiểu "gõ là thấy" (TipTap, thư viện soạn thảo phổ biến cho React, xây trên ProseMirror) nhưng LƯU Ở DẠNG MARKDOWN:
// bài cũ, trang công khai và kho tri thức của chatbot (cắt theo tiêu đề mục) đều đọc Markdown nên không phải đổi gì ở phía sau.
// Chỉ bật phần Markdown của trang công khai hiểu: mục lớn/nhỏ, in đậm, in nghiêng, danh sách, trích dẫn, liên kết.

const isSafeHref = (href: string) => /^(https?:\/\/|\/(?!\/)|#)/i.test(href.trim());

type ToolbarButton = { label: string; icon: React.ReactNode; active: boolean; disabled?: boolean; run: () => void };

function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const chain = () => editor.chain().focus();
  const buttons: (ToolbarButton | "sep")[] = [
    { label: "Mục lớn", icon: <Heading2 aria-hidden="true" />, active: editor.isActive("heading", { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "Mục nhỏ", icon: <Heading3 aria-hidden="true" />, active: editor.isActive("heading", { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    "sep",
    { label: "In đậm (Ctrl+B)", icon: <Bold aria-hidden="true" />, active: editor.isActive("bold"), run: () => chain().toggleBold().run() },
    { label: "In nghiêng (Ctrl+I)", icon: <Italic aria-hidden="true" />, active: editor.isActive("italic"), run: () => chain().toggleItalic().run() },
    { label: "Liên kết", icon: <Link2 aria-hidden="true" />, active: editor.isActive("link"), run: onLink },
    "sep",
    { label: "Danh sách gạch đầu dòng", icon: <List aria-hidden="true" />, active: editor.isActive("bulletList"), run: () => chain().toggleBulletList().run() },
    { label: "Danh sách đánh số", icon: <ListOrdered aria-hidden="true" />, active: editor.isActive("orderedList"), run: () => chain().toggleOrderedList().run() },
    { label: "Trích dẫn, lưu ý", icon: <Quote aria-hidden="true" />, active: editor.isActive("blockquote"), run: () => chain().toggleBlockquote().run() },
    "sep",
    { label: "Hoàn tác (Ctrl+Z)", icon: <Undo2 aria-hidden="true" />, active: false, disabled: !editor.can().undo(), run: () => chain().undo().run() },
    { label: "Làm lại (Ctrl+Y)", icon: <Redo2 aria-hidden="true" />, active: false, disabled: !editor.can().redo(), run: () => chain().redo().run() },
  ];

  return (
    <div className="ds-editor-toolbar" role="toolbar" aria-label="Định dạng bài viết">
      {buttons.map((button, index) =>
        button === "sep" ? (
          <span key={`sep-${index}`} className="ds-editor-toolbar__sep" aria-hidden="true" />
        ) : (
          <button
            key={button.label}
            type="button"
            className="ds-editor-toolbar__btn"
            aria-label={button.label}
            title={button.label}
            aria-pressed={button.active}
            disabled={button.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={button.run}
          >
            {button.icon}
          </button>
        ),
      )}
    </div>
  );
}

export function ArticleEditor({
  initialMarkdown,
  disabled,
  onReady,
  onChange,
}: {
  /** Nội dung Markdown khi mở; muốn nạp bài khác thì gắn `key` khác cho component. */
  initialMarkdown: string;
  disabled?: boolean;
  /** Gọi một lần khi trình soạn sẵn sàng, kèm Markdown đã chuẩn hóa: dùng làm mốc để biết bài có thay đổi hay chưa. */
  onReady: (normalizedMarkdown: string) => void;
  onChange: (markdown: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Những thứ trang công khai không hiển thị: tắt để người viết không tạo ra định dạng sẽ bị mất.
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
        underline: false,
        hardBreak: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
      }),
      Markdown,
    ],
    content: initialMarkdown,
    contentType: "markdown",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { attributes: { class: "ds-prose", "aria-label": "Nội dung bài viết", role: "textbox", "aria-multiline": "true" } },
    onCreate: ({ editor: created }) => onReady(created.getMarkdown()),
    onUpdate: ({ editor: updated }) => onChange(updated.getMarkdown()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return <div className="ds-editor-shell ds-editor-shell--loading" aria-busy="true" />;

  const openLink = () => {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = linkValue.trim();
    if (!href) editor.chain().focus().unsetLink().run();
    else if (isSafeHref(href)) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    else return;
    setLinkOpen(false);
  };

  const invalidLink = linkValue.trim() !== "" && !isSafeHref(linkValue);

  return (
    <div className="ds-editor-shell">
      {disabled ? null : <Toolbar editor={editor} onLink={openLink} />}
      {linkOpen ? (
        <div className="ds-editor-link">
          <DsInput
            aria-label="Địa chỉ liên kết"
            autoFocus
            value={linkValue}
            placeholder="https://… hoặc /goi-kham"
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <DsButton variant="primary" disabled={invalidLink} onClick={applyLink}>
            Áp dụng
          </DsButton>
          <DsButton onClick={() => setLinkOpen(false)}>Hủy</DsButton>
          {invalidLink ? <span className="ds-editor-link__error">Chỉ nhận địa chỉ bắt đầu bằng http, https hoặc dấu gạch chéo.</span> : <span className="ds-hint">Để trống rồi Áp dụng để gỡ liên kết.</span>}
        </div>
      ) : null}
      <EditorContent editor={editor} className="ds-editor-content" />
    </div>
  );
}
