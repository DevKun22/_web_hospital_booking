"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsLoading, DsNotice, DsPageHeader, DsPanel, DsStatusPill, DsTextarea, useActionToast, useConfirm } from "@/components/ds";
import { StringListEditor, TimelineEditor, cleanStrings, cleanTimeline } from "@/components/dashboard/content-editors";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { DoctorProfileContent, DoctorProfileContentState, TimelineEntry } from "@/lib/types";

// Hồ sơ giới thiệu của bác sĩ: soạn bản nháp rồi gửi duyệt. Trang công khai chỉ hiện bản đã được quản trị duyệt.

const queryKey = ["dashboard", "doctor-profile", "me"];
const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN");

type FormState = { bio: string; motto: string; expertise: string[]; memberships: string[]; careerTimeline: TimelineEntry[] };

// Form luôn bắt đầu từ bản đang chờ duyệt (nếu có) để bác sĩ sửa tiếp, nếu không thì từ bản đang hiển thị.
const initialForm = (state: DoctorProfileContentState): FormState => {
  const source: Partial<DoctorProfileContent> = state.profileDraft ?? state;
  return {
    bio: source.bio ?? state.bio ?? "",
    motto: source.motto ?? state.motto ?? "",
    expertise: source.expertise ?? state.expertise ?? [],
    memberships: source.memberships ?? state.memberships ?? [],
    careerTimeline: source.careerTimeline ?? state.careerTimeline ?? [],
  };
};

function ProfileForm({ state }: { state: DoctorProfileContentState }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(() => initialForm(state));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  const hasDraft = Boolean(state.profileDraftAt);
  const onSaved = (next: DoctorProfileContentState, message: string) => {
    queryClient.setQueryData(queryKey, next);
    setNotice(message);
  };

  const send = useMutation({
    mutationFn: () =>
      apiRequest<DoctorProfileContentState>("/dashboard/doctors/me/profile", {
        method: "PUT",
        body: {
          bio: form.bio.trim() || null,
          motto: form.motto.trim() || null,
          expertise: cleanStrings(form.expertise),
          memberships: cleanStrings(form.memberships),
          careerTimeline: cleanTimeline(form.careerTimeline),
        },
      }),
    onSuccess: (next) => onSaved(next, "Đã gửi chờ duyệt"),
    onError: (err) => setError(err instanceof Error ? err.message : "Không gửi được bản giới thiệu"),
  });

  const discard = useMutation({
    mutationFn: () => apiRequest<DoctorProfileContentState>("/dashboard/doctors/me/profile", { method: "DELETE" }),
    onSuccess: (next) => onSaved(next, "Đã hủy bản chờ duyệt"),
    onError: (err) => setError(err instanceof Error ? err.message : "Không hủy được bản chờ duyệt"),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    send.mutate();
  };

  const handleDiscard = async () => {
    const ok = await confirm({ title: "Hủy bản chờ duyệt?", message: "Nội dung đang gửi sẽ bị bỏ. Trang công khai vẫn giữ bản đã duyệt gần nhất.", confirmLabel: "Hủy bản chờ", tone: "danger" });
    if (ok) discard.mutate();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }} aria-label="Hồ sơ giới thiệu của tôi">
      <DsPanel title="Trạng thái">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {hasDraft ? <DsStatusPill tone="warn">Đã gửi {formatDate(state.profileDraftAt!)}, chờ duyệt</DsStatusPill> : <DsStatusPill tone="neutral">Chưa có bản chờ duyệt</DsStatusPill>}
          {state.profileUpdatedAt ? (
            <DsStatusPill tone="good">
              Đang hiển thị: bản duyệt {formatDate(state.profileUpdatedAt)}
              {state.profileReviewerName ? ` bởi ${state.profileReviewerName}` : ""}
            </DsStatusPill>
          ) : (
            <DsStatusPill tone="neutral">Chưa có bản nào được duyệt</DsStatusPill>
          )}
        </div>
        <p className="ds-hint" style={{ margin: "8px 0 0" }}>
          Học hàm học vị, chuyên khoa và phí khám do quản trị cập nhật. Nội dung dưới đây chỉ hiển thị công khai sau khi quản trị duyệt.
        </p>
      </DsPanel>

      <DsPanel title="Nội dung giới thiệu">
        <div style={{ display: "grid", gap: 12 }}>
          <DsField label="Tâm niệm nghề nghiệp" htmlFor="me-motto" hint="Một câu ngắn.">
            <DsInput id="me-motto" maxLength={300} value={form.motto} onChange={(event) => setForm((current) => ({ ...current, motto: event.target.value }))} />
          </DsField>
          <DsField label="Giới thiệu" htmlFor="me-bio" hint="Tiểu sử và định hướng chuyên môn, viết bằng ngôi thứ ba.">
            <DsTextarea id="me-bio" rows={5} maxLength={4000} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} />
          </DsField>
          <StringListEditor id="me-expertise" label="Lĩnh vực chuyên sâu" values={form.expertise} onChange={(expertise) => setForm((current) => ({ ...current, expertise }))} addLabel="Thêm lĩnh vực" itemLabel="lĩnh vực" />
          <StringListEditor id="me-memberships" label="Hiệp hội chuyên môn" values={form.memberships} onChange={(memberships) => setForm((current) => ({ ...current, memberships }))} addLabel="Thêm hiệp hội" itemLabel="hiệp hội" />
          <TimelineEditor id="me-career" values={form.careerTimeline} onChange={(careerTimeline) => setForm((current) => ({ ...current, careerTimeline }))} />
        </div>
      </DsPanel>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <DsButton type="submit" variant="primary" loading={send.isPending}>Gửi duyệt</DsButton>
        {hasDraft ? <DsButton onClick={handleDiscard} loading={discard.isPending}>Hủy bản chờ</DsButton> : null}
      </div>
    </form>
  );
}

export default function MyProfilePage() {
  const { user } = useAuth();
  const allowed = can(user, "profile.request");
  const profileQuery = useQuery({ queryKey, queryFn: () => apiRequest<DoctorProfileContentState>("/dashboard/doctors/me/profile"), enabled: allowed, staleTime: 0 });
  const state = profileQuery.data;

  return (
    <>
      <DsPageHeader title="Hồ sơ giới thiệu" description="Phần giới thiệu bạn soạn cho trang công khai; quản trị duyệt trước khi hiển thị" />
      {!allowed ? <DsNotice tone="bad">Trang này dành cho bác sĩ có hồ sơ.</DsNotice> : null}
      {profileQuery.isLoading ? <DsLoading label="Đang tải hồ sơ..." /> : null}
      {profileQuery.error ? <DsNotice tone="bad">{profileQuery.error instanceof Error ? profileQuery.error.message : "Không tải được hồ sơ"}</DsNotice> : null}
      {/* key đổi khi bản gửi hoặc bản duyệt đổi, để biểu mẫu lấy lại giá trị đầu từ máy chủ. */}
      {state ? <ProfileForm key={`${state.profileDraftAt ?? ""}|${state.profileUpdatedAt ?? ""}`} state={state} /> : null}
    </>
  );
}
