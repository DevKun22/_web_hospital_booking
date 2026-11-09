"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  DsButton,
  DsDataTable,
  DsEmptyState,
  DsField,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsToolbar,
  type DsColumn,
} from "@/components/ds";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardUsers } from "@/lib/dashboard-users-query";
import { can } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardRole, DashboardUser } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// Nhân sự: danh sách bên trái; chọn một tài khoản hoặc bấm "Tạo tài khoản" thì khung bên phải mở cạnh danh sách.
// Một khung dùng cho tạo, sửa, khóa hoặc mở khóa và đặt mật khẩu tạm.

type UserForm = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: DashboardRole;
  avatar: string;
  avatarAssetId: string;
  isActive: boolean;
};

const emptyForm: UserForm = { fullName: "", email: "", phone: "", password: "", role: "STAFF", avatar: "", avatarAssetId: "", isActive: true };

const roleOptions: { value: DashboardRole; label: string }[] = [
  { value: "ADMIN", label: "Quản trị" },
  { value: "STAFF", label: "Nhân viên" },
  { value: "DOCTOR", label: "Bác sĩ" },
  { value: "PHARMACIST", label: "Dược sĩ" },
];

const roleLabel: Record<DashboardRole, string> = { ADMIN: "Quản trị", STAFF: "Nhân viên", DOCTOR: "Bác sĩ", PHARMACIST: "Dược sĩ" };

const statusTabs = [
  { id: "", label: "Tất cả" },
  { id: "true", label: "Đang hoạt động" },
  { id: "false", label: "Đã khóa" },
];

const toForm = (user: DashboardUser): UserForm => ({
  fullName: user.fullName,
  email: user.email || "",
  phone: user.phone || "",
  password: "",
  role: user.role,
  avatar: user.avatar || "",
  avatarAssetId: "",
  isActive: user.isActive ?? true,
});

const buildCreatePayload = (form: UserForm) => ({
  fullName: form.fullName.trim(),
  email: form.email.trim() || undefined,
  phone: form.phone.trim(),
  password: form.password,
  role: form.role,
  avatar: form.avatar.trim() || undefined,
  avatarAssetId: form.avatarAssetId || undefined,
  isActive: form.isActive,
});

const buildUpdatePayload = (form: UserForm) => ({
  fullName: form.fullName.trim(),
  email: form.email.trim() || null,
  phone: form.phone.trim(),
  role: form.role,
  avatar: form.avatar.trim() || null,
  avatarAssetId: form.avatarAssetId || undefined,
  isActive: form.isActive,
});

function Avatar({ person }: { person: DashboardUser }) {
  return person.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.avatar} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flex: "none" }} />
  ) : (
    <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 6, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--ds-sunken)", color: "var(--ds-accent)", fontWeight: 600 }}>
      {person.fullName.slice(0, 1).toUpperCase()}
    </span>
  );
}

type PaneState = { kind: "new" } | { kind: "edit"; id: string } | { kind: "password"; id: string } | null;

export default function UsersPage() {
  const { user, refreshUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pane, setPane] = useState<PaneState>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canUse = can(user, "user.manage");

  // Gõ đến đâu lọc đến đó (chờ ngừng gõ một chút rồi mới gọi máy chủ).
  const term = useDebouncedValue(search.trim());
  const query = useMemo(() => ({ search: term || undefined, role: role || undefined, isActive: isActive || undefined, page, limit: 20 }), [isActive, page, role, term]);
  const usersQuery = useDashboardUsers(query, canUse);
  const users = usersQuery.data?.items ?? [];
  const pagination = usersQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };
  const queryError = usersQuery.error instanceof Error ? usersQuery.error.message : usersQuery.error ? "Không tải được danh sách nhân sự" : "";
  const target = pane && pane.kind !== "new" ? users.find((item) => item.id === pane.id) ?? null : null;
  const open = pane?.kind === "new" || Boolean(target);
  const isEditingSelf = Boolean(target && target.id === user?.id);

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "users"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardOverview }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", "statistics"] }),
    ]);
  };

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const closePane = () => {
    setPane(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const startCreate = () => {
    setForm(emptyForm);
    setError("");
    setNotice("");
    setPane({ kind: "new" });
  };

  const startEdit = (item: DashboardUser) => {
    setForm(toForm(item));
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
    setPane({ kind: "edit", id: item.id });
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const [asset] = await uploadImages([file], "users");
      if (!asset) throw new Error("Đã tải ảnh nhưng không nhận được đường dẫn ảnh đại diện");
      setForm((current) => ({ ...current, avatar: asset.url, avatarAssetId: asset.id }));
      setNotice("Đã tải ảnh đại diện lên. Bấm Lưu để áp dụng.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh đại diện lên");
    } finally {
      setUploading(false);
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUse) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (pane?.kind === "edit" && target) {
        const updatedUser = await apiRequest<DashboardUser>(`/dashboard/users/${target.id}`, { method: "PATCH", body: buildUpdatePayload(form) });
        const roleChanged = target.role !== updatedUser.role;
        setNotice(roleChanged ? `Đã đổi vai trò ${updatedUser.fullName} từ ${roleLabel[target.role]} sang ${roleLabel[updatedUser.role]}` : "Đã cập nhật nhân sự");
        if (target.id === user?.id) {
          const currentUser = await refreshUser();
          if (updatedUser.role !== "ADMIN" || currentUser?.role !== "ADMIN") {
            window.location.href = "/dashboard";
            return;
          }
        }
      } else {
        await apiRequest<DashboardUser>("/dashboard/users", { method: "POST", body: buildCreatePayload(form) });
        setNotice("Đã tạo tài khoản nhân sự");
        closePane();
      }
      await invalidateUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được nhân sự");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: DashboardUser) => {
    if (!canUse) return;
    if (item.id === user?.id) {
      setError("Bạn không thể tự khóa tài khoản đang đăng nhập. Hãy dùng một quản trị viên khác nếu cần vô hiệu hóa tài khoản này.");
      setNotice("");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiRequest<DashboardUser>(`/dashboard/users/${item.id}/status`, { method: "PATCH", body: { isActive: !(item.isActive ?? true) } });
      setNotice((item.isActive ?? true) ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
      await invalidateUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    }
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || !canUse) return;

    if (newPassword.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu chưa khớp");
      return;
    }

    setError("");
    setNotice("");
    try {
      await apiRequest<DashboardUser>(`/dashboard/users/${target.id}/password`, { method: "PATCH", body: { password: newPassword } });
      const shouldLogout = target.id === user?.id;
      setNewPassword("");
      setConfirmPassword("");
      if (shouldLogout) {
        setNotice("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        await logout();
        return;
      }
      setPane({ kind: "edit", id: target.id });
      await invalidateUsers();
      setNotice("Đã cập nhật mật khẩu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được mật khẩu");
    }
  };

  if (!canUse) {
    return (
      <>
        <DsPageHeader title="Nhân sự" description="Phân hệ nhân sự chỉ dành cho tài khoản được cấp quyền quản lý tài khoản" />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền quản lý nhân sự.</DsNotice>
      </>
    );
  }

  const columns: DsColumn<DashboardUser>[] = [
    {
      key: "person",
      header: "Nhân sự",
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar person={row} />
          <strong>{row.fullName}</strong>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div>
          {row.phone || "-"}
          <div style={{ color: "var(--ds-muted)", fontSize: 12 }}>{row.email || "-"}</div>
        </div>
      ),
    },
    { key: "role", header: "Vai trò", cell: (row) => roleLabel[row.role] },
    { key: "status", header: "Trạng thái", cell: (row) => <DsStatusPill tone={(row.isActive ?? true) ? "good" : "neutral"}>{(row.isActive ?? true) ? "Hoạt động" : "Đã khóa"}</DsStatusPill> },
  ];

  const list = (
    <DsPanel flush>
      <form onSubmit={(event) => event.preventDefault()} aria-label="Lọc nhân sự">
        <DsToolbar>
          <div style={{ minWidth: 180, flex: "1 1 240px" }}>
            <DsInput
              aria-label="Tìm nhân sự"
              value={search}
              placeholder="Gõ tên, SĐT hoặc email để lọc"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div style={{ minWidth: 130, flex: "0 1 170px" }}>
            <DsSelect
              aria-label="Lọc theo vai trò"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Mọi vai trò</option>
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </DsSelect>
          </div>
          <DsButton variant="primary" onClick={startCreate}>
            <Plus aria-hidden="true" />
            Tạo tài khoản
          </DsButton>
        </DsToolbar>
      </form>
      <DsTabs
        label="Lọc nhân sự theo trạng thái"
        items={statusTabs}
        value={isActive}
        onChange={(id) => {
          setIsActive(id);
          setPage(1);
        }}
      />
      {open ? (
        users.length ? (
          <div role="listbox" aria-label="Danh sách nhân sự">
            {users.map((item) => (
              <button key={item.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind !== "new" && pane?.id === item.id} onClick={() => startEdit(item)}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <Avatar person={item} />
                  <span className="ds-listrow__main">
                    <strong>{item.fullName}</strong>
                    <small>
                      {roleLabel[item.role]} · {item.phone || item.email || "-"}
                    </small>
                  </span>
                </span>
                <DsStatusPill tone={(item.isActive ?? true) ? "good" : "neutral"}>{(item.isActive ?? true) ? "Hoạt động" : "Đã khóa"}</DsStatusPill>
              </button>
            ))}
          </div>
        ) : (
          <DsEmptyState title="Chưa có nhân sự phù hợp" />
        )
      ) : (
        <DsDataTable caption="Danh sách tài khoản nhân sự" columns={columns} rows={users} rowKey={(row) => row.id} loading={usersQuery.isLoading} emptyTitle="Chưa có nhân sự phù hợp" onRowClick={startEdit} />
      )}
      <div className="ds-pager">
        <span>
          {pagination.total} tài khoản · trang {pagination.page}/{pagination.totalPages || 1}
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

  const passwordPane =
    pane?.kind === "password" && target ? (
      <DsPane title={`Đổi mật khẩu · ${target.fullName}`} onClose={closePane}>
        <form onSubmit={updatePassword} style={{ display: "grid", gap: 12 }} aria-label="Đổi mật khẩu">
          <DsNotice tone="info">
            Thiết lập mật khẩu tạm cho {target.fullName}. Người này phải tự đổi mật khẩu khi đăng nhập lại, mọi phiên đang mở sẽ bị đăng xuất và thao tác được ghi vào nhật ký truy cập.
          </DsNotice>
          <DsField label="Mật khẩu mới" htmlFor="pw-new" required hint="Tối thiểu 6 ký tự">
            <DsInput id="pw-new" type="password" autoComplete="new-password" value={newPassword} required onChange={(event) => setNewPassword(event.target.value)} />
          </DsField>
          <DsField label="Xác nhận mật khẩu" htmlFor="pw-confirm" required>
            <DsInput id="pw-confirm" type="password" autoComplete="new-password" value={confirmPassword} required onChange={(event) => setConfirmPassword(event.target.value)} />
          </DsField>
          {confirmPassword && newPassword !== confirmPassword ? <DsNotice tone="warn">Xác nhận mật khẩu chưa khớp.</DsNotice> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DsButton onClick={() => setPane({ kind: "edit", id: target.id })}>Quay lại</DsButton>
            <DsButton type="submit" variant="primary" disabled={newPassword.length < 6 || newPassword !== confirmPassword}>
              Cập nhật mật khẩu
            </DsButton>
          </div>
        </form>
      </DsPane>
    ) : null;

  const formPane =
    pane?.kind === "new" || (pane?.kind === "edit" && target) ? (
      <DsPane
        title={target ? target.fullName : "Tạo tài khoản nhân sự"}
        badge={target ? <DsStatusPill tone={(target.isActive ?? true) ? "good" : "neutral"}>{(target.isActive ?? true) ? "Hoạt động" : "Đã khóa"}</DsStatusPill> : undefined}
        onClose={closePane}
      >
        <form onSubmit={saveUser} style={{ display: "grid", gap: 12 }} aria-label={target ? "Cập nhật nhân sự" : "Tạo tài khoản"}>
          <DsField label="Họ tên" htmlFor="us-name" required>
            <DsInput id="us-name" value={form.fullName} required onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Số điện thoại" htmlFor="us-phone" required>
              <DsInput id="us-phone" value={form.phone} placeholder="0901234567" required onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </DsField>
            <DsField label="Vai trò" htmlFor="us-role" hint={isEditingSelf ? "Không đổi được vai trò của chính mình" : undefined}>
              <DsSelect id="us-role" value={form.role} disabled={isEditingSelf} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as DashboardRole }))}>
                {roleOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </DsSelect>
            </DsField>
          </div>
          <DsField label="Email" htmlFor="us-email">
            <DsInput id="us-email" type="email" value={form.email} placeholder="email@example.com" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </DsField>
          {!target ? (
            <DsField label="Mật khẩu" htmlFor="us-password" required hint="Tối thiểu 6 ký tự">
              <DsInput id="us-password" type="password" autoComplete="new-password" value={form.password} required onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </DsField>
          ) : null}

          <div className="ds-card">
            <div className="ds-card__head">
              <h3>Ảnh đại diện</h3>
            </div>
            <div className="ds-card__body">
              {form.avatar ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.avatar} alt="Xem trước ảnh đại diện" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover" }} />
                  <DsButton variant="ghost" onClick={() => setForm((current) => ({ ...current, avatar: "", avatarAssetId: "" }))}>
                    Gỡ ảnh
                  </DsButton>
                </div>
              ) : null}
              <div
                className={`ds-drop${dragOver ? " is-over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void uploadAvatar(event.dataTransfer.files?.[0]);
                }}
              >
                {uploading ? (
                  "Đang tải ảnh lên..."
                ) : (
                  <>
                    Kéo thả ảnh vào đây hoặc <label htmlFor="us-avatar-file">chọn từ máy</label>
                    <input
                      id="us-avatar-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        void uploadAvatar(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <div className="ds-hint" style={{ marginTop: 4 }}>
                      JPG, PNG hoặc WEBP
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <label className="ds-check" style={{ cursor: isEditingSelf ? "default" : "pointer" }}>
            <input type="checkbox" checked={form.isActive} disabled={isEditingSelf} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} style={{ marginTop: 3 }} />
            <span>
              <strong>Đang hoạt động</strong>
              <small style={{ display: "block", color: "var(--ds-muted)" }}>Tài khoản bị khóa không đăng nhập được.</small>
            </span>
          </label>
          {isEditingSelf ? <DsNotice tone="info">Đây là tài khoản đang đăng nhập. Bạn có thể cập nhật thông tin cơ bản hoặc đổi mật khẩu, nhưng không tự đổi vai trò hay khóa tài khoản.</DsNotice> : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {target ? (
              <>
                <DsButton
                  onClick={() => {
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                    setPane({ kind: "password", id: target.id });
                  }}
                >
                  Đổi mật khẩu
                </DsButton>
                <DsButton disabled={isEditingSelf} title={isEditingSelf ? "Không thể tự khóa tài khoản đang đăng nhập" : undefined} onClick={() => void toggleStatus(target)}>
                  {(target.isActive ?? true) ? "Khóa tài khoản" : "Mở khóa"}
                </DsButton>
              </>
            ) : null}
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton type="submit" variant="primary" disabled={saving || uploading || !form.fullName.trim() || !form.phone.trim() || (!target && form.password.length < 6)}>
              {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : target ? "Lưu thay đổi" : "Tạo tài khoản"}
            </DsButton>
          </div>
        </form>
      </DsPane>
    ) : null;

  return (
    <>
      <DsPageHeader title="Nhân sự" description="Tài khoản quản trị, nhân viên, bác sĩ và dược sĩ; kiểm soát quyền truy cập và trạng thái hoạt động" />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {error || queryError ? <DsNotice tone="bad">{error || queryError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
      </div>
      <DsSplit list={list} pane={passwordPane ?? formPane} />
    </>
  );
}
