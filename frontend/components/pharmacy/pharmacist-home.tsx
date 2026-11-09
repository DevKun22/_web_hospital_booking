"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DsButton, DsEmptyState, DsNotice, DsPageHeader, DsPanel, DsStatusPill } from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatVietnamDateTime } from "@/lib/date";
import { can } from "@/lib/permissions";

// Trang chủ của dược sĩ: đơn đang chờ cấp và thuốc sắp hết, mỗi mục bấm vào là tới đúng nơi xử lý.

type QueueItem = {
  id: string;
  prescriptionCode: string;
  issuedAt: string | null;
  patient: { fullName: string };
  appointment: { allergies: string | null };
  items: { id: string }[];
};

type LowMedicine = { id: string; code: string; name: string; strength: string | null; unit: string; stockQuantity: number; minStock: number };

type Paged<T> = { items: T[]; pagination: { total: number } };

export function PharmacistHome() {
  const { user } = useAuth();
  const canMedicines = can(user, "pharmacy.view");

  const queue = useQuery({
    queryKey: ["dashboard", "pharmacy", "home-queue"],
    queryFn: () => apiRequest<Paged<QueueItem>>("/dashboard/pharmacy/prescriptions", { query: { dispenseStatus: "NOT_DISPENSED", limit: 8 } }),
    refetchInterval: 30_000,
  });
  const low = useQuery({
    queryKey: ["dashboard", "pharmacy", "home-low-stock"],
    queryFn: () => apiRequest<Paged<LowMedicine>>("/dashboard/pharmacy/medicines", { query: { isActive: "true", lowStock: "true", limit: 8 } }),
    enabled: canMedicines,
    refetchInterval: 60_000,
  });

  const waiting = queue.data?.items ?? [];
  const waitingTotal = queue.data?.pagination.total ?? 0;
  const withAllergy = waiting.filter((item) => item.appointment.allergies).length;
  const lowItems = low.data?.items ?? [];
  const lowTotal = low.data?.pagination.total ?? 0;
  const error = queue.error || low.error;

  return (
    <>
      <DsPageHeader
        title="Việc của tôi"
        description="Đơn chờ cấp và thuốc sắp hết trong kho"
        actions={
          <DsButton
            onClick={() => {
              void queue.refetch();
              void low.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className={queue.isFetching || low.isFetching ? "animate-spin" : undefined} />
            Làm mới
          </DsButton>
        }
      />

      <div style={{ display: "grid", gap: 16 }}>
        {error ? <DsNotice tone="bad">{error instanceof Error ? error.message : "Không tải được dữ liệu"}</DsNotice> : null}

        <section aria-label="Cần xử lý" className="ds-attn-grid">
          <Link href="/dashboard/pharmacy" className={`ds-attn${waitingTotal > 0 ? " is-warn" : ""}`}>
            <span className="ds-attn__label">Đơn chờ cấp</span>
            <strong className="ds-attn__value ds-num">{queue.isLoading ? "…" : waitingTotal}</strong>
          </Link>
          <Link href="/dashboard/pharmacy" className={`ds-attn${withAllergy > 0 ? " is-warn" : ""}`}>
            <span className="ds-attn__label">Đơn có khai báo dị ứng</span>
            <strong className="ds-attn__value ds-num">{queue.isLoading ? "…" : withAllergy}</strong>
          </Link>
          {canMedicines ? (
            <Link href="/dashboard/medicines" className={`ds-attn${lowTotal > 0 ? " is-warn" : ""}`}>
              <span className="ds-attn__label">Thuốc sắp hết</span>
              <strong className="ds-attn__value ds-num">{low.isLoading ? "…" : lowTotal}</strong>
            </Link>
          ) : null}
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
          <DsPanel
            title="Đơn chờ cấp"
            flush
            actions={
              <Link href="/dashboard/pharmacy" className="ds-link">
                Mở hàng đợi
              </Link>
            }
          >
            {waiting.length === 0 && !queue.isLoading ? (
              <DsEmptyState title="Không có đơn chờ cấp" description="Đơn xuất hiện ở đây sau khi bác sĩ phát hành." />
            ) : null}
            {waiting.map((item) => (
              <Link key={item.id} href="/dashboard/pharmacy" className="ds-todo" style={{ color: "inherit", textDecoration: "none" }}>
                <span className={`ds-todo__dot${item.appointment.allergies ? " is-warn" : ""}`} aria-hidden="true" />
                <div className="ds-todo__text">
                  <strong>{item.patient.fullName}</strong>
                  <small>
                    {item.prescriptionCode} · {item.items.length} dòng · {item.issuedAt ? formatVietnamDateTime(item.issuedAt) : "—"}
                  </small>
                </div>
                {item.appointment.allergies ? <DsStatusPill tone="warn">Dị ứng</DsStatusPill> : null}
              </Link>
            ))}
          </DsPanel>

          {canMedicines ? (
            <DsPanel
              title="Thuốc sắp hết"
              flush
              actions={
                <Link href="/dashboard/medicines" className="ds-link">
                  Mở kho thuốc
                </Link>
              }
            >
              {lowItems.length === 0 && !low.isLoading ? <DsEmptyState title="Chưa có thuốc sắp hết" description="Tồn kho đang trên mức tối thiểu." /> : null}
              {lowItems.map((item) => (
                <Link key={item.id} href="/dashboard/medicines" className="ds-todo" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="ds-todo__dot is-warn" aria-hidden="true" />
                  <div className="ds-todo__text">
                    <strong>
                      {item.name} {item.strength || ""}
                    </strong>
                    <small>
                      {item.code} · tối thiểu {item.minStock}
                    </small>
                  </div>
                  <DsStatusPill tone="bad">
                    {item.stockQuantity} {item.unit}
                  </DsStatusPill>
                </Link>
              ))}
            </DsPanel>
          ) : null}
        </div>
      </div>
    </>
  );
}
