import ChatbotContextService from "../../src/services/chatbot/chatbot.context.js";
import KnowledgeService from "../../src/services/chatbot/rag/knowledge.service.js";
import PatientPortalService from "../../src/services/patientPortal.service.js";
import { AppError } from "../../src/utils/appError.js";
import { chatbotRetentionMode } from "../../src/services/maintenance.service.js";
import { MaintenanceService, assert, beforeEach, bookingBody, createStoredAppointment, fixture, http, loginPatient, prisma, test } from "./support/context.js";

// Kiểm độ tin cậy Kun V2 trước khi phát hành: vòng đời khách → OTP → đăng nhập → hủy; hủy lịch khi mã hết hạn, dịch vụ báo lỗi,
// trạng thái đổi giữa chừng; hai tin đồng thời; cấp cứu khi đang chờ xác nhận. AI không được gọi (khóa bị xóa).

for (const key of ["GEMINI_API_KEY", "FIREBASE_API_KEY", "API_KEY"]) process.env[key] = "";

const BOOKING_CODE = "BK20261124000101";

const ask = (message: string, extra: Record<string, unknown> = {}, authorization?: string) =>
  http.request("/api/v1/chatbot/message", {
    method: "POST",
    body: { message, ...extra },
    headers: authorization ? { authorization } : undefined,
  });

const bearerFor = async (phone: string) => `Bearer ${(await loginPatient(phone)).accessToken}`;

type ChatAction = { type: string; payload: Record<string, unknown> };
const confirmOf = (response: { body: { data?: unknown } }) => {
  const actions = (response.body.data as { suggestedActions: ChatAction[] }).suggestedActions;
  const action = actions.find((item) => item.type === "CONFIRM_CANCEL_APPOINTMENT");
  assert.ok(action, "phải có nút xác nhận hủy");
  return action;
};

beforeEach(async () => {
  await prisma.chatKnowledgeChunk.deleteMany();
  await prisma.chatbotLog.deleteMany();
  await prisma.chatbotSession.deleteMany();
  KnowledgeService.invalidate();
  ChatbotContextService.invalidate();
});

test("vòng đời: khách trò chuyện → đặt lịch + OTP cấp phiên → tra cứu → hủy có xác nhận", async () => {
  const guest = await ask("Chọn bác sĩ", { action: { type: "SELECT_DOCTOR", payload: { doctorId: fixture.doctorOne.id, departmentId: fixture.department.id } } });
  assert.equal(guest.status, 200);

  // Biểu mẫu đặt lịch sẵn có + OTP: máy chủ cấp phiên người khám khi email của lịch khớp tài khoản.
  const booking = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0911000009" }) });
  assert.equal(booking.status, 201);
  const verified = await http.request(`/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`, {
    method: "POST",
    body: { otp: booking.body.data.debugOtp, issueSession: true, platform: "android", deviceId: "device-chatbot-life" },
  });
  assert.equal(verified.status, 200);
  const authorization = `Bearer ${verified.body.data.session.accessToken}`;

  // Quay lại chatbot với mã phiên khách: phiên được xoay sang tài khoản và thấy đúng lịch vừa đặt.
  const lookup = await ask("xem lịch hẹn của tôi", { sessionId: guest.body.data.sessionId }, authorization);
  assert.equal(lookup.status, 200);
  assert.notEqual(lookup.body.data.sessionId, guest.body.data.sessionId);
  const card = lookup.body.data.results[0].items[0];
  assert.equal(card.id, booking.body.data.appointmentId);

  const asked = await ask("hủy lịch hẹn giúp tôi", { sessionId: lookup.body.data.sessionId }, authorization);
  assert.equal(asked.body.data.state, "AWAITING_CONFIRMATION");
  const done = await ask("Xác nhận hủy lịch", { sessionId: asked.body.data.sessionId, action: confirmOf(asked) }, authorization);
  assert.match(done.body.data.reply, /Mình đã hủy/);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: card.id } })).status, "CANCELLED_BY_PATIENT");
});

test("hủy lịch: mã hết hạn, dịch vụ hủy báo lỗi, trạng thái đổi giữa chừng đều không báo thành công và làm lại được", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED", phone: "0911000010", bookingCode: BOOKING_CODE });
  const authorization = await bearerFor("0911000010");
  const statusOf = async () => (await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status;

  // 1. Mã xác nhận hết hạn.
  const first = await ask("hủy lịch hẹn giúp tôi", {}, authorization);
  const sessionId = first.body.data.sessionId;
  const stored = await prisma.chatbotSession.findUniqueOrThrow({ where: { id: sessionId } });
  await prisma.chatbotSession.update({
    where: { id: sessionId },
    data: { pendingAction: { ...(stored.pendingAction as Record<string, string>), expiresAt: new Date(Date.now() - 1000).toISOString() } },
  });
  const expired = await ask("Xác nhận hủy lịch", { sessionId, action: confirmOf(first) }, authorization);
  assert.match(expired.body.data.reply, /hết hạn/);
  assert.equal(await statusOf(), "CONFIRMED");

  // 2. Dịch vụ hủy báo lỗi nghiệp vụ sau khi đã giành quyền thực hiện: không báo thành công, lịch giữ nguyên, hỏi lại được.
  const second = await ask("hủy lịch hẹn giúp tôi", { sessionId }, authorization);
  const original = PatientPortalService.cancelAppointment.bind(PatientPortalService);
  PatientPortalService.cancelAppointment = async () => {
    throw new AppError("Không thể tự hủy trong 2 giờ trước giờ khám.", 409, "PATIENT_CANCEL_CUTOFF");
  };
  try {
    const failed = await ask("Xác nhận hủy lịch", { sessionId, action: confirmOf(second) }, authorization);
    assert.equal(failed.status, 200);
    assert.doesNotMatch(failed.body.data.reply, /Mình đã hủy/);
    assert.equal(failed.body.data.pendingAction, null);
  } finally {
    PatientPortalService.cancelAppointment = original;
  }
  assert.equal(await statusOf(), "CONFIRMED");

  // 3. Lịch đổi trạng thái (đã tiếp đón) giữa lúc tạo mã và lúc xác nhận: kiểm lại trước khi hủy, không hủy.
  const third = await ask("hủy lịch hẹn giúp tôi", { sessionId }, authorization);
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CHECKED_IN" } });
  const changed = await ask("Xác nhận hủy lịch", { sessionId, action: confirmOf(third) }, authorization);
  assert.doesNotMatch(changed.body.data.reply, /Mình đã hủy/);
  assert.equal(await statusOf(), "CHECKED_IN");
});

test("hai tin thường gửi đồng thời cùng phiên: lượt không lưu được nhận 409, không trả trạng thái chưa lưu", async () => {
  const first = await ask("Xin chào");
  const sessionId = first.body.data.sessionId;
  const before = await prisma.chatbotSession.findUniqueOrThrow({ where: { id: sessionId } });
  const results = await Promise.all([ask("Xin chào", { sessionId }), ask("bạn làm được gì", { sessionId })]);
  for (const item of results) assert.ok([200, 409].includes(item.status), String(item.status));
  const saved = results.filter((item) => item.status === 200).length;
  assert.ok(saved >= 1);
  for (const item of results.filter((entry) => entry.status === 409)) assert.equal(item.body.code, "CHATBOT_CONFLICT");
  const after = await prisma.chatbotSession.findUniqueOrThrow({ where: { id: sessionId } });
  // Mỗi câu trả lời 200 ứng với đúng một lần ghi phiên.
  assert.equal(after.version - before.version, saved);
});

test("tin cấp cứu khi đang chờ xác nhận hủy: trả lời cấp cứu trước, không hủy gì", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED", phone: "0911000011", bookingCode: BOOKING_CODE });
  const authorization = await bearerFor("0911000011");
  const asked = await ask("hủy lịch hẹn giúp tôi", {}, authorization);
  assert.equal(asked.body.data.state, "AWAITING_CONFIRMATION");
  const emergency = await ask("tôi đau ngực dữ dội, khó thở", { sessionId: asked.body.data.sessionId }, authorization);
  assert.equal(emergency.body.data.source, "EMERGENCY");
  assert.match(emergency.body.data.reply, /115/);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "CONFIRMED");
});

test("hạn giữ chatbot: mặc định chỉ đếm (dry-run), chỉ xóa khi bật delete", async () => {
  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const session = await prisma.chatbotSession.create({ data: { expiresAt: old, isActive: false } });
  await prisma.chatbotSession.update({ where: { id: session.id }, data: {} });
  await prisma.chatbotLog.create({ data: { sessionId: session.id, message: "cũ", response: "cũ", createdAt: old } });

  assert.equal(chatbotRetentionMode(undefined), "dry-run");
  assert.equal(chatbotRetentionMode("bat-ky"), "dry-run");
  const dryRun = await MaintenanceService.cleanupChatbotData(new Date(), "dry-run");
  assert.deepEqual(dryRun, { mode: "dry-run", sessions: 1, logs: 1 });
  assert.equal(await prisma.chatbotSession.count({ where: { id: session.id } }), 1);
  assert.equal(await prisma.chatbotLog.count(), 1);

  const off = await MaintenanceService.cleanupChatbotData(new Date(), "off");
  assert.equal(off.sessions, 0);

  const deleted = await MaintenanceService.cleanupChatbotData(new Date(), "delete");
  assert.deepEqual(deleted, { mode: "delete", sessions: 1, logs: 1 });
  assert.equal(await prisma.chatbotSession.count({ where: { id: session.id } }), 0);
});
