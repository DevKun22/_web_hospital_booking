"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { DsButton, DsDialog, DsField, DsInput, DsLoading, DsNotice, DsSelect, DsStatusPill, DsTextarea, useConfirm, useToast } from "@/components/ds";
import { apiRequest, uploadImages } from "@/lib/api";
import { ARTICLE_STAGE_LABEL, ARTICLE_STAGE_TONE, getArticleStage, shouldAutoSlug } from "@/lib/article-ui";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";
import { slugifyHeading } from "@/lib/markdown";
import { can } from "@/lib/permissions";
import type { Article, Department } from "@/lib/types";

// Soạn bài trong một hộp thoại gần kín màn hình: tiêu đề lớn và trình soạn chiếm chỗ chính, thông tin bài (trạng thái, đường dẫn,
// tóm tắt, danh mục, chuyên khoa) nằm ở cột bên. Mọi thao tác theo giai đoạn (lưu, duyệt, xuất bản, gỡ, xóa) ở hàng nút cuối hộp.

// Trình soạn nặng (ProseMirror): chỉ tải khi mở hộp soạn bài, không đưa vào gói của cả trang dashboard.
const ArticleEditor = dynamic(() => import("@/components/dashboard/article-editor").then((module) => module.ArticleEditor), {
  ssr: false,
  loading: () => <div className="ds-editor-shell ds-editor-shell--loading" aria-busy="true" />,
});

/** coverImage: đường dẫn ảnh đang hiện; coverAssetId: mã ảnh vừa tải lên, chỉ gửi lên khi lưu (rỗng nghĩa là không đổi ảnh). */
type Meta = { title: string; slug: string; summary: string; category: string; departmentId: string; coverImage: string; coverAssetId: string };

const metaOf = (article: Article | null): Meta => ({
  title: article?.title ?? "",
  slug: article?.slug ?? "",
  summary: article?.summary ?? "",
  category: article?.category ?? "",
  departmentId: article?.departmentId ?? "",
  coverImage: article?.coverImage ?? "",
  coverAssetId: "",
});

type Props = {
  /** null: bài mới. */
  articleId: string | null;
  departments: Pick<Department, "id" | "name">[];
  categories: string[];
  onClose: () => void;
  /** Gọi sau mỗi thay đổi dữ liệu để danh sách tải lại. */
  onChanged: () => void;
};

export function ArticleEditorDialog({ articleId, departments, categories, onClose, onChanged }: Props) {
  const detail = useQuery({
    queryKey: ["dashboard", "articles", "detail", articleId],
    queryFn: () => apiRequest<Article>(`/dashboard/articles/${articleId}`),
    enabled: Boolean(articleId),
    // Luôn đọc bản mới nhất khi mở: người khác có thể đã duyệt hoặc xuất bản.
    gcTime: 0,
  });

  if (articleId && !detail.data) {
    return (
      <DsDialog open onOpenChange={(open) => !open && onClose()} title="Mở bài viết" size="md">
        {detail.error ? <DsNotice tone="bad">{detail.error instanceof Error ? detail.error.message : "Không mở được bài viết"}</DsNotice> : <DsLoading label="Đang mở bài viết..." />}
      </DsDialog>
    );
  }
  return <ArticleDialogBody key={articleId ?? "new"} initial={detail.data ?? null} departments={departments} categories={categories} onClose={onClose} onChanged={onChanged} />;
}

function ArticleDialogBody({ initial, departments, categories, onClose, onChanged }: Omit<Props, "articleId"> & { initial: Article | null }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [article, setArticle] = useState<Article | null>(initial);
  const [meta, setMeta] = useState<Meta>(metaOf(initial));
  const [content, setContent] = useState(initial?.content ?? "");
  // Mốc để biết bài đã thay đổi chưa: trình soạn chuẩn hóa Markdown khi nạp nên mốc nội dung lấy từ chính nó.
  const [baseline, setBaseline] = useState<{ meta: Meta; content: string | null }>({ meta: metaOf(initial), content: null });
  // Bài đã có đường dẫn khác với tiêu đề (từng sửa tay) thì coi là đường dẫn tự chọn: không tự đổi theo tiêu đề nữa.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial && initial.slug !== slugifyHeading(initial.title)));
  const [editingSlug, setEditingSlug] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "review" | "publish" | "unpublish" | "delete">("");
  const [error, setError] = useState("");

  const canPublish = can(user, "article.publish");
  const canReview = can(user, "article.review");
  const stage = article ? getArticleStage(article) : null;
  const isAuthor = Boolean(article?.authorId && article.authorId === user?.id);
  const slugLocked = Boolean(article?.publishedAt);
  const locked = article?.status === "PUBLISHED" && !canPublish;
  const dirty = baseline.content !== null && (content !== baseline.content || JSON.stringify(meta) !== JSON.stringify(baseline.meta));
  const autoSlug = shouldAutoSlug({ slugTouched, locked: slugLocked });
  const slug = autoSlug ? slugifyHeading(meta.title) : meta.slug;

  const requestClose = useCallback(async () => {
    if (dirty && !(await confirm({ title: "Bỏ thay đổi chưa lưu?", message: "Bài viết có thay đổi chưa lưu. Đóng bây giờ sẽ mất các thay đổi đó.", confirmLabel: "Bỏ thay đổi", cancelLabel: "Tiếp tục soạn", tone: "danger" }))) return;
    onClose();
  }, [confirm, dirty, onClose]);

  // Đóng tab hoặc tải lại khi còn thay đổi chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const adopt = (next: Article, savedContent?: string) => {
    setArticle(next);
    setMeta(metaOf(next));
    setBaseline((current) => ({ meta: metaOf(next), content: savedContent ?? current.content }));
    onChanged();
  };

  const run = async (name: typeof busy, action: () => Promise<void>) => {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thực hiện được";
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const save = () =>
    run("save", async () => {
      const wasApproved = Boolean(article?.reviewedAt);
      const wasPublished = article?.status === "PUBLISHED";
      const payload = {
        title: meta.title.trim(),
        summary: meta.summary.trim() || null,
        category: meta.category.trim() || null,
        departmentId: meta.departmentId || null,
        // Ảnh bìa: ảnh mới tải lên thì gửi mã ảnh; đã gỡ ảnh thì gửi null; không đổi thì không gửi.
        ...(meta.coverAssetId ? { imageAssetId: meta.coverAssetId } : article?.coverImage && !meta.coverImage ? { imageAssetId: null } : {}),
        content,
        // Đường dẫn: bài mới để máy chủ tự sinh từ tiêu đề trừ khi người dùng sửa tay; bài nháp theo tiêu đề đến khi sửa tay; bài đã xuất bản thì khóa.
        ...(slugLocked || (!article && !slugTouched) ? {} : { slug }),
      };
      const saved = article
        ? await apiRequest<Article>(`/dashboard/articles/${article.id}`, { method: "PATCH", body: payload })
        : await apiRequest<Article>("/dashboard/articles", { method: "POST", body: payload });
      adopt(saved, content);
      setEditingSlug(false);
      toast.success(
        wasPublished && saved.status !== "PUBLISHED"
          ? "Đã lưu. Nội dung đổi nên bài về bản nháp và cần bác sĩ duyệt lại."
          : wasApproved && !saved.reviewedAt
            ? "Đã lưu. Nội dung đổi nên cần bác sĩ duyệt lại."
            : article
              ? "Đã lưu bài viết"
              : "Đã lưu bản nháp",
      );
    });

  const review = () =>
    run("review", async () => {
      adopt(await apiRequest<Article>(`/dashboard/articles/${article!.id}/review`, { method: "POST" }));
      toast.success("Đã duyệt nội dung. Quản trị có thể xuất bản bài này.");
    });

  const publish = () =>
    run("publish", async () => {
      adopt(await apiRequest<Article>(`/dashboard/articles/${article!.id}/publish`, { method: "POST" }));
      toast.success("Đã xuất bản. Chatbot dùng bài này ngay.");
    });

  const unpublish = () =>
    run("unpublish", async () => {
      adopt(await apiRequest<Article>(`/dashboard/articles/${article!.id}/unpublish`, { method: "POST" }));
      toast.success("Đã gỡ bài khỏi website và chatbot. Dấu duyệt được giữ, xuất bản lại được ngay.");
    });

  const remove = async () => {
    if (!article || !(await confirm({ title: "Xóa bài viết?", message: `Bài "${article.title}" sẽ bị xóa vĩnh viễn và không còn trong tri thức của chatbot.`, confirmLabel: "Xóa", tone: "danger" }))) return;
    await run("delete", async () => {
      await apiRequest(`/dashboard/articles/${article.id}`, { method: "DELETE" });
      toast.success("Đã xóa bài viết");
      onChanged();
      onClose();
    });
  };

  const setField = (patch: Partial<Meta>) => setMeta((current) => ({ ...current, ...patch }));
  const coverInput = useRef<HTMLInputElement | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const uploadCover = async (file: File | undefined) => {
    if (!file || locked) return;
    setUploadingCover(true);
    try {
      const [asset] = await uploadImages([file], "articles");
      if (!asset) throw new Error("Đã tải lên nhưng không nhận được thông tin ảnh");
      setField({ coverImage: asset.url, coverAssetId: asset.id });
      toast.success("Đã tải ảnh bìa lên. Bấm Lưu để áp dụng.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được ảnh lên");
    } finally {
      setUploadingCover(false);
    }
  };
  const canSave = !locked && meta.title.trim().length >= 3 && content.trim().length > 0 && (dirty || !article);
  const reviewHint = dirty ? "Lưu bài trước khi duyệt để bác sĩ duyệt đúng bản đang xem." : undefined;

  return (
    <DsDialog
      open
      onOpenChange={(open) => !open && void requestClose()}
      title={article ? "Sửa bài viết" : "Viết bài mới"}
      size="xl"
      dismissOnOutsideClick={false}
      footer={
        <>
          <span className="ds-article-foot-note">{busy === "save" ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : article ? "Đã lưu" : ""}</span>
          {article && canPublish ? (
            <DsButton variant="ghost" disabled={Boolean(busy)} onClick={() => void remove()}>
              Xóa bài
            </DsButton>
          ) : null}
          <DsButton onClick={() => void requestClose()}>Đóng</DsButton>
          {stage === "PUBLISHED" && canPublish ? (
            <DsButton loading={busy === "unpublish"} disabled={Boolean(busy)} onClick={() => void unpublish()}>
              Gỡ xuất bản
            </DsButton>
          ) : null}
          {stage === "READY" && canPublish ? (
            <DsButton variant="primary" loading={busy === "publish"} disabled={Boolean(busy) || dirty} onClick={() => void publish()}>
              Xuất bản
            </DsButton>
          ) : null}
          {stage === "PENDING_REVIEW" && canReview && !isAuthor ? (
            <DsButton variant="primary" loading={busy === "review"} disabled={Boolean(busy) || dirty} title={reviewHint} onClick={() => void review()}>
              Duyệt nội dung
            </DsButton>
          ) : null}
          <DsButton variant={stage === "PENDING_REVIEW" && canReview && !isAuthor ? "default" : "primary"} loading={busy === "save"} disabled={Boolean(busy) || !canSave} onClick={() => void save()}>
            {article ? "Lưu" : "Lưu bản nháp"}
          </DsButton>
        </>
      }
    >
      <div
        className="ds-article-grid"
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (canSave && !busy) void save();
          }
        }}
      >
        <div className="ds-article-main">
          <input
            className="ds-article-title"
            aria-label="Tiêu đề bài viết"
            placeholder="Tiêu đề bài viết"
            maxLength={200}
            value={meta.title}
            disabled={locked}
            onChange={(event) => setField({ title: event.target.value })}
          />
          <ArticleEditor
            // Nạp lại khi bài đổi hẳn (duyệt, lưu không đổi nội dung đang soạn nên không cần nạp lại).
            key={article?.id ?? "new"}
            initialMarkdown={content}
            disabled={locked}
            onReady={(normalized) => {
              setContent(normalized);
              setBaseline((current) => ({ ...current, content: normalized }));
            }}
            onChange={setContent}
          />
        </div>

        <aside className="ds-article-side" aria-label="Thông tin bài viết">
          {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
          {locked ? <DsNotice tone="warn">Bài đã xuất bản nên chỉ quản trị sửa được.</DsNotice> : null}

          <section className="ds-card">
            <div className="ds-card__head">
              <h3>Trạng thái</h3>
              {stage ? <DsStatusPill tone={ARTICLE_STAGE_TONE[stage]}>{ARTICLE_STAGE_LABEL[stage]}</DsStatusPill> : <DsStatusPill tone="neutral">Bài mới</DsStatusPill>}
            </div>
            <div className="ds-card__body" style={{ fontSize: 13 }}>
              {article?.authorName ? <div>Người viết: {article.authorName}</div> : null}
              {article?.reviewedAt ? (
                <div>
                  Đã được {article.reviewerName} duyệt lúc {formatVietnamDateTime(article.reviewedAt)}
                </div>
              ) : article ? (
                <div className="ds-hint">{isAuthor && canReview ? "Bạn là người viết nên cần bác sĩ khác duyệt." : canReview ? "Đọc kỹ rồi bấm Duyệt nội dung ở cuối hộp." : "Chờ bác sĩ duyệt nội dung chuyên môn."}</div>
              ) : (
                <div className="ds-hint">Lưu bản nháp trước, sau đó bác sĩ duyệt và quản trị xuất bản.</div>
              )}
              {article && (stage === "READY" || stage === "PUBLISHED") ? <div className="ds-hint">Sửa tiêu đề, tóm tắt hoặc nội dung sẽ xóa dấu duyệt và đưa bài về bản nháp.</div> : null}
              {stage === "PUBLISHED" ? (
                <a className="ds-btn ds-btn--ghost" href={`/kien-thuc/${article!.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Xem trên website
                </a>
              ) : null}
            </div>
          </section>

          <DsField label="Đường dẫn" htmlFor="art-slug-view" hint={slugLocked ? "Đã khóa từ lần xuất bản đầu để giữ nguyên liên kết đã chia sẻ và nguồn trích của chatbot." : "Tự theo tiêu đề; sửa tay được khi bài chưa xuất bản."}>
            {editingSlug && !slugLocked ? (
              <DsInput
                id="art-slug-view"
                value={meta.slug}
                autoFocus
                onChange={(event) => {
                  setSlugTouched(true);
                  setField({ slug: slugifyHeading(event.target.value) });
                }}
              />
            ) : (
              <div className="ds-article-slug">
                <code id="art-slug-view">/kien-thuc/{slug || "…"}</code>
                {!slugLocked ? (
                  <DsButton
                    variant="ghost"
                    onClick={() => {
                      setField({ slug });
                      setEditingSlug(true);
                    }}
                  >
                    Sửa
                  </DsButton>
                ) : null}
              </div>
            )}
          </DsField>

          <DsField label="Tóm tắt" htmlFor="art-summary" hint={`${meta.summary.length}/400 · hiện ở danh sách bài và kết quả tìm kiếm`}>
            <DsTextarea id="art-summary" rows={3} maxLength={400} value={meta.summary} disabled={locked} onChange={(event) => setField({ summary: event.target.value })} />
          </DsField>
          <DsField label="Danh mục" htmlFor="art-category">
            <DsInput id="art-category" list="art-categories" value={meta.category} placeholder="Dinh dưỡng, Phòng bệnh…" disabled={locked} onChange={(event) => setField({ category: event.target.value })} />
            <datalist id="art-categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </DsField>
          <DsField label="Chuyên khoa liên quan" htmlFor="art-dept" hint="Cuối bài có nút đặt lịch khoa này">
            <DsSelect id="art-dept" value={meta.departmentId} disabled={locked} onChange={(event) => setField({ departmentId: event.target.value })}>
              <option value="">Không gắn chuyên khoa</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </DsSelect>
          </DsField>
          <DsField label="Ảnh bìa" htmlFor="art-cover-file" hint="JPG, PNG hoặc WEBP · hiện ở trang chủ, danh sách và đầu bài. Đổi ảnh không làm mất dấu duyệt.">
            {meta.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meta.coverImage} alt="Ảnh bìa của bài viết" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 6, marginBottom: 8 }} />
            ) : null}
            <input
              ref={coverInput}
              id="art-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={locked || uploadingCover}
              onChange={(event) => {
                void uploadCover(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DsButton variant="default" loading={uploadingCover} disabled={locked || uploadingCover} onClick={() => coverInput.current?.click()}>
                {meta.coverImage ? "Đổi ảnh" : "Chọn ảnh từ máy"}
              </DsButton>
              {meta.coverImage ? (
                <DsButton variant="ghost" disabled={locked || uploadingCover} onClick={() => setField({ coverImage: "", coverAssetId: "" })}>
                  Gỡ ảnh
                </DsButton>
              ) : null}
            </div>
          </DsField>
        </aside>
      </div>
    </DsDialog>
  );
}
