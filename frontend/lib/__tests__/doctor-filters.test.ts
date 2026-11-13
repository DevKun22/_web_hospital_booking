import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPageNumbers,
  defaultDoctorFilters,
  doctorFiltersToUrl,
  hasActiveDoctorFilters,
  parseDoctorFilters,
} from "@/features/doctors/filters";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";

describe("doctor filters", () => {
  it("đọc bộ lọc từ địa chỉ, giá trị lạ rơi về mặc định", () => {
    const filters = parseDoctorFilters(new URLSearchParams("search=tim&departmentId=d1&minExperience=10&availableToday=true&sort=EXPERIENCE_DESC&page=3"));
    assert.deepEqual(filters, { search: "tim", departmentId: "d1", minExperience: "10", availableToday: true, sort: "EXPERIENCE_DESC", page: 3 });
    assert.deepEqual(parseDoctorFilters(new URLSearchParams("sort=LA&page=-2&availableToday=1")), defaultDoctorFilters);
    assert.equal(parseDoctorFilters(new URLSearchParams("page=2.5")).page, 1);
  });

  it("ghi ra địa chỉ chỉ giữ giá trị khác mặc định và giữ tham số khác", () => {
    assert.equal(doctorFiltersToUrl(defaultDoctorFilters), "/bac-si");
    assert.equal(doctorFiltersToUrl({ ...defaultDoctorFilters, search: " tim ", page: 2 }), "/bac-si?search=tim&page=2");
    const url = doctorFiltersToUrl({ ...defaultDoctorFilters, availableToday: true }, new URLSearchParams("utm=x&page=4&search=cu"));
    assert.equal(url, "/bac-si?utm=x&availableToday=true");
  });

  it("đọc rồi ghi lại cho kết quả ổn định", () => {
    const query = "search=tim&departmentId=d1&minExperience=5&availableToday=true&sort=EXPERIENCE_DESC&page=2";
    const url = doctorFiltersToUrl(parseDoctorFilters(new URLSearchParams(query)));
    assert.deepEqual(parseDoctorFilters(new URLSearchParams(url.split("?")[1])), parseDoctorFilters(new URLSearchParams(query)));
  });

  it("nhận biết có bộ lọc đang bật", () => {
    assert.equal(hasActiveDoctorFilters(defaultDoctorFilters), false);
    assert.equal(hasActiveDoctorFilters({ ...defaultDoctorFilters, sort: "EXPERIENCE_DESC" }), true);
    assert.equal(hasActiveDoctorFilters({ ...defaultDoctorFilters, page: 3 }), false);
  });

  it("tối đa 5 số trang quanh trang hiện tại", () => {
    assert.deepEqual(buildPageNumbers(1, 3), [1, 2, 3]);
    assert.deepEqual(buildPageNumbers(1, 10), [1, 2, 3, 4, 5]);
    assert.deepEqual(buildPageNumbers(5, 10), [3, 4, 5, 6, 7]);
    assert.deepEqual(buildPageNumbers(10, 10), [6, 7, 8, 9, 10]);
    assert.deepEqual(buildPageNumbers(1, 0), []);
  });

  it("tên hiển thị và chữ cái đầu của bác sĩ", () => {
    assert.equal(doctorDisplayName({ title: "BS.CKII", user: { fullName: "Trần Thị Mai" } }), "BS.CKII Trần Thị Mai");
    assert.equal(doctorDisplayName({ title: null, user: { fullName: "Lê An" } }), "Lê An");
    assert.equal(doctorInitial(" mai"), "M");
    assert.equal(doctorInitial("   "), "B");
  });
});
