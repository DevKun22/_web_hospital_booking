"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardSurface } from "@/components/dashboard/dashboard-ui";
import { apiRequest } from "@/lib/api";

type PolicyKey =
  | "bookingHoldMinutes"
  | "reminderLeadMinutes"
  | "patientCancelCutoffHours"
  | "noShowGraceMinutes";

type PolicyData = {
  policy: Record<PolicyKey, number>;
  limits: Record<PolicyKey, { min: number; max: number }>;
};

const fields: { key: PolicyKey; label: string; hint: string; unit: string }[] = [
  { key: "bookingHoldMinutes", label: "Giữ chỗ chờ xác thực OTP", hint: "Hết hạn thì khung giờ được trả lại.", unit: "phút" },
  { key: "reminderLeadMinutes", label: "Nhắc lịch trước giờ khám", hint: "Thời điểm gửi thông báo nhắc.", unit: "phút" },
  { key: "patientCancelCutoffHours", label: "Hạn chót người khám tự hủy", hint: "0 = cho hủy đến sát giờ khám.", unit: "giờ trước giờ khám" },
  { key: "noShowGraceMinutes", label: "Tự đánh dấu vắng mặt sau", hint: "0 = tắt; lễ tân vẫn đánh dấu thủ công.", unit: "phút sau giờ hẹn" },
];

const queryKey = ["dashboard", "policy"];

export function PolicyPanel() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest<PolicyData>("/dashboard/policy"),
    staleTime: 0,
  });
  // Chỉ giữ giá trị người dùng đã gõ; ô chưa sửa hiển thị giá trị từ máy chủ.
  const [edits, setEdits] = useState<Partial<Record<PolicyKey, string>>>({});

  const data = policyQuery.data;
  const dirty = useMemo(
    () =>
      data
        ? fields.filter(
            ({ key }) => edits[key] !== undefined && Number(edits[key]) !== data.policy[key],
          )
        : [],
    [data, edits],
  );

  const onDone = (next: PolicyData) => {
    setEdits({});
    queryClient.setQueryData(queryKey, next);
  };
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest<PolicyData>("/dashboard/policy", {
        method: "PUT",
        body: Object.fromEntries(dirty.map(({ key }) => [key, Number(edits[key])])),
      }),
    onSuccess: onDone,
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest<PolicyData>("/dashboard/policy", { method: "DELETE" }),
    onSuccess: onDone,
  });

  const error = [saveMutation.error, resetMutation.error].find(
    (item) => item instanceof Error,
  ) as Error | undefined;
  const notice = saveMutation.isSuccess
    ? "Đã lưu chính sách"
    : resetMutation.isSuccess
      ? "Đã khôi phục chính sách mặc định"
      : undefined;

  return (
    <DashboardSurface className="p-5">
      <DashboardFeedback
        error={error?.message}
        notice={notice}
        onDismiss={() => {
          saveMutation.reset();
          resetMutation.reset();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tham số chính sách đặt lịch</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Áp dụng cho lịch hẹn mới và các lần xử lý tiếp theo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={resetMutation.isPending}
            onClick={() => {
              if (window.confirm("Khôi phục chính sách về mặc định?")) resetMutation.mutate();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Mặc định
          </button>
          <button
            type="button"
            disabled={dirty.length === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Lưu
          </button>
        </div>
      </div>

      {policyQuery.isLoading ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Đang tải chính sách...</p>
      ) : null}
      {policyQuery.error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {policyQuery.error instanceof Error ? policyQuery.error.message : "Không tải được chính sách"}
        </p>
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {fields.map(({ key, label, hint, unit }) => (
            <label key={key} className="block">
              <span className="text-sm font-medium">{label}</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={data.limits[key].min}
                  max={data.limits[key].max}
                  value={edits[key] ?? String(data.policy[key])}
                  onChange={(event) =>
                    setEdits((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="w-28 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                />
                <span className="text-sm text-[var(--text-muted)]">{unit}</span>
              </div>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                {hint} Cho phép {data.limits[key].min}–{data.limits[key].max}.
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </DashboardSurface>
  );
}
