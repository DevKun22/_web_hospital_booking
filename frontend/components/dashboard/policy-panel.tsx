"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DsButton, DsField, DsInput, DsNotice, DsPanel } from "@/components/ds";
import { apiRequest } from "@/lib/api";

type PolicyKey = "bookingHoldMinutes" | "reminderLeadMinutes" | "patientCancelCutoffHours" | "noShowGraceMinutes";

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

// Tham số chính sách đặt lịch: sửa rồi bấm Lưu; Mặc định (có xác nhận ngay tại chỗ) đưa về giá trị gốc.
export function PolicyPanel() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({ queryKey, queryFn: () => apiRequest<PolicyData>("/dashboard/policy"), staleTime: 0 });
  // Chỉ giữ giá trị người dùng đã gõ; ô chưa sửa hiển thị giá trị từ máy chủ.
  const [edits, setEdits] = useState<Partial<Record<PolicyKey, string>>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const data = policyQuery.data;
  const dirty = useMemo(() => (data ? fields.filter(({ key }) => edits[key] !== undefined && Number(edits[key]) !== data.policy[key]) : []), [data, edits]);

  const onDone = (next: PolicyData) => {
    setEdits({});
    setConfirmReset(false);
    queryClient.setQueryData(queryKey, next);
  };
  const saveMutation = useMutation({
    mutationFn: () => apiRequest<PolicyData>("/dashboard/policy", { method: "PUT", body: Object.fromEntries(dirty.map(({ key }) => [key, Number(edits[key])])) }),
    onSuccess: onDone,
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest<PolicyData>("/dashboard/policy", { method: "DELETE" }),
    onSuccess: onDone,
  });

  const error = [saveMutation.error, resetMutation.error].find((item) => item instanceof Error) as Error | undefined;
  const notice = saveMutation.isSuccess ? "Đã lưu chính sách" : resetMutation.isSuccess ? "Đã khôi phục chính sách mặc định" : undefined;

  return (
    <DsPanel
      title="Tham số chính sách đặt lịch"
      actions={
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {confirmReset ? (
            <>
              <span style={{ fontSize: 13 }}>Khôi phục chính sách về mặc định?</span>
              <DsButton variant="danger" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
                Khôi phục
              </DsButton>
              <DsButton onClick={() => setConfirmReset(false)}>Giữ lại</DsButton>
            </>
          ) : (
            <>
              <DsButton disabled={resetMutation.isPending} onClick={() => setConfirmReset(true)}>
                Mặc định
              </DsButton>
              <DsButton variant="primary" disabled={dirty.length === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Lưu{dirty.length ? ` (${dirty.length})` : ""}
              </DsButton>
            </>
          )}
        </span>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <p className="ds-hint" style={{ margin: 0 }}>
          Áp dụng cho lịch hẹn mới và các lần xử lý tiếp theo.
        </p>
        {error ? <DsNotice tone="bad">{error.message}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
        {policyQuery.isLoading ? <p className="ds-hint">Đang tải chính sách...</p> : null}
        {policyQuery.error ? <DsNotice tone="bad">{policyQuery.error instanceof Error ? policyQuery.error.message : "Không tải được chính sách"}</DsNotice> : null}
        {data ? (
          <div className="ds-grid-fields">
            {fields.map(({ key, label, hint, unit }) => (
              <DsField key={key} label={label} htmlFor={`policy-${key}`} hint={`${hint} ${unit}. Cho phép ${data.limits[key].min}–${data.limits[key].max}.`}>
                <DsInput
                  id={`policy-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={data.limits[key].min}
                  max={data.limits[key].max}
                  value={edits[key] ?? String(data.policy[key])}
                  onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))}
                />
              </DsField>
            ))}
          </div>
        ) : null}
      </div>
    </DsPanel>
  );
}
