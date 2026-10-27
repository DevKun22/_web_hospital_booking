"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MessageSquareText, RefreshCw, Star } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import {
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardStatusBadge,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";

type ReviewItem = {
  id: string;
  rating: number;
  doctorRating: number;
  serviceRating: number;
  facilityRating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  appointment: {
    bookingCode?: string;
    patientName?: string;
    appointmentDate: string;
    startTime: string;
  };
  doctor: {
    title: string | null;
    user: { fullName: string };
    department: { name: string };
  };
};

type ReviewDashboardData = {
  items: ReviewItem[];
  metrics: {
    total: number;
    averageRating: number;
    averageDoctorRating: number;
    averageServiceRating: number;
    averageFacilityRating: number;
  };
  pagination: { total: number };
};

const formatScore = (value: number) => (value ? value.toFixed(1) : "-");

export default function DashboardReviewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reviewsQuery = useQuery({
    queryKey: ["dashboard", "reviews"],
    queryFn: () =>
      apiRequest<ReviewDashboardData>("/dashboard/reviews", {
        query: { limit: 50 },
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const data = reviewsQuery.data;
  const canModerate = user?.role === "ADMIN" || user?.role === "STAFF";
  const visibilityMutation = useMutation({
    mutationFn: (review: ReviewItem) =>
      apiRequest(`/dashboard/reviews/${review.id}/visibility`, {
        method: "PATCH",
        body: { isVisible: !review.isVisible },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "reviews"] });
    },
  });

  return (
    <div className="space-y-6">
      <DashboardFeedback
        error={visibilityMutation.error instanceof Error ? visibilityMutation.error.message : undefined}
        notice={visibilityMutation.isSuccess ? "Đã cập nhật trạng thái hiển thị đánh giá" : undefined}
        onDismiss={() => visibilityMutation.reset()}
      />
      <DashboardPageHeader
        eyebrow="Chất lượng phục vụ"
        title="Đánh giá sau khám"
        description="Tổng hợp phản hồi đã được người bệnh xác thực bằng mã dùng một lần."
        actions={<button
          type="button"
          onClick={() => void reviewsQuery.refetch()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)]"
        >
          <RefreshCw
            className={`h-4 w-4 ${reviewsQuery.isFetching ? "animate-spin" : ""}`}
          />{" "}
          Làm mới
        </button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Điểm trung bình", data?.metrics.averageRating || 0, Star],
          ["Bác sĩ", data?.metrics.averageDoctorRating || 0, Star],
          [
            "Dịch vụ",
            data?.metrics.averageServiceRating || 0,
            MessageSquareText,
          ],
          [
            "Cơ sở vật chất",
            data?.metrics.averageFacilityRating || 0,
            BarChart3,
          ],
        ].map(([label, value, Icon]) => {
          const IconComponent = Icon as typeof Star;
          return (
            <DashboardSurface
              key={label as string}
              className="p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-muted)]">
                  {label as string}
                </p>
                <IconComponent className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {formatScore(value as number)}{" "}
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  / 5
                </span>
              </p>
            </DashboardSurface>
          );
        })}
      </section>

      <DashboardSurface className="overflow-hidden">
        <div className="border-b border-[var(--border-soft)] px-5 py-4">
          <h2 className="font-semibold">Phản hồi gần đây</h2>
        </div>
        {reviewsQuery.isLoading ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">
            Đang tải đánh giá...
          </p>
        ) : null}
        {reviewsQuery.error ? (
          <p className="m-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {reviewsQuery.error instanceof Error
              ? reviewsQuery.error.message
              : "Không tải được đánh giá"}
          </p>
        ) : null}
        {!reviewsQuery.isLoading &&
        !reviewsQuery.error &&
        !data?.items.length ? (
          <div className="p-5"><DashboardEmptyState title="Chưa có phản hồi" description="Đánh giá đã xác thực sẽ xuất hiện tại đây." /></div>
        ) : null}
        <div className="divide-y divide-[var(--border-soft)]">
          {data?.items.map((review) => (
            <article key={review.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {review.appointment.patientName ? (
                      <>
                        {review.appointment.patientName}{" "}
                        <span className="font-normal text-[var(--text-muted)]">
                          · {review.appointment.bookingCode}
                        </span>
                      </>
                    ) : (
                      "Phản hồi ẩn danh"
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {review.doctor.title ? `${review.doctor.title} ` : ""}
                    {review.doctor.user.fullName} ·{" "}
                    {review.doctor.department.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--primary-soft)] px-2.5 py-1 text-sm font-semibold text-[var(--primary)]">
                    <Star className="h-4 w-4 fill-current" />{" "}
                    {formatScore(review.rating)}
                  </span>
                  {canModerate ? (
                    <button
                      type="button"
                      onClick={() => visibilityMutation.mutate(review)}
                      disabled={visibilityMutation.isPending && visibilityMutation.variables?.id === review.id}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${review.isVisible ? "border-[#f2b8b5] text-[#b3261e] hover:bg-[#fff3f2]" : "border-[#bde5c8] text-[#1f7a3a] hover:bg-[#f0fff4]"}`}
                    >
                      {review.isVisible ? "Ẩn khỏi trang người dùng" : "Công khai"}
                    </button>
                  ) : (
                    <DashboardStatusBadge tone={review.isVisible ? "positive" : "warning"}>
                      {review.isVisible ? "Đã công khai" : "Chờ duyệt"}
                    </DashboardStatusBadge>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--text-soft)]">
                <span>Bác sĩ: {review.doctorRating}/5</span>
                <span>Dịch vụ: {review.serviceRating}/5</span>
                <span>Cơ sở vật chất: {review.facilityRating}/5</span>
                <span>{formatVietnamDateTime(review.createdAt)}</span>
              </div>
              {review.comment ? (
                <p className="mt-3 border-l-2 border-[var(--primary)] pl-3 text-sm leading-6 text-[var(--text-soft)]">
                  {review.comment}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </DashboardSurface>
    </div>
  );
}
