"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, User, UsersRound } from "lucide-react";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import { DEPENDENT_RELATIONSHIPS } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { Field, GroupLabel, INPUT_CLASS } from "@/features/booking/components/step-frame";
import { getVietnamYesterdayDateInput } from "@/lib/date";

const CARD = "relative flex min-h-16 min-w-0 flex-1 basis-40 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors";
const EMPTY_FORM = { fullName: "", relationship: "CHILD", dateOfBirth: "", confirmed: false };

// Chọn người khám khi đã đăng nhập: bản thân hoặc một người thân đã lưu; thêm nhanh người thân ngay tại chỗ.
export function PersonPicker({ flow }: { flow: BookingFlow }) {
  const { patient, dependents, state, actions } = flow;
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  if (!patient) return null;
  const chosen = state.selection.dependentId;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.fullName.trim().length < 2) return setError("Nhập họ tên người thân, tối thiểu 2 ký tự.");
    if (!form.confirmed) return setError("Xác nhận bạn có quyền đặt lịch cho người này.");
    setError("");
    setSaving(true);
    try {
      await actions.addDependent({ fullName: form.fullName.trim(), relationship: form.relationship, dateOfBirth: form.dateOfBirth || null });
      setAdding(false);
      setForm(EMPTY_FORM);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thêm được người thân. Thử lại sau.");
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { id: "", title: "Bản thân", note: patient.fullName, icon: User },
    ...dependents.map((item) => ({ id: item.id, title: item.fullName, note: DEPENDENT_RELATIONSHIPS[item.relationship] || item.relationship, icon: UsersRound })),
  ];

  return (
    <fieldset className="min-w-0">
      <GroupLabel>Người khám</GroupLabel>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Người khám">
        {options.map(({ id, title, note, icon: Icon }) => {
          const active = chosen === id;
          return (
            <button
              key={id || "self"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => actions.choosePerson(id)}
              className={`${CARD} ${active ? "border-2 border-[var(--public-primary)] bg-[var(--public-primary-soft)]" : "border-[var(--public-border)] hover:bg-[var(--public-surface-muted)]"}`}
            >
              <Icon className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--public-ink)]">{title}</span>
                <span className="block truncate text-xs text-[var(--public-muted)]">{note}</span>
              </span>
              {active ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--public-success)]" aria-hidden="true" /> : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-expanded={adding}
          className={`${CARD} border-dashed border-[var(--public-border)] text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]`}
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold">Thêm người thân</span>
        </button>
      </div>

      {adding ? (
        <form onSubmit={submit} className="mt-3 space-y-4 rounded-lg border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-4">
          <Field label="Họ và tên" required fieldId="dependent-name">
            <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className={INPUT_CLASS} autoComplete="off" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mối quan hệ" required fieldId="dependent-relationship">
              <select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} className={INPUT_CLASS}>
                {Object.entries(DEPENDENT_RELATIONSHIPS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className="block text-sm font-semibold text-[var(--public-ink)]">Ngày sinh</span>
              <div className="mt-1.5">
                <VietnamDateInput max={getVietnamYesterdayDateInput()} value={form.dateOfBirth} onChange={(value) => setForm({ ...form, dateOfBirth: value })} ariaLabel="Ngày sinh người thân" className={INPUT_CLASS} />
              </div>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-[var(--public-text-soft)]">
            <input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} className="mt-1 h-4 w-4" />
            Tôi xác nhận có quyền đặt lịch và quản lý hồ sơ khám cho người này.
          </label>
          <p className="text-xs leading-5 text-[var(--public-muted)]">Bảo hiểm và tiền sử bổ sung sau trong Hồ sơ và người thân.</p>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-[var(--public-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setError(""); }} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Hủy</button>
            <button type="submit" disabled={saving} className="public-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-70">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Lưu và chọn
            </button>
          </div>
        </form>
      ) : null}
    </fieldset>
  );
}
