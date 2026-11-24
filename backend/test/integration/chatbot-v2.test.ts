import ChatbotContextService from "../../src/services/chatbot/chatbot.context.js";
import KnowledgeService from "../../src/services/chatbot/rag/knowledge.service.js";
import geminiAdapter from "../../src/services/chatbot/ai/gemini.adapter.js";
import { assert, beforeEach, createStoredAppointment, dateOnly, fixture, futureDate, http, loginPatient, prisma, test } from "./support/context.js";

// Chatbot V2 trên DB thật, AI được thay bằng bản giả (không gọi Gemini): danh tính chỉ từ token, phiên do máy chủ giữ,
// lịch hẹn cá nhân cần đăng nhập, hủy lịch phải xác nhận đúng mã một lần, lịch trống lọc buổi trước khi giới hạn số dòng.

for (const key of ["GEMINI_API_KEY", "FIREBASE_API_KEY", "API_KEY"]) process.env[key] = "";

const ask = (message: string, extra: Record<string, unknown> = {}, authorization?: string) =>
  http.request("/api/v1/chatbot/message", {
    method: "POST",
    body: { message, ...extra },
    headers: authorization ? { authorization } : undefined,
  });

const BOOKING_CODE = "BK20261124000001";

/** Thay AI bằng bản giả trả đúng JSON phân tích ý định cho trước; khôi phục sau mỗi ca. */
const originalGenerate = geminiAdapter.generateReply.bind(geminiAdapter);
const fakeNlu = (operation: string, entities: Record<string, unknown> = {}) => {
  geminiAdapter.generateReply = async () => JSON.stringify({ operation, entities, confidence: 0.95 });
};

beforeEach(async () => {
  geminiAdapter.generateReply = originalGenerate;
  await prisma.chatKnowledgeChunk.deleteMany();
  await prisma.chatbotLog.deleteMany();
  await prisma.chatbotSession.deleteMany();
  KnowledgeService.invalidate();
  ChatbotContextService.invalidate();
});

const bearerFor = async (phone: string) => `Bearer ${(await loginPatient(phone)).accessToken}`;

test("khách hỏi lịch hẹn của mình: được mời đăng nhập, không lộ gì; token sai bị từ chối 401", async () => {
  const guest = await ask("xem lịch hẹn của tôi");
  assert.equal(guest.status, 200);
  assert.equal(guest.body.data.contractVersion, 2);
  assert.equal(typeof guest.body.data.traceId, "string");
  assert.equal(guest.body.data.state, "LOGIN_REQUIRED");
  assert.ok(guest.body.data.suggestedActions.some((action: { type: string }) => action.type === "LOGIN_REQUIRED"));
  assert.equal(guest.body.data.results, undefined);

  const invalid = await ask("xem lịch hẹn của tôi", {}, "Bearer khong-hop-le");
  assert.equal(invalid.status, 401);
});

test("người khám đã đăng nhập xem lịch của mình; nhật ký không lưu chi tiết lịch, vết không chứa mã lịch", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED", phone: "0911000001", bookingCode: BOOKING_CODE });
  const authorization = await bearerFor("0911000001");

  const response = await ask("xem lịch hẹn của tôi", {}, authorization);
  assert.equal(response.status, 200);
  const group = response.body.data.results[0];
  assert.equal(group.type, "appointments");
  assert.equal(group.items[0].id, appointment.id);
  assert.equal(group.items[0].bookingCode, BOOKING_CODE);
  assert.equal(group.items[0].canCancel, true);
  // Thẻ không mang tên, liên hệ hay lý do khám của người khám.
  assert.equal(group.items[0].patientName, undefined);

  const log = await prisma.chatbotLog.findFirstOrThrow({ where: { sessionId: response.body.data.sessionId } });
  assert.doesNotMatch(log.response, new RegExp(BOOKING_CODE));
  assert.equal((log.trace as { traceId: string }).traceId, response.body.data.traceId);
  assert.doesNotMatch(JSON.stringify(log.trace), new RegExp(BOOKING_CODE));
  assert.equal((log.trace as { authenticated: boolean }).authenticated, true);
});

test("hủy lịch: hỏi xác nhận, chỉ đúng mã một lần mới hủy; bấm lại hoặc bấm đồng thời không hủy thêm", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED", phone: "0911000002", bookingCode: BOOKING_CODE });
  const authorization = await bearerFor("0911000002");

  const asked = await ask("hủy lịch hẹn giúp tôi", {}, authorization);
  assert.equal(asked.status, 200);
  assert.equal(asked.body.data.state, "AWAITING_CONFIRMATION");
  assert.equal(asked.body.data.pendingAction.type, "CANCEL_APPOINTMENT");
  const confirm = asked.body.data.suggestedActions.find((action: { type: string }) => action.type === "CONFIRM_CANCEL_APPOINTMENT");
  assert.ok(confirm, "phải có nút xác nhận");
  // Chưa xác nhận thì chưa hủy.
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "CONFIRMED");

  // Mã sai không làm gì.
  const wrong = await ask("Xác nhận hủy lịch", { sessionId: asked.body.data.sessionId, action: { type: "CONFIRM_CANCEL_APPOINTMENT", payload: { nonce: "00000000-0000-4000-8000-000000000000" } } }, authorization);
  assert.equal(wrong.status, 200);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "CONFIRMED");

  // Hai lần bấm đồng thời với đúng mã: chỉ một lần hủy, lần còn lại báo đã xử lý.
  const sessionId = wrong.body.data.sessionId;
  const confirmBody = { sessionId, action: { type: "CONFIRM_CANCEL_APPOINTMENT", payload: confirm.payload } };
  const [first, second] = await Promise.all([ask("Xác nhận hủy lịch", confirmBody, authorization), ask("Xác nhận hủy lịch", confirmBody, authorization)]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const cancelledReplies = [first, second].filter((item) => /Mình đã hủy/.test(item.body.data.reply));
  assert.equal(cancelledReplies.length, 1);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, "CANCELLED_BY_PATIENT");

  const again = await ask("Xác nhận hủy lịch", confirmBody, authorization);
  assert.equal(again.status, 200);
  assert.doesNotMatch(again.body.data.reply, /Mình đã hủy/);
});

test("không chọn hay hủy được lịch của tài khoản khác, kể cả khi biết mã lịch và mã phiên", async () => {
  const owner = await createStoredAppointment({ status: "CONFIRMED", phone: "0911000003", bookingCode: BOOKING_CODE });
  const ownerAuth = await bearerFor("0911000003");
  const asked = await ask("hủy lịch hẹn giúp tôi", {}, ownerAuth);
  const confirm = asked.body.data.suggestedActions.find((action: { type: string }) => action.type === "CONFIRM_CANCEL_APPOINTMENT");

  await prisma.user.create({ data: { fullName: "Người khác", email: "nguoi-khac@example.test", phone: "0911000004", role: "PATIENT", isEmailVerified: true } });
  const otherAuth = await bearerFor("nguoi-khac@example.test");

  // Dùng mã phiên của chủ lịch: máy chủ không gắn phiên đó cho tài khoản khác mà mở phiên mới, nên mã xác nhận vô hiệu.
  const hijack = await ask("Xác nhận hủy lịch", { sessionId: asked.body.data.sessionId, action: { type: "CONFIRM_CANCEL_APPOINTMENT", payload: confirm.payload } }, otherAuth);
  assert.equal(hijack.status, 200);
  assert.notEqual(hijack.body.data.sessionId, asked.body.data.sessionId);
  const select = await ask("Hủy lịch", { action: { type: "SELECT_APPOINTMENT", payload: { appointmentId: owner.id } } }, otherAuth);
  assert.match(select.body.data.reply, /không tìm thấy lịch này/);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: owner.id } })).status, "CONFIRMED");
});

test("phiên: bản nháp của client bị bỏ qua; đăng nhập thì xoay phiên mang theo lựa chọn; đăng xuất thì phiên mới trống", async () => {
  // Client gửi bản nháp tự bịa ở phiên mới: không được nhận.
  const forged = await ask("Xin chào", { draft: { departmentId: "11111111-1111-4111-8111-111111111111" } });
  assert.equal(forged.body.data.draft.departmentId, undefined);

  const guest = await ask("Chọn chuyên khoa", { action: { type: "SELECT_DEPARTMENT", payload: { departmentId: fixture.department.id } } });
  assert.equal(guest.body.data.draft.departmentId, fixture.department.id);

  await prisma.user.create({ data: { fullName: "Người khám xoay phiên", email: "xoay-phien@example.test", phone: "0911000005", role: "PATIENT", isEmailVerified: true } });
  const authorization = await bearerFor("xoay-phien@example.test");
  const loggedIn = await ask("Xin chào", { sessionId: guest.body.data.sessionId }, authorization);
  assert.notEqual(loggedIn.body.data.sessionId, guest.body.data.sessionId);
  assert.equal(loggedIn.body.data.draft.departmentId, fixture.department.id);
  const rotated = await prisma.chatbotSession.findUniqueOrThrow({ where: { id: loggedIn.body.data.sessionId } });
  assert.ok(rotated.userId);
  assert.equal((await prisma.chatbotSession.findUniqueOrThrow({ where: { id: guest.body.data.sessionId } })).isActive, false);

  // Khách dùng lại mã phiên đã gắn tài khoản: phiên mới, không mang ngữ cảnh của tài khoản.
  const loggedOut = await ask("Xin chào", { sessionId: loggedIn.body.data.sessionId });
  assert.notEqual(loggedOut.body.data.sessionId, loggedIn.body.data.sessionId);
  assert.equal(loggedOut.body.data.draft.departmentId, undefined);
});

test("lịch trống buổi chiều: lọc trong truy vấn trước khi giới hạn, không bị 20 khung buổi sáng che mất", async () => {
  const date = futureDate(9);
  const morning = Array.from({ length: 24 }, (_, index) => {
    const minutes = 7 * 60 + index * 10;
    const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
    return { doctorId: fixture.doctorOne.id, date: dateOnly(date), startTime: time(minutes), endTime: time(minutes + 10) };
  });
  const afternoon = ["13:00", "14:00", "15:30"].map((startTime) => ({ doctorId: fixture.doctorOne.id, date: dateOnly(date), startTime, endTime: `${startTime.slice(0, 3)}50` }));
  await prisma.doctorTimeSlot.createMany({ data: [...morning, ...afternoon] });

  const selected = await ask("Chọn bác sĩ", { action: { type: "SELECT_DOCTOR", payload: { doctorId: fixture.doctorOne.id, departmentId: fixture.department.id } } });
  const [year, month, day] = date.split("-");
  fakeNlu("SEARCH_SLOT");
  const response = await ask(`chiều ngày ${day}/${month}/${year} còn lịch không`, { sessionId: selected.body.data.sessionId });
  assert.equal(response.status, 200);
  const slots = response.body.data.results?.find((group: { type: string }) => group.type === "slots");
  assert.ok(slots, "phải có danh sách khung giờ");
  assert.ok(slots.items.length >= 3);
  for (const item of slots.items) assert.ok(item.startTime >= "12:00", item.startTime);

  // Hỏi đúng một giờ: nói rõ giờ đó còn trống và không nói là đã giữ chỗ.
  const exact = await ask(`14 giờ ngày ${day}/${month}/${year}`, { sessionId: response.body.data.sessionId });
  assert.match(exact.body.data.reply, /Khung 14:00/);
  assert.doesNotMatch(exact.body.data.reply, /đã giữ/);
});

test("cấp cứu luôn ưu tiên và có số 115", async () => {
  const response = await ask("bố tôi vừa bị ngất, khó thở");
  assert.equal(response.body.data.source, "EMERGENCY");
  assert.match(response.body.data.reply, /115/);
});

test("vết xử lý chỉ xem được với quyền dashboard", async () => {
  const response = await ask("Xin chào");
  const anonymous = await http.request(`/api/v1/dashboard/chatbot/traces/${response.body.data.traceId}`);
  assert.equal(anonymous.status, 401);
});
