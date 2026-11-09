"use client";

import { useState } from "react";
import { Plus, Printer, Search } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsDrawer,
  DsEmptyState,
  DsField,
  DsInput,
  DsKeyValue,
  DsNotice,
  DsPageHeader,
  DsPanel,
  DsRoot,
  DsSelect,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
  DsToolbarSpacer,
  describedBy,
  type DsColumn,
  type DsTone,
} from "@/components/ds";

// Trang xem thử nền thiết kế mới. Dữ liệu dưới đây chỉ là ví dụ, không phải dữ liệu thật.
type Visit = { id: string; time: string; name: string; code: string; note: string; status: string; tone: DsTone; qty: number };

const visits: Visit[] = [
  { id: "1", time: "09:30", name: "Gu", code: "BK-338497", note: "Da liễu, lần đầu", status: "Đang khám", tone: "info", qty: 1 },
  { id: "2", time: "10:00", name: "Nguyễn Văn A", code: "BK-402118", note: "Tái khám", status: "Chờ khám", tone: "neutral", qty: 3 },
  { id: "3", time: "10:30", name: "Trần Thị B", code: "BK-402145", note: "Có khai báo dị ứng", status: "Dị ứng", tone: "bad", qty: 2 },
  { id: "4", time: "08:30", name: "Lê Văn C", code: "BK-401990", note: "Hồ sơ nháp", status: "Thiếu chẩn đoán", tone: "warn", qty: 0 },
  { id: "5", time: "08:00", name: "Phạm Thị D", code: "BK-401962", note: "Đã công bố", status: "Hoàn tất", tone: "good", qty: 4 },
];

const tabs = [
  { id: "waiting", label: "Chờ khám", count: 3 },
  { id: "active", label: "Đang khám", count: 1 },
  { id: "done", label: "Hoàn tất", count: 2 },
];

const swatches: { name: string; token: string; use: string }[] = [
  { name: "Nền", token: "--ds-bg", use: "nền trang" },
  { name: "Mặt", token: "--ds-surface", use: "khối, bảng" },
  { name: "Chìm", token: "--ds-sunken", use: "tiêu đề bảng, ô tắt" },
  { name: "Chữ", token: "--ds-ink", use: "nội dung" },
  { name: "Chữ phụ", token: "--ds-muted", use: "mô tả, nhãn" },
  { name: "Viền", token: "--ds-line", use: "đường kẻ" },
  { name: "Nhấn", token: "--ds-accent", use: "hành động chính" },
  { name: "Ổn", token: "--ds-good", use: "đã thanh toán, đã cấp" },
  { name: "Chờ", token: "--ds-warn", use: "nháp, chưa thanh toán" },
  { name: "Lỗi", token: "--ds-bad", use: "hủy, thiếu tồn" },
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState("waiting");
  const [selected, setSelected] = useState<Visit | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [phone, setPhone] = useState("09123");
  const phoneError = phone.length < 10 ? "Số điện thoại cần đủ 10 số" : undefined;
  const phoneHint = "Số dùng để đăng nhập";

  const columns: DsColumn<Visit>[] = [
    { key: "time", header: "Giờ", cell: (row) => row.time, mono: true, width: "72px" },
    {
      key: "name",
      header: "Người khám",
      cell: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.note}</div>
        </div>
      ),
    },
    { key: "code", header: "Mã lịch hẹn", cell: (row) => row.code, mono: true },
    { key: "qty", header: "Thuốc", cell: (row) => row.qty, align: "num" },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={row.tone}>{row.status}</DsStatusPill> },
  ];

  return (
    <DsRoot className="rounded-xl p-5">
      <DsPageHeader
        title="Thành phần giao diện"
        description="Nền thiết kế mới của khu quản trị: màu, chữ và các thành phần dùng chung. Dữ liệu trong trang là ví dụ."
        actions={
          <>
            <DsButton>
              <Printer aria-hidden="true" /> In
            </DsButton>
            <DsButton variant="primary">
              <Plus aria-hidden="true" /> Thêm mới
            </DsButton>
          </>
        }
      />

      <div style={{ display: "grid", gap: 20 }}>
        <DsPanel title="Màu (đổi theo chế độ sáng hoặc tối)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            {swatches.map((swatch) => (
              <div key={swatch.token} style={{ display: "grid", gap: 6 }}>
                <span style={{ height: 44, borderRadius: 6, border: "1px solid var(--ds-line)", background: `var(${swatch.token})` }} />
                <strong style={{ fontSize: 13 }}>{swatch.name}</strong>
                <span className="ds-mono" style={{ color: "var(--ds-muted)" }}>
                  {swatch.use}
                </span>
              </div>
            ))}
          </div>
        </DsPanel>

        <DsPanel title="Nút và trạng thái">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <DsButton variant="primary">Lưu hồ sơ</DsButton>
            <DsButton>Hủy</DsButton>
            <DsButton variant="ghost">Bỏ qua</DsButton>
            <DsButton variant="danger">Hoàn tiền</DsButton>
            <DsButton variant="primary" loading>
              Đang lưu
            </DsButton>
            <DsButton disabled>Không khả dụng</DsButton>
            <DsButton variant="primary" size="lg">
              Cỡ lớn
            </DsButton>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <DsStatusPill tone="good">Đã thanh toán</DsStatusPill>
            <DsStatusPill tone="warn">Chưa thanh toán</DsStatusPill>
            <DsStatusPill tone="bad">Đã hoàn tiền</DsStatusPill>
            <DsStatusPill tone="info">Đang khám</DsStatusPill>
            <DsStatusPill>Bản nháp</DsStatusPill>
          </div>
        </DsPanel>

        <DsPanel title="Ô nhập">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <DsField label="Số điện thoại" htmlFor="ds-phone" required error={phoneError} hint={phoneHint}>
              <DsInput
                id="ds-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={describedBy("ds-phone", { error: phoneError, hint: phoneHint })}
              />
            </DsField>
            <DsField label="Chuyên khoa" htmlFor="ds-dept" hint="Chọn một chuyên khoa">
              <DsSelect id="ds-dept" defaultValue="da-lieu" aria-describedby="ds-dept-hint">
                <option value="da-lieu">Da liễu</option>
                <option value="tim-mach">Tim mạch</option>
                <option value="tai-mui-hong">Tai mũi họng</option>
              </DsSelect>
            </DsField>
            <DsField label="Ô bị khóa" htmlFor="ds-locked">
              <DsInput id="ds-locked" value="Chỉ đọc" readOnly disabled />
            </DsField>
            <DsField label="Ghi chú" htmlFor="ds-note" className="" hint="Tối đa 500 ký tự">
              <DsTextarea id="ds-note" placeholder="Lời dặn cho người khám" aria-describedby="ds-note-hint" />
            </DsField>
          </div>
        </DsPanel>

        <DsPanel flush>
          <DsToolbar>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
              <Search aria-hidden="true" style={{ position: "absolute", left: 10, top: 10, width: 16, height: 16, color: "var(--ds-muted)" }} />
              <DsInput aria-label="Tìm người khám" placeholder="Tìm người khám, mã lịch hẹn" style={{ paddingLeft: 32 }} />
            </div>
            <DsButton onClick={() => setLoading((value) => !value)}>{loading ? "Tắt trạng thái tải" : "Xem trạng thái tải"}</DsButton>
            <DsButton onClick={() => setEmpty((value) => !value)}>{empty ? "Có dữ liệu" : "Xem trạng thái rỗng"}</DsButton>
            <DsToolbarSpacer />
            <span style={{ color: "var(--ds-muted)", fontSize: 12 }}>Bấm một hàng để mở ngăn bên</span>
          </DsToolbar>
          <DsTabs label="Trạng thái ca khám" items={tabs} value={tab} onChange={setTab} className="" />
          <DsDataTable
            caption="Danh sách ca khám ví dụ"
            columns={columns}
            rows={empty ? [] : visits}
            rowKey={(row) => row.id}
            loading={loading}
            emptyTitle="Chưa có ca khám nào"
            emptyDescription="Ca khám sẽ hiện ở đây khi có lịch hẹn mới trong ngày."
            selectedKey={selected?.id ?? null}
            onRowClick={(row) => {
              setSelected(row);
              setDrawerOpen(true);
            }}
          />
        </DsPanel>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <DsNotice tone="info">Thông tin: hồ sơ đã được lưu nháp.</DsNotice>
          <DsNotice tone="good">Đã cấp thuốc và trừ kho.</DsNotice>
          <DsNotice tone="warn">Đơn có khai báo dị ứng, hãy kiểm tra trước khi cấp.</DsNotice>
          <DsNotice tone="bad">Không đủ tồn kho: Paracetamol.</DsNotice>
        </div>

        <DsPanel title="Trạng thái rỗng">
          <DsEmptyState
            title="Chưa có đơn chờ cấp"
            description="Khi bác sĩ phát hành đơn thuốc mới, đơn sẽ hiện ở đây."
            action={<DsButton variant="primary">Làm mới</DsButton>}
          />
        </DsPanel>
      </div>

      <DsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selected ? `${selected.name} · ${selected.time}` : "Chi tiết"}
        description="Chi tiết ca khám đang chọn"
        footer={
          <>
            <DsButton onClick={() => setDrawerOpen(false)}>Đóng</DsButton>
            <DsButton variant="primary">Tiếp tục hồ sơ</DsButton>
          </>
        }
      >
        {selected ? (
          <DsKeyValue
            items={[
              { label: "Mã lịch hẹn", value: <span className="ds-mono">{selected.code}</span> },
              { label: "Ghi chú", value: selected.note },
              { label: "Số thuốc", value: selected.qty },
              { label: "Trạng thái", value: <DsStatusPill tone={selected.tone}>{selected.status}</DsStatusPill> },
            ]}
          />
        ) : null}
      </DsDrawer>
    </DsRoot>
  );
}
