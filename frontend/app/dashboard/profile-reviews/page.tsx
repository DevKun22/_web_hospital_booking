"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsEmptyState, DsLoading, DsNotice, DsPageHeader, DsPanel, DsStatusPill, useActionToast, useConfirm } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { DoctorProfileContent, DoctorProfileContentState, TimelineEntry } from "@/lib/types";

// Duyệt phần giới thiệu bác sĩ gửi lên: đặt bản đang hiển thị cạnh bản đề xuất, mục thay đổi được tô nổi.
// Người duyệt hiển thị công khai là tên người bấm duyệt.

type PendingProfile = DoctorProfileContentState & { id: string; slug: string; title: string | null; user: { fullName: string } };

const queryKey = ["dashboard", "doctor-profile", "reviews"];
const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN");

const FIELDS: { key: keyof DoctorProfileContent; label: string }[] = [
  { key: "motto", label: "Tâm niệm" },
  { key: "bio", label: "Giới thiệu" },
  { key: "expertise", label: "Lĩnh vực chuyên sâu" },
  { key: "memberships", label: "Hiệp hội chuyên môn" },
  { key: "careerTimeline", label: "Quá trình công tác" },
];

const asText = (key: keyof DoctorProfileContent, value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  if (key === "careerTimeline") {
    return (value as TimelineEntry[]).map((item) => `${item.period} · ${item.place}${item.role ? ` (${item.role})` : ""}`).join("\n");
  }
  return (value as string[]).join("\n");
};

function Compare({ item }: { item: PendingProfile }) {
  const draft = item.profileDraft ?? {};
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {FIELDS.filter(({ key }) => key in draft).map(({ key, label }) => {
        const current = asText(key, item[key]);
        const proposed = asText(key, draft[key]);
        const changed = current !== proposed;
        return (
          <div key={key} style={{ display: "grid", gap: 4 }}>
            <strong style={{ fontSize: 13 }}>
              {label} {changed ? <DsStatusPill tone="warn">Thay đổi</DsStatusPill> : <span className="ds-hint">Không đổi</span>}
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              <div style={{ border: "1px solid var(--ds-line)", borderRadius: 6, padding: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>
                <div className="ds-hint">Đang hiển thị</div>
                {current || <span className="ds-hint">Trống</span>}
              </div>
              <div style={{ border: `1px solid ${changed ? "var(--ds-accent)" : "var(--ds-line)"}`, borderRadius: 6, padding: 8, whiteSpace: "pre-wrap", fontSize: 13 }}>
                <div className="ds-hint">Bản đề xuất</div>
                {proposed || <span className="ds-hint">Trống</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProfileReviewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const allowed = can(user, "profile.review");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  const pending = useQuery({ queryKey, queryFn: () => apiRequest<PendingProfile[]>("/dashboard/doctors/profile-reviews"), enabled: allowed, staleTime: 0 });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "doctors"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "doctors"] }),
    ]);
  };

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) => apiRequest(`/dashboard/doctors/${id}/profile/${action}`, { method: "POST" }),
    onSuccess: async (_data, variables) => {
      setNotice(variables.action === "approve" ? "Đã duyệt, nội dung đang hiển thị công khai" : "Đã từ chối bản chờ duyệt");
      await refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Không xử lý được yêu cầu"),
  });

  const reject = async (item: PendingProfile) => {
    const ok = await confirm({ title: "Từ chối bản giới thiệu?", message: `Bản gửi của ${item.user.fullName} sẽ bị bỏ; bác sĩ cần soạn và gửi lại.`, confirmLabel: "Từ chối", tone: "danger" });
    if (ok) decide.mutate({ id: item.id, action: "reject" });
  };

  const items = pending.data ?? [];

  return (
    <>
      <DsPageHeader title="Duyệt hồ sơ bác sĩ" description="Phần giới thiệu bác sĩ gửi lên; duyệt xong mới hiển thị công khai" />
      {!allowed ? <DsNotice tone="bad">Bạn chưa được cấp quyền duyệt hồ sơ bác sĩ.</DsNotice> : null}
      {pending.isLoading ? <DsLoading label="Đang tải danh sách chờ duyệt..." /> : null}
      {pending.error ? <DsNotice tone="bad">{pending.error instanceof Error ? pending.error.message : "Không tải được danh sách"}</DsNotice> : null}
      {allowed && pending.data && items.length === 0 ? <DsEmptyState title="Không có bản nào chờ duyệt" description="Khi bác sĩ gửi phần giới thiệu, bản đề xuất sẽ hiện ở đây." /> : null}
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((item) => (
          <DsPanel
            key={item.id}
            title={[item.title, item.user.fullName].filter(Boolean).join(" ")}
            actions={
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {item.profileDraftAt ? <span className="ds-hint">Gửi {formatDate(item.profileDraftAt)}</span> : null}
                <DsButton onClick={() => reject(item)} disabled={decide.isPending}>Từ chối</DsButton>
                <DsButton variant="primary" onClick={() => decide.mutate({ id: item.id, action: "approve" })} loading={decide.isPending && decide.variables?.id === item.id}>Duyệt và hiển thị</DsButton>
              </span>
            }
          >
            <Compare item={item} />
          </DsPanel>
        ))}
      </div>
    </>
  );
}
