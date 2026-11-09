"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Star } from "lucide-react";
import {
  DsButton,
  DsEmptyState,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsToolbar,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardDoctors } from "@/lib/dashboard-doctors-query";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";

// Đánh giá sau khám: điểm trung bình ở đầu trang, danh sách bên trái; chọn một đánh giá thì khung bên phải hiện
// chi tiết điểm, nhận xét và nút công khai hoặc ẩn khỏi trang người dùng.

type ReviewItem = {
  id: string;
  rating: number;
  doctorRating: number;
  serviceRating: number;
  facilityRating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  appointment: { bookingCode?: string; patientName?: string; appointmentDate: string; startTime: string };
  doctor: { title: string | null; user: { fullName: string }; department: { name: string } };
};

type ReviewDashboardData = {
  items: ReviewItem[];
  metrics: { total: number; averageRating: number; averageDoctorRating: number; averageServiceRating: number; averageFacilityRating: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const PAGE_SIZE = 20;

const formatScore = (value: number) => (value ? value.toFixed(1) : "-");

const doctorLabel = (doctor: ReviewItem["doctor"]) => [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const ratingTone = (rating: number) => (rating >= 4 ? "good" : rating >= 3 ? "warn" : "bad");

export default function DashboardReviewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [minRating, setMinRating] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canModerate = can(user, "review.moderate");
  const isDoctor = user?.role === "DOCTOR";
  const doctorsQuery = useDashboardDoctors(useMemo(() => ({ limit: 100 }), []));
  const doctors = !isDoctor && can(user, "catalog.view") ? (doctorsQuery.data?.items ?? []) : [];

  const query = useMemo(() => ({ doctorId: isDoctor ? undefined : doctorId || undefined, minRating: minRating || undefined, page, limit: PAGE_SIZE }), [doctorId, isDoctor, minRating, page]);
  const reviewsQuery = useQuery({
    queryKey: ["dashboard", "reviews", query],
    queryFn: () => apiRequest<ReviewDashboardData>("/dashboard/reviews", { query }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const data = reviewsQuery.data;
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page, limit: PAGE_SIZE, total: 0, totalPages: 1 };
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const visibilityMutation = useMutation({
    mutationFn: (review: ReviewItem) => apiRequest(`/dashboard/reviews/${review.id}/visibility`, { method: "PATCH", body: { isVisible: !review.isVisible } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "reviews"] });
    },
  });

  const metrics = [
    ["Điểm trung bình", data?.metrics.averageRating ?? 0],
    ["Bác sĩ", data?.metrics.averageDoctorRating ?? 0],
    ["Dịch vụ", data?.metrics.averageServiceRating ?? 0],
    ["Cơ sở vật chất", data?.metrics.averageFacilityRating ?? 0],
  ] as const;

  const errorMessage = visibilityMutation.error instanceof Error ? visibilityMutation.error.message : reviewsQuery.error instanceof Error ? reviewsQuery.error.message : reviewsQuery.error ? "Không tải được đánh giá" : "";

  const list = (
    <DsPanel flush>
      <DsToolbar>
        {doctors.length ? (
          <div style={{ minWidth: 170, flex: "1 1 220px" }}>
            <DsSelect
              aria-label="Lọc theo bác sĩ"
              value={doctorId}
              onChange={(event) => {
                setDoctorId(event.target.value);
                setPage(1);
                setSelectedId(null);
              }}
            >
              <option value="">Tất cả bác sĩ</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {[doctor.title, doctor.user.fullName].filter(Boolean).join(" ")}
                </option>
              ))}
            </DsSelect>
          </div>
        ) : null}
        <div style={{ minWidth: 150, flex: "0 1 190px" }}>
          <DsSelect
            aria-label="Lọc theo điểm tối thiểu"
            value={minRating}
            onChange={(event) => {
              setMinRating(event.target.value);
              setPage(1);
              setSelectedId(null);
            }}
          >
            <option value="">Mọi mức điểm</option>
            <option value="5">Từ 5 sao</option>
            <option value="4">Từ 4 sao</option>
            <option value="3">Từ 3 sao</option>
            <option value="2">Từ 2 sao</option>
          </DsSelect>
        </div>
        <DsButton onClick={() => void reviewsQuery.refetch()}>
          <RefreshCw aria-hidden="true" className={reviewsQuery.isFetching ? "animate-spin" : undefined} />
          Làm mới
        </DsButton>
      </DsToolbar>
      {reviewsQuery.isLoading ? <p style={{ margin: 0, padding: 16, color: "var(--ds-muted)" }}>Đang tải đánh giá...</p> : null}
      {!reviewsQuery.isLoading && items.length === 0 ? <DsEmptyState title="Chưa có phản hồi" description="Đánh giá đã xác thực sẽ xuất hiện tại đây." /> : null}
      <div role="listbox" aria-label="Danh sách đánh giá">
        {items.map((review) => (
          <button key={review.id} type="button" role="option" className="ds-listrow" aria-selected={review.id === selectedId} onClick={() => setSelectedId(review.id)}>
            <span className="ds-listrow__main">
              <strong>{review.appointment.patientName || "Phản hồi ẩn danh"}</strong>
              <small>
                {doctorLabel(review.doctor)} · {formatVietnamDate(review.createdAt)}
                {review.comment ? ` · ${review.comment.slice(0, 48)}${review.comment.length > 48 ? "…" : ""}` : ""}
              </small>
            </span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!review.isVisible ? <DsStatusPill tone="neutral">Đã ẩn</DsStatusPill> : null}
              <DsStatusPill tone={ratingTone(review.rating)}>
                <Star size={12} aria-hidden="true" style={{ display: "inline", marginRight: 2 }} />
                {formatScore(review.rating)}
              </DsStatusPill>
            </span>
          </button>
        ))}
      </div>
      <div className="ds-pager">
        <span>
          {pagination.total} đánh giá · trang {pagination.page}/{pagination.totalPages || 1}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <DsButton disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Trước
          </DsButton>
          <DsButton disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
            Sau
          </DsButton>
        </span>
      </div>
    </DsPanel>
  );

  const pane = selected ? (
    <DsPane
      title={selected.appointment.patientName || "Phản hồi ẩn danh"}
      badge={<DsStatusPill tone={selected.isVisible ? "good" : "neutral"}>{selected.isVisible ? "Đang công khai" : "Đã ẩn"}</DsStatusPill>}
      onClose={() => setSelectedId(null)}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <DsKeyValue
          items={[
            { label: "Bác sĩ", value: `${doctorLabel(selected.doctor)} · ${selected.doctor.department.name}` },
            { label: "Lịch khám", value: `${selected.appointment.bookingCode ? `${selected.appointment.bookingCode} · ` : ""}${formatVietnamDate(selected.appointment.appointmentDate)} ${selected.appointment.startTime}` },
            { label: "Gửi lúc", value: formatVietnamDateTime(selected.createdAt) },
          ]}
        />
        <div className="ds-card">
          <div className="ds-card__head">
            <h3>Điểm đánh giá</h3>
            <DsStatusPill tone={ratingTone(selected.rating)}>{formatScore(selected.rating)} / 5</DsStatusPill>
          </div>
          <div className="ds-card__body">
            <DsKeyValue
              items={[
                { label: "Bác sĩ", value: `${selected.doctorRating} / 5` },
                { label: "Dịch vụ", value: `${selected.serviceRating} / 5` },
                { label: "Cơ sở vật chất", value: `${selected.facilityRating} / 5` },
              ]}
            />
          </div>
        </div>
        {selected.comment ? (
          <blockquote style={{ margin: 0, padding: "4px 12px", borderLeft: "2px solid var(--ds-accent)", lineHeight: 1.6 }}>{selected.comment}</blockquote>
        ) : (
          <p className="ds-hint" style={{ margin: 0 }}>
            Người khám không để lại nhận xét.
          </p>
        )}
        {canModerate ? (
          <div>
            <DsButton
              variant={selected.isVisible ? "danger" : "primary"}
              disabled={visibilityMutation.isPending}
              onClick={() => visibilityMutation.mutate(selected)}
            >
              {selected.isVisible ? "Ẩn khỏi trang người dùng" : "Công khai lại"}
            </DsButton>
          </div>
        ) : null}
      </div>
    </DsPane>
  ) : null;

  return (
    <>
      <DsPageHeader title="Đánh giá sau khám" description="Phản hồi đã được người khám xác thực bằng mã dùng một lần" />
      <section aria-label="Điểm trung bình" className="ds-attn-grid" style={{ marginBottom: 16 }}>
        {metrics.map(([label, value]) => (
          <div key={label} className="ds-attn">
            <span className="ds-attn__label">{label}</span>
            <strong className="ds-attn__value ds-num">
              {formatScore(value)} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ds-muted)" }}>/ 5</span>
            </strong>
          </div>
        ))}
      </section>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {errorMessage ? <DsNotice tone="bad">{errorMessage}</DsNotice> : null}
        {visibilityMutation.isSuccess ? <DsNotice tone="good">Đã cập nhật trạng thái hiển thị đánh giá</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={pane} />
    </>
  );
}
