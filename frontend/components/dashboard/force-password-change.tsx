"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Hiện thay cho dashboard khi tài khoản do quản trị tạo hoặc đặt lại mật khẩu: người dùng phải
// tự đặt mật khẩu của riêng mình trước khi làm việc tiếp.
export function ForcePasswordChange() {
  const { user, refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Mật khẩu mới tối thiểu 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu chưa khớp");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/auth/dashboard/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mật khẩu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Đặt mật khẩu mới</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {user?.fullName ? `${user.fullName}, ` : ""}quản trị vừa tạo hoặc đặt lại mật khẩu cho bạn.
              Hãy đổi sang mật khẩu riêng để tiếp tục.
            </p>
          </div>
        </div>

        <label className="block text-sm font-medium">
          Mật khẩu hiện tại (do quản trị cấp)
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Mật khẩu mới (tối thiểu 8 ký tự)
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Nhập lại mật khẩu mới
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1"
            required
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            Đổi mật khẩu
          </Button>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            Đăng xuất
          </Button>
        </div>
      </form>
    </div>
  );
}
