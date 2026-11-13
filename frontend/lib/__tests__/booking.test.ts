import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialDraft, createInitialState, estimateAmount, type BookingCatalog, type BookingSlot } from "@/features/booking/model";
import { buildProfilePrefill, resolveUrlPrefill } from "@/features/booking/prefill";
import { bookingReducer } from "@/features/booking/reducer";
import {
  sanitizePhoneInput,
  validateBooking,
  validateDetails,
  validateOtp,
  validateSchedule,
  validateService,
} from "@/features/booking/validation";
import type { PatientUser } from "@/lib/patient-portal-types";

const TODAY = "2026-11-13";
const slot: BookingSlot = { id: "s1", date: "2026-11-14T00:00:00.000Z", startTime: "08:00", endTime: "08:30" };

const readyDraft = () => ({
  ...createInitialDraft("2026-11-14"),
  timeSlotId: "s1",
  patientName: "Nguyễn Văn A",
  patientPhone: "0901234567",
  patientEmail: "a@example.com",
});
const readySelection = { departmentId: "d1", doctorId: "dr1", packageId: "", serviceMode: "DOCTOR_ONLY" as const };

describe("validation", () => {
  it("kiểm tra từng bước theo thứ tự", () => {
    assert.equal(validateService({ ...readySelection, departmentId: "" }), "Vui lòng chọn chuyên khoa.");
    assert.equal(validateService({ ...readySelection, serviceMode: "" }), "Vui lòng chọn khám theo bác sĩ hoặc một gói khám.");
    assert.equal(validateService({ ...readySelection, serviceMode: "PACKAGE" }), "Vui lòng chọn gói khám phù hợp.");
    assert.equal(validateService({ ...readySelection, doctorId: "" }), "Vui lòng chọn bác sĩ.");
    assert.equal(validateService(readySelection), "");

    assert.equal(validateSchedule({ ...readyDraft(), date: "" }, TODAY), "Vui lòng chọn ngày khám.");
    assert.equal(validateSchedule({ ...readyDraft(), date: "2026-11-12" }, TODAY), "Ngày khám không được nhỏ hơn ngày hiện tại.");
    assert.equal(validateSchedule({ ...readyDraft(), timeSlotId: "" }, TODAY), "Vui lòng chọn khung giờ khám.");
    assert.equal(validateSchedule(readyDraft(), TODAY), "");
  });

  it("kiểm tra thông tin người khám", () => {
    assert.equal(validateDetails({ ...readyDraft(), patientName: "A" }, TODAY), "Họ tên người khám tối thiểu 2 ký tự.");
    assert.equal(validateDetails({ ...readyDraft(), patientPhone: "123" }, TODAY), "Số điện thoại không hợp lệ.");
    assert.equal(validateDetails({ ...readyDraft(), patientPhone: "+84901234567" }, TODAY), "");
    assert.equal(validateDetails({ ...readyDraft(), patientEmail: "sai" }, TODAY), "Email không hợp lệ.");
    assert.equal(validateDetails({ ...readyDraft(), patientEmail: "" }, TODAY), "Email là bắt buộc khi xác thực OTP qua email.");
    assert.equal(validateDetails({ ...readyDraft(), patientEmail: "", otpChannel: "SMS" }, TODAY), "");
    assert.equal(validateDetails({ ...readyDraft(), dateOfBirth: TODAY }, TODAY), "Ngày sinh phải nhỏ hơn ngày hiện tại.");
    assert.equal(validateDetails({ ...readyDraft(), hasBHYT: true }, TODAY), "Vui lòng nhập mã thẻ BHYT.");
    assert.match(validateDetails({ ...readyDraft(), allergies: "penicillin" }, TODAY), /đồng ý/);
    assert.equal(validateDetails({ ...readyDraft(), allergies: "penicillin", healthConsent: true }, TODAY), "");
  });

  it("validateBooking trả lỗi đầu tiên và OTP phải đúng 6 số", () => {
    assert.equal(validateBooking(readySelection, readyDraft(), TODAY), "");
    assert.equal(validateBooking({ ...readySelection, doctorId: "" }, { ...readyDraft(), patientName: "" }, TODAY), "Vui lòng chọn bác sĩ.");
    assert.equal(validateOtp("123456"), "");
    assert.equal(validateOtp("12345"), "OTP phải gồm đúng 6 chữ số.");
    assert.equal(validateOtp("12345a"), "OTP phải gồm đúng 6 chữ số.");
  });

  it("làm sạch số điện thoại", () => {
    assert.equal(sanitizePhoneInput(" 0901-234 567 "), "0901234567");
    assert.equal(sanitizePhoneInput("+84 901 234 567 99"), "+84901234567");
    assert.equal(sanitizePhoneInput("09012345678901"), "09012345678");
  });
});

describe("bookingReducer", () => {
  const pending = { appointmentId: "a1", bookingCode: "HB1", patientPhone: "0901234567", expiresIn: 300, holdExpiresAt: "2099-01-01T00:00:00.000Z" };

  it("áp dụng tham số URL và suy ra hình thức khám", () => {
    const next = bookingReducer(createInitialState(), { type: "url_applied", prefill: { departmentId: "d1", doctorId: "dr1", date: "2026-11-20" } });
    assert.equal(next.urlApplied, true);
    assert.equal(next.selection.serviceMode, "DOCTOR_ONLY");
    assert.equal(next.draft.date, "2026-11-20");
    const withPackage = bookingReducer(createInitialState(), { type: "url_applied", prefill: { packageId: "p1" } });
    assert.equal(withPackage.selection.serviceMode, "PACKAGE");
  });

  it("sửa lựa chọn hoặc thông tin thì bỏ phiếu giữ chỗ cũ", () => {
    let state = bookingReducer(createInitialState(), { type: "hold_created", pending, notice: "ok", resendAt: 1 });
    assert.equal(state.step, "verify");
    assert.ok(state.pending);
    state = bookingReducer(state, { type: "draft_changed", patch: { reason: "đau đầu" } });
    assert.equal(state.pending, null);
    assert.equal(state.notice, "");
  });

  it("đổi ngày hoặc bỏ chọn giờ thì xóa khung giờ đã chọn", () => {
    let state = bookingReducer(createInitialState(), { type: "date_defaulted", date: "2026-11-14" });
    state = bookingReducer(state, { type: "slot_chosen", slot });
    assert.equal(state.draft.timeSlotId, "s1");
    assert.equal(state.slot?.id, "s1");
    state = bookingReducer(state, { type: "draft_changed", patch: { date: "2026-11-15" } });
    assert.equal(state.slot, null);
  });

  it("danh sách khung giờ mới: giờ không còn trống bị bỏ chọn, nhưng giữ nguyên khi đã giữ chỗ", () => {
    let state = bookingReducer(createInitialState(), { type: "date_defaulted", date: "2026-11-14" });
    state = bookingReducer(state, { type: "slot_chosen", slot });
    const kept = bookingReducer(state, { type: "slots_loaded", slots: [slot] });
    assert.equal(kept.draft.timeSlotId, "s1");
    const dropped = bookingReducer(state, { type: "slots_loaded", slots: [] });
    assert.equal(dropped.draft.timeSlotId, "");
    assert.equal(dropped.slot, null);
    const held = bookingReducer(state, { type: "hold_created", pending, notice: "", resendAt: 1 });
    assert.equal(bookingReducer(held, { type: "slots_loaded", slots: [] }), held);
  });

  it("khôi phục phiếu chờ OTP kèm lựa chọn và khung giờ đã giữ", () => {
    let state = bookingReducer(createInitialState(), { type: "url_applied", prefill: { departmentId: "d1", doctorId: "dr1" } });
    state = bookingReducer(state, { type: "slot_chosen", slot });
    const held = bookingReducer(state, { type: "hold_created", pending, notice: "", resendAt: 1 });
    // Tải lại trang: trạng thái mới, phiếu đọc lại từ sessionStorage.
    const restored = bookingReducer(createInitialState(), { type: "pending_restored", pending: held.pending!, notice: "", resendAt: 2 });
    assert.equal(restored.step, "verify");
    assert.equal(restored.selection.doctorId, "dr1");
    assert.equal(restored.slot?.id, "s1");
    assert.equal(restored.draft.date, "2026-11-14");
  });

  it("hết giờ giữ chỗ quay về bước chọn giờ với thông báo", () => {
    const held = bookingReducer(createInitialState(), { type: "hold_created", pending, notice: "", resendAt: 1 });
    const expired = bookingReducer(held, { type: "hold_expired", message: "hết giờ" });
    assert.equal(expired.step, "schedule");
    assert.equal(expired.pending, null);
    assert.equal(expired.error, "hết giờ");
  });

  it("OTP chỉ nhận chữ số, tối đa 6; xác thực xong sang bước hoàn tất", () => {
    let state = bookingReducer(createInitialState(), { type: "otp_changed", otp: "12a34b567890" });
    assert.equal(state.otp, "123456");
    state = bookingReducer(state, {
      type: "verified",
      appointment: { id: "a1", bookingCode: "HB1" } as never,
      notice: "xong",
    });
    assert.equal(state.step, "done");
    assert.equal(state.otp, "");
    assert.equal(state.pending, null);
  });

  it("đổi tài khoản thì bỏ thông tin người trước, chỉ giữ ngày và giờ", () => {
    let state = bookingReducer(createInitialState(), { type: "date_defaulted", date: "2026-11-14" });
    state = bookingReducer(state, { type: "slot_chosen", slot });
    state = bookingReducer(state, { type: "profile_applied", ownerId: "u1", patch: { patientName: "Người A", address: "Hà Nội" } });
    assert.equal(state.draft.address, "Hà Nội");
    state = bookingReducer(state, { type: "profile_applied", ownerId: "u2", patch: { patientName: "Người B" } });
    assert.equal(state.draft.patientName, "Người B");
    assert.equal(state.draft.address, "");
    assert.equal(state.draft.timeSlotId, "s1");
    state = bookingReducer(state, { type: "profile_cleared" });
    assert.equal(state.profileOwnerId, null);
    assert.equal(state.draft.patientName, "");
  });
});

describe("prefill", () => {
  const catalog = {
    departments: [{ id: "d1", name: "Tim mạch" }],
    doctors: [{ id: "dr1", department: { id: "d1" }, consultationFee: 250000, user: { fullName: "BS A" } }],
    packages: [{ id: "p1", department: { id: "d1" }, finalPrice: 900000 }],
  } as unknown as BookingCatalog;

  it("chỉ nhận mã có trong danh mục và suy ra chuyên khoa", () => {
    const prefill = resolveUrlPrefill(new URLSearchParams("doctorId=dr1&date=2026-11-20T00:00:00Z&timeSlotId=s9"), catalog);
    assert.equal(prefill.departmentId, "d1");
    assert.equal(prefill.doctorId, "dr1");
    assert.equal(prefill.date, "2026-11-20");
    assert.equal(prefill.timeSlotId, "s9");
    const unknown = resolveUrlPrefill(new URLSearchParams("doctorId=khong-co&packageId=khong-co"), catalog);
    assert.equal(unknown.doctorId, "");
    assert.equal(unknown.packageId, "");
  });

  it("tính giá tạm tính theo hình thức khám", () => {
    assert.equal(estimateAmount({ ...readySelection }, catalog), 250000);
    assert.equal(estimateAmount({ ...readySelection, serviceMode: "PACKAGE", packageId: "p1" }, catalog), 900000);
    assert.equal(estimateAmount({ ...readySelection, serviceMode: "" }, catalog), 0);
  });

  it("tự điền hồ sơ chỉ vào ô còn trống", () => {
    const user = { id: "u1", fullName: "Người A", phone: "0901234567", email: "a@x.vn", patientProfile: { address: "Hà Nội", hasBHYT: true } } as unknown as PatientUser;
    const patch = buildProfilePrefill({ ...createInitialDraft(), patientName: "Tên đã nhập" }, user);
    assert.equal(patch.patientName, undefined);
    assert.equal(patch.patientPhone, "0901234567");
    assert.equal(patch.address, "Hà Nội");
    assert.equal(patch.hasBHYT, true);
  });
});
