import { ChipRow, FilterChip, FlatSelect } from "@/components/public/catalog-parts";
import { PublicCatalogSearch } from "@/components/public/public-catalog-controls";
import type { PublicDepartment } from "@/components/public/public-home-types";
import type { DoctorSort } from "@/features/doctors/filters";
import type { useDoctorFilters } from "@/features/doctors/use-doctor-filters";

type FilterState = ReturnType<typeof useDoctorFilters>;

// Thanh lọc bác sĩ dùng chung kiểu phẳng với các trang danh mục: ô tìm, ba ô chọn, chip lọc nhanh. Đặt trong đầu trang.
export function DoctorFilterBar({ state, departments }: { state: FilterState; departments: PublicDepartment[] }) {
  const { filters, searchInput, setSearchInput, update, submitSearch, reset, hasActiveFilters } = state;

  return (
    <PublicCatalogSearch
      value={searchInput}
      onChange={setSearchInput}
      onSubmit={submitSearch}
      onReset={reset}
      canReset={hasActiveFilters}
      onBrand
      placeholder="Tìm bác sĩ, chuyên khoa hoặc chuyên môn"
      controls={
        <>
          <FlatSelect label="Chuyên khoa" value={filters.departmentId} onChange={(departmentId) => update({ departmentId })}>
            <option value="">Tất cả chuyên khoa</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FlatSelect>
          <FlatSelect label="Kinh nghiệm" value={filters.minExperience} onChange={(minExperience) => update({ minExperience })}>
            <option value="">Mọi mức kinh nghiệm</option>
            {[5, 10, 15, 20].map((years) => (
              <option key={years} value={years}>Từ {years} năm</option>
            ))}
          </FlatSelect>
          <FlatSelect label="Sắp xếp" value={filters.sort} onChange={(sort) => update({ sort: sort as DoctorSort })}>
            <option value="NAME_ASC">Tên A–Z</option>
            <option value="EXPERIENCE_DESC">Kinh nghiệm cao nhất</option>
          </FlatSelect>
        </>
      }
    >
      <ChipRow label="Lọc nhanh">
        <FilterChip selected={filters.availableToday} onClick={() => update({ availableToday: !filters.availableToday })}>Có lịch hôm nay</FilterChip>
        {departments.slice(0, 3).map((item) => (
          <FilterChip key={item.id} selected={filters.departmentId === item.id} onClick={() => update({ departmentId: filters.departmentId === item.id ? "" : item.id })}>{item.name}</FilterChip>
        ))}
      </ChipRow>
    </PublicCatalogSearch>
  );
}
