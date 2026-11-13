/* eslint-disable @next/next/no-img-element */
import { doctorsFor, packagesFor, type ServiceMode } from "@/features/booking/model";
import type { BookingFlow } from "@/features/booking/use-booking-flow";
import { Field, GroupLabel, INPUT_CLASS, StepFrame } from "@/features/booking/components/step-frame";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency } from "@/lib/format";

const MODES: { value: Exclude<ServiceMode, "">; label: string }[] = [
  { value: "DOCTOR_ONLY", label: "Khám theo bác sĩ" },
  { value: "PACKAGE", label: "Khám theo gói" },
];

export function ServiceStep({ flow, loading }: { flow: BookingFlow; loading: boolean }) {
  const { state, dispatch, catalog } = flow;
  const { selection } = state;
  const doctors = doctorsFor(catalog, selection.departmentId);
  const packages = packagesFor(catalog, selection.departmentId);
  const change = (patch: Partial<typeof selection>) => dispatch({ type: "selection_changed", patch });
  const needsPackage = selection.serviceMode === "PACKAGE" && !selection.packageId;

  return (
    <StepFrame title="Bạn muốn khám gì?" description="Chọn chuyên khoa, hình thức khám và bác sĩ tiếp nhận.">
      <Field label="Chuyên khoa" required>
        <select
          value={selection.departmentId}
          onChange={(event) => {
            change({ departmentId: event.target.value, doctorId: "", packageId: "", serviceMode: "" });
            dispatch({ type: "draft_changed", patch: { timeSlotId: "" } });
          }}
          className={INPUT_CLASS}
          disabled={loading}
        >
          <option value="">Chọn chuyên khoa</option>
          {catalog.departments.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </Field>

      {selection.departmentId ? (
        <fieldset>
          <GroupLabel>Hình thức khám</GroupLabel>
          <div className="mt-1.5 grid grid-cols-2 rounded-lg border border-[var(--public-border)] p-1" role="group">
            {MODES.map(({ value, label }) => {
              const active = selection.serviceMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => change({ serviceMode: value, packageId: "" })}
                  className={`min-h-11 rounded-md px-3 text-sm font-semibold transition-colors ${
                    active ? "bg-[var(--public-primary)] text-white" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {selection.serviceMode === "PACKAGE" ? (
        <fieldset>
          <GroupLabel>Gói khám</GroupLabel>
          <div className="mt-1.5 overflow-hidden rounded-lg border border-[var(--public-border)]" role="radiogroup" aria-label="Gói khám">
            {packages.length ? (
              packages.map((item) => (
                <label key={item.id} className="choice-row">
                  <input type="radio" name="package" checked={selection.packageId === item.id} onChange={() => change({ packageId: item.id })} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-5 text-[var(--public-ink)]">{item.name}</span>
                    {item.summary ? <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--public-muted)]">{item.summary}</span> : null}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</span>
                  <span className="choice-row__mark" aria-hidden="true" />
                </label>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[var(--public-muted)]">Chuyên khoa này chưa có gói khám.</p>
            )}
          </div>
        </fieldset>
      ) : null}

      {selection.serviceMode && !needsPackage ? (
        <fieldset>
          <GroupLabel>{selection.serviceMode === "PACKAGE" ? "Bác sĩ tiếp nhận gói" : "Bác sĩ"}</GroupLabel>
          <div className="mt-1.5 overflow-hidden rounded-lg border border-[var(--public-border)]" role="radiogroup" aria-label="Bác sĩ">
            {doctors.length ? (
              doctors.map((item) => (
                <label key={item.id} className="choice-row">
                  <input
                    type="radio"
                    name="doctor"
                    checked={selection.doctorId === item.id}
                    onChange={() => {
                      change({ doctorId: item.id });
                      dispatch({ type: "draft_changed", patch: { timeSlotId: "" } });
                    }}
                  />
                  {item.user.avatar ? (
                    <img src={item.user.avatar} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)] text-sm font-bold text-[var(--public-primary-dark)]" aria-hidden="true">
                      {doctorInitial(item.user.fullName)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-5 text-[var(--public-ink)]">{doctorDisplayName(item)}</span>
                    <span className="mt-0.5 block truncate text-xs leading-5 text-[var(--public-muted)]">
                      {[item.specialization, item.experience ? `${item.experience} năm kinh nghiệm` : ""].filter(Boolean).join(" · ") || item.department.name}
                    </span>
                  </span>
                  {selection.serviceMode === "DOCTOR_ONLY" ? (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.consultationFee)}</span>
                  ) : null}
                  <span className="choice-row__mark" aria-hidden="true" />
                </label>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[var(--public-muted)]">Chuyên khoa này chưa có bác sĩ nhận lịch.</p>
            )}
          </div>
          {selection.serviceMode === "PACKAGE" ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--public-muted)]">Khám theo gói không tính phí khám riêng của bác sĩ; giá tạm tính theo gói.</p>
          ) : null}
        </fieldset>
      ) : null}
    </StepFrame>
  );
}
