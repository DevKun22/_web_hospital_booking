import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialDraft, createInitialState, estimateAmount, type BookingCatalog, type BookingSlot } from "@/features/booking/model";
import { buildDependentPatch, buildProfilePrefill, buildSelfPatch, resolveUrlPrefill } from "@/features/booking/prefill";
import { bookingReducer } from "@/features/booking/reducer";
import {
  sanitizePhoneInput,
  validateDetailFields,
  validateDetails,
  validateOtp,
  validateSchedule,
  validateService,
} from "@/features/booking/validation";
import type { PatientDependent, PatientUser } from "@/lib/patient-portal-types";

const TODAY = "2026-11-13";
const slot: BookingSlot = { id: "s1", date: "2026-11-14T00:00:00.000Z", startTime: "08:00", endTime: "08:30" };

const readyDraft = () => ({
  ...createInitialDraft("2026-11-14"),
  timeSlotId: "s1",
  patientName: "Nguyễn Văn A",
  patientPhone: "0901234567",
  patientEmail: "a@example.com",
});
const readySelection = { departmentId: "d1", doctorId: "dr1", packageId: "", dependentId: "", serviceMode: "DOCTOR_ONLY" as const };

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
    assert.equal(validateDetails({ ...readyDraft(), patientName: "A" }, TODAY), "Nhập họ tên người khám, tối thiểu 2 ký tự.");
    assert.equal(validateDetails({ ...readyDraft(), patientPhone: "123" }, TODAY), "Số điện thoại bắt đầu bằng 0 hoặc +84 và có 10 hoặc 11 số.");
    assert.equal(validateDetails({ ...readyDraft(), patientPhone: "" }, TODAY), "Nhập số điện thoại để cơ sở khám liên hệ.");
    assert.equal(validateDetails({ ...readyDraft(), patientPhone: "+84901234567" }, TODAY), "");
    assert.equal(validateDetails({ ...readyDraft(), patientEmail: "sai" }, TODAY), "Email chưa đúng định dạng.");
    assert.equal(validateDetails({ ...readyDraft(), patientEmail: "" }, TODAY), "Nhập email để nhận mã OTP và xem lại lịch hẹn.");
    assert.equal(validateDetails({ ...readyDraft(), dateOfBirth: TODAY }, TODAY), "Ngày sinh phải trước ngày hôm nay.");
    assert.equal(validateDetails({ ...readyDraft(), hasBHYT: true }, TODAY), "Nhập mã thẻ BHYT hoặc bỏ chọn có bảo hiểm.");
    assert.match(validateDetails({ ...readyDraft(), allergies: "penicillin" }, TODAY), /Đồng ý/);
    assert.equal(validateDetails({ ...readyDraft(), allergies: "penicillin", healthConsent: true }, TODAY), "");
  });

  it("trả lỗi theo từng ô để gắn đúng tại ô đó", () => {
    assert.deepEqual(validateDetailFields(readyDraft(), TODAY), {});
    const errors = validateDetailFields({ ...readyDraft(), patientName: "", patientEmail: "sai", hasBHYT: true }, TODAY);
    assert.deepEqual(Object.keys(errors).sort(), ["healthInsuranceCode", "patientEmail", "patientName"]);
    assert.equal(errors.patientEmail, "Email chưa đúng định dạng.");
    assert.equal(validateDetailFields({ ...readyDraft(), dateOfBirth: TODAY }, TODAY).dateOfBirth, "Ngày sinh phải trước ngày hôm nay.");
  });

  it("OTP phải đúng 6 số", () => {
    assert.equal(validateOtp("123456"), "");
    assert.equal(validateOtp("12345"), "Mã OTP gồm đúng 6 chữ số.");
    assert.equal(validateOtp("12345a"), "Mã OTP gồm đúng 6 chữ số.");
  });

  it("làm sạch số điện thoại", () => {
    assert.equal(sanitizePhoneInput(" 0901-234 567 "), "0901234567");
    assert.equal(sanitizePhoneInput("+84 901 234 567 99"), "+84901234567");
    assert.equal(sanitizePhoneInput("09012345678901"), "09012345678");
  });
});

describe("bookingReducer", () => {
  const pending = { appointmentId: "a1", bookingCode: "HB1", patientPhone: "0901234567", expiresIn: 300, holdExpiresAt: "2099-01-01T00:00:00.000Z" };

  it("trạng thái lỗi: ô đã chạm, lần gửi lỗi, lỗi bước và lỗi OTP", () => {
    let state = bookingReducer(createInitialState(), { type: "field_touched", field: "patientEmail" });
    state = bookingReducer(state, { type: "field_touched", field: "patientEmail" });
    assert.deepEqual(state.touched, ["patientEmail"]);
    state = bookingReducer(state, { type: "submit_failed" });
    assert.equal(state.submitAttempts, 1);
    state = bookingReducer(state, { type: "step_invalid", message: "Vui lòng chọn bác sĩ." });
    assert.equal(state.stepError, "Vui lòng chọn bác sĩ.");
    assert.equal(state.error, "");
    state = bookingReducer(state, { type: "selection_changed", patch: { doctorId: "dr1" } });
    assert.equal(state.stepError, "");
    state = bookingReducer(state, { type: "otp_error", message: "Mã OTP không đúng." });
    assert.equal(state.otpError, "Mã OTP không đúng.");
    state = bookingReducer(state, { type: "otp_changed", otp: "1234" });
    assert.equal(state.otpError, "");
  });

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

describe("bookingReducer: lỗi theo trường và giới hạn tần suất", () => {
  it("giữ lỗi email dưới ô Email cho tới khi người dùng sửa email, sửa ô khác thì giữ nguyên", () => {
    let state = bookingReducer(createInitialState(), { type: "email_rejected", message: "Email này không dùng được" });
    assert.equal(state.emailError, "Email này không dùng được");
    assert.equal(state.error, "", "không bật thông báo nổi song song với lỗi theo trường");
    assert.equal(state.submitting, false);

    state = bookingReducer(state, { type: "draft_changed", patch: { patientName: "An" } });
    assert.equal(state.emailError, "Email này không dùng được");

    state = bookingReducer(state, { type: "draft_changed", patch: { patientEmail: "khac@example.test" } });
    assert.equal(state.emailError, "");
  });

  it("đặt mốc hết giới hạn khi bị 429 và không bị xóa khi người dùng sửa thông tin", () => {
    const until = Date.now() + 120_000;
    let state = bookingReducer({ ...createInitialState(), submitting: true }, { type: "rate_limited", until, message: "Quá nhiều yêu cầu" });
    assert.equal(state.cooldownUntil, until);
    assert.equal(state.submitting, false);
    assert.equal(state.error, "Quá nhiều yêu cầu");

    state = bookingReducer(state, { type: "draft_changed", patch: { patientPhone: "0901234567" } });
    assert.equal(state.cooldownUntil, until);
  });
});

describe("chọn người khám", () => {
  const user = { id: "u1", fullName: "Gu", email: "gu@example.com", phone: "0901234567", patientProfile: { gender: "MALE", dateOfBirth: "1990-01-02T00:00:00.000Z", allergies: "Penicillin" } } as unknown as PatientUser;
  const child = { id: "dep1", fullName: "Son", relationship: "CHILD", dateOfBirth: "2018-05-06T00:00:00.000Z", hasBHYT: false, gender: "MALE" } as PatientDependent;

  it("chọn người thân thay hẳn thông tin cá nhân, giữ liên hệ của tài khoản và không mang dữ liệu sức khỏe của chủ tài khoản", () => {
    let state = bookingReducer(createInitialState(), { type: "draft_changed", patch: { reason: "Ho kéo dài", timeSlotId: "s1", date: "2026-11-14" } });
    state = bookingReducer(state, { type: "profile_applied", ownerId: "u1", patch: buildProfilePrefill(state.draft, user) });
    assert.equal(state.draft.allergies, "Penicillin");

    state = bookingReducer(state, { type: "person_chosen", dependentId: "dep1", patch: buildDependentPatch(child, user) });
    assert.equal(state.selection.dependentId, "dep1");
    assert.equal(state.draft.patientName, "Son");
    assert.equal(state.draft.dateOfBirth, "2018-05-06");
    assert.equal(state.draft.allergies, "");
    assert.equal(state.draft.patientEmail, "gu@example.com");
    assert.equal(state.draft.patientPhone, "0901234567");
    assert.equal(state.draft.reason, "Ho kéo dài");
    assert.equal(state.draft.date, "2026-11-14");
  });

  it("quay về bản thân điền lại hồ sơ tài khoản và xóa phần của người thân", () => {
    let state = bookingReducer(createInitialState(), { type: "person_chosen", dependentId: "dep1", patch: buildDependentPatch(child, user) });
    state = bookingReducer(state, { type: "person_chosen", dependentId: "", patch: buildSelfPatch(state.draft, user) });
    assert.equal(state.selection.dependentId, "");
    assert.equal(state.draft.patientName, "Gu");
    assert.equal(state.draft.dateOfBirth, "1990-01-02");
    assert.equal(state.draft.allergies, "Penicillin");
  });

  it("đăng xuất thì bỏ chọn người thân", () => {
    let state = bookingReducer(createInitialState(), { type: "profile_applied", ownerId: "u1", patch: {} });
    state = bookingReducer(state, { type: "person_chosen", dependentId: "dep1", patch: buildDependentPatch(child, user) });
    state = bookingReducer(state, { type: "profile_cleared" });
    assert.equal(state.selection.dependentId, "");
  });
});
