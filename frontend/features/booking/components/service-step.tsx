import { ChevronRight, Info, PackageCheck, Stethoscope } from "lucide-react";
import { doctorDisplayName, doctorsFor, packagesFor, type ServiceMode } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { StepFrame } from "@/features/booking/components/step-frame";
import { formatCurrency } from "@/lib/format";

const MODES: { value: Exclude<ServiceMode, "">; label: string; icon: typeof Stethoscope }[] = [
  { value: "DOCTOR_ONLY", label: "Khám theo bác sĩ", icon: Stethoscope },
  { value: "PACKAGE", label: "Chọn gói khám", icon: PackageCheck },
];

export function ServiceStep({ flow, loading }: { flow: BookingFlow; loading: boolean }) {
  const { state, dispatch, catalog, actions } = flow;
  const { selection } = state;
  const doctors = doctorsFor(catalog, selection.departmentId);
  const packages = packagesFor(catalog, selection.departmentId);
  const change = (patch: Partial<typeof selection>) => dispatch({ type: "selection_changed", patch });

  return (
    <StepFrame number={1} title="Chọn chuyên khoa và dịch vụ">
      <label className="block">
        <span className="text-sm font-semibold text-[var(--public-ink)]">
          Chuyên khoa tiếp nhận <span className="text-[var(--public-danger)]">*</span>
        </span>
        <select
          value={selection.departmentId}
          onChange={(event) => {
            change({ departmentId: event.target.value, doctorId: "", packageId: "", serviceMode: "" });
            dispatch({ type: "draft_changed", patch: { timeSlotId: "" } });
          }}
          className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
          disabled={loading}
        >
          <option value="">Chọn chuyên khoa phù hợp</option>
          {catalog.departments.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="mt-5" disabled={loading || !selection.departmentId}>
        <legend className="text-sm font-semibold text-[var(--public-ink)]">
          Phương thức chọn khám <span className="text-[var(--public-danger)]">*</span>
        </legend>
        <div className="mt-2 grid gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-1.5 sm:grid-cols-2">
          {MODES.map(({ value, label, icon: Icon }) => {
            const active = selection.serviceMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => change({ serviceMode: value, packageId: "" })}
                aria-pressed={active}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${
                  active
                    ? "border border-[var(--public-border)] bg-white text-[var(--public-primary-dark)] shadow-sm"
                    : "text-[var(--public-text-soft)] hover:bg-white/70 hover:text-[var(--public-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {selection.departmentId && !selection.serviceMode ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-3 py-2.5 text-sm text-[var(--public-primary-dark)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Chọn khám theo bác sĩ hoặc chọn một gói khám đang có trong hệ thống để tiếp tục.</p>
        </div>
      ) : null}

      {selection.serviceMode ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {selection.serviceMode === "PACKAGE" ? (
            <label className="block">
              <span className="text-sm font-semibold text-[var(--public-ink)]">
                Gói khám <span className="text-[var(--public-danger)]">*</span>
              </span>
              <select
                value={selection.packageId}
                onChange={(event) => change({ packageId: event.target.value })}
                className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
              >
                <option value="">Chọn gói khám</option>
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.finalPrice)}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--public-primary-dark)]">
              Phí dự kiến sẽ được tính theo bác sĩ bạn chọn.
            </div>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-[var(--public-ink)]">
              Bác sĩ tiếp nhận <span className="text-[var(--public-danger)]">*</span>
              {selection.serviceMode === "PACKAGE" ? (
                <span className="ml-1 font-normal text-[var(--public-muted)]">(không tính phí khám riêng)</span>
              ) : null}
            </span>
            <select
              value={selection.doctorId}
              onChange={(event) => {
                change({ doctorId: event.target.value });
                dispatch({ type: "draft_changed", patch: { timeSlotId: "" } });
              }}
              className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
              disabled={selection.serviceMode === "PACKAGE" && !selection.packageId}
            >
              <option value="">Chọn bác sĩ</option>
              {doctors.map((item) => (
                <option key={item.id} value={item.id}>
                  {doctorDisplayName(item)}
                  {selection.serviceMode === "DOCTOR_ONLY" ? ` · ${formatCurrency(item.consultationFee)}` : ""}
                </option>
              ))}
            </select>
            {selection.serviceMode === "PACKAGE" ? (
              <span className="mt-1.5 block text-xs leading-5 text-[var(--public-muted)]">
                Bác sĩ được chọn để tiếp nhận gói; tạm tính chỉ theo giá gói đang hiển thị.
              </span>
            ) : null}
          </label>
        </div>
      ) : null}

      <div className="mt-5 flex justify-end border-t border-[var(--public-divider)] pt-4">
        <button type="button" onClick={actions.continueFromService} className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold">
          Tiếp tục
          <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </StepFrame>
  );
}
