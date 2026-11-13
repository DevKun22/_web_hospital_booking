import type { ReactNode } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import type { DoctorSort } from "@/features/doctors/filters";
import type { useDoctorFilters } from "@/features/doctors/use-doctor-filters";
import type { PublicDepartment } from "@/components/public/public-home-types";

type FilterState = ReturnType<typeof useDoctorFilters>;

const FIELD = "ui-field w-full px-3 py-2.5 text-base sm:text-sm";
const FIELD_LABEL = "mb-1.5 block text-xs font-semibold text-[var(--public-text-soft)]";

export function DoctorFilterBar({ state, departments }: { state: FilterState; departments: PublicDepartment[] }) {
  const { filters, searchInput, setSearchInput, update, submitSearch, reset, hasActiveFilters } = state;

  return (
    <section className="ui-container pt-5 sm:pt-7" aria-label="Bộ lọc bác sĩ">
      <div className="rounded-2xl border border-[var(--public-border)] bg-white p-3 shadow-sm sm:p-4">
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <label className="relative block">
            <span className="sr-only">Tìm bác sĩ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nhập tên bác sĩ, chức danh, chuyên môn hoặc chuyên khoa"
              className="ui-field w-full py-3 pl-10 pr-3 text-base sm:text-sm"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Tìm kiếm
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasActiveFilters}
            className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Đặt lại
          </button>
        </form>

        <div className="mt-4 grid gap-3 border-t border-[var(--public-divider)] pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className={FIELD_LABEL}>Chuyên khoa</span>
            <select value={filters.departmentId} onChange={(event) => update({ departmentId: event.target.value })} className={FIELD}>
              <option value="">Tất cả chuyên khoa</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Kinh nghiệm</span>
            <select value={filters.minExperience} onChange={(event) => update({ minExperience: event.target.value })} className={FIELD}>
              <option value="">Tất cả mức kinh nghiệm</option>
              {[5, 10, 15, 20].map((years) => (
                <option key={years} value={years}>Từ {years} năm</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Thời gian có lịch trống</span>
            <select value={filters.availableToday ? "TODAY" : "ALL"} onChange={(event) => update({ availableToday: event.target.value === "TODAY" })} className={FIELD}>
              <option value="ALL">Không giới hạn</option>
              <option value="TODAY">Có lịch hôm nay</option>
            </select>
          </label>
          <label className="block">
            <span className={FIELD_LABEL}>Sắp xếp theo</span>
            <select value={filters.sort} onChange={(event) => update({ sort: event.target.value as DoctorSort })} className={FIELD}>
              <option value="NAME_ASC">Tên bác sĩ A–Z</option>
              <option value="EXPERIENCE_DESC">Kinh nghiệm cao nhất</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--public-divider)] pt-3">
          <span className="mr-1 text-xs font-semibold text-[var(--public-muted)]">Lọc nhanh:</span>
          <QuickFilter active={filters.availableToday} onClick={() => update({ availableToday: !filters.availableToday })}>
            Có lịch hôm nay
          </QuickFilter>
          {departments.slice(0, 3).map((item) => (
            <QuickFilter key={item.id} active={filters.departmentId === item.id} onClick={() => update({ departmentId: filters.departmentId === item.id ? "" : item.id })}>
              {item.name}
            </QuickFilter>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickFilter({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white"
          : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
