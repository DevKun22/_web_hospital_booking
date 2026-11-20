import ChatbotContextService from "../../src/services/chatbot/chatbot.context.js";
import KnowledgeService from "../../src/services/chatbot/rag/knowledge.service.js";
import { assert, authCookie, beforeEach, dashboardCall, fixture, http, prisma, test } from "./support/context.js";

// Chatbot chạy hết đường đi (an toàn → định tuyến → RAG → đặt lịch) trên DB thật. Môi trường test không có khóa AI nên
// phần phân tích ý định và sinh câu trả lời bằng AI lỗi, nhờ vậy kiểm được đúng các đường lùi không cần AI.

const ask = (message: string, extra: Record<string, unknown> = {}) =>
  http.request("/api/v1/chatbot/message", { method: "POST", body: { message, ...extra } });

// Kiểm đường lùi không cần AI một cách xác định, bất kể máy chạy test có khóa AI hay không.
for (const key of ["GEMINI_API_KEY", "FIREBASE_API_KEY", "API_KEY"]) process.env[key] = "";

beforeEach(async () => {
  // Bảng tri thức, FAQ và cấu hình không thuộc nhóm bảng được dọn ở mỗi ca.
  await prisma.chatKnowledgeChunk.deleteMany();
  await prisma.fAQ.deleteMany();
  await prisma.chatbotLog.deleteMany();
  KnowledgeService.invalidate();
  // Danh mục khoa, bác sĩ, lịch trống của chatbot được nhớ đệm; mỗi ca có dữ liệu mẫu mới.
  ChatbotContextService.invalidate();
});

test("câu chào, hỏi chức năng và cấp cứu được trả lời bằng quy tắc, không cần AI", async () => {
  const greeting = await ask("Xin chào");
  assert.equal(greeting.status, 200);
  assert.equal(greeting.body.data.source, "SYSTEM");
  assert.equal(greeting.body.data.intent, "GENERAL_HOSPITAL_INFO");

  const capabilities = await ask("bạn làm được gì?");
  assert.equal(capabilities.body.data.source, "SYSTEM");

  const emergency = await ask("tôi bị đau ngực dữ dội và khó thở nặng");
  assert.equal(emergency.body.data.source, "EMERGENCY");
  assert.equal(emergency.body.data.state, "EMERGENCY_CARE");
});

test("hỏi thông tin: trả lời từ FAQ, kèm nguồn, và nhật ký lưu mã đoạn đã dùng", async () => {
  await prisma.fAQ.create({
    data: { question: "Khám tổng quát có cần nhịn ăn không?", answer: "Bạn nên nhịn ăn 8 giờ trước khi lấy máu xét nghiệm.", keywords: ["nhịn ăn"] },
  });

  const response = await ask("Khám tổng quát có cần nhịn ăn không?");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.source, "FAQ");
  assert.equal(response.body.data.reply, "Bạn nên nhịn ăn 8 giờ trước khi lấy máu xét nghiệm.");
  assert.equal(response.body.data.sources.length, 1);
  assert.equal(response.body.data.sources[0].type, "FAQ");
  assert.equal(response.body.data.sources[0].url, "/hoi-dap");

  const log = await prisma.chatbotLog.findFirstOrThrow();
  assert.deepEqual(log.sourceIds, [response.body.data.sources[0].id]);
});

test("hỏi giá gói khám và chính sách: lấy từ dữ liệu nghiệp vụ, không cần FAQ", async () => {
  await prisma.package.create({
    data: {
      name: "Gói Tim Mạch Nâng Cao",
      slug: "goi-tim-mach-nang-cao",
      basePrice: 1_200_000,
      serviceFee: 50_000,
      departmentId: fixture.department.id,
      items: { create: [{ name: "Siêu âm tim" }, { name: "Điện tâm đồ" }] },
    },
  });

  const price = await ask("gói tim mạch nâng cao giá bao nhiêu");
  assert.equal(price.status, 200);
  assert.match(price.body.data.reply, /1\.250\.000 đồng/);
  assert.equal(price.body.data.sources[0].type, "PACKAGE");
  assert.equal(price.body.data.sources[0].url, "/goi-kham/goi-tim-mach-nang-cao");

  const policy = await ask("giữ lịch bao nhiêu phút để xác thực OTP");
  assert.equal(policy.body.data.sources[0].type, "POLICY");
  assert.match(policy.body.data.reply, /OTP/);
});

test("câu ngoài phạm vi không bịa câu trả lời mà dùng phản hồi dự phòng", async () => {
  await prisma.fAQ.create({ data: { question: "Giờ làm việc của bệnh viện?", answer: "Từ 7 giờ đến 17 giờ.", keywords: [] } });
  const response = await ask("hôm nay thời tiết thế nào");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.source, "FALLBACK");
  assert.equal(response.body.data.sources, undefined);
});

test("luồng đặt lịch bằng nút bấm vẫn do máy chủ dựng từ DB, không qua AI", async () => {
  const departments = await ask("Xem chuyên khoa", { action: { type: "VIEW_DEPARTMENTS" } });
  assert.equal(departments.status, 200);
  assert.equal(departments.body.data.source, "SYSTEM");
  const group = departments.body.data.results[0];
  assert.equal(group.type, "departments");
  assert.ok(group.items.some((item: { id: string }) => item.id === fixture.department.id));
  // Kun hỏi triệu chứng trước và chỉ hiện vài khoa, không đổ cả danh mục vào khung chat.
  assert.match(departments.body.data.reply, /triệu chứng/);
  assert.ok(group.items.length <= 4);

  const selected = await ask("Chọn chuyên khoa", {
    sessionId: departments.body.data.sessionId,
    action: { type: "SELECT_DEPARTMENT", payload: { departmentId: fixture.department.id } },
  });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.data.draft.departmentId, fixture.department.id);
  // Giao diện hiện lựa chọn bằng tên, không phải mã.
  assert.equal(selected.body.data.draftSummary.department.name, fixture.department.name);

  // Bỏ một lựa chọn: bản nháp và phần tóm tắt cùng sạch.
  const cleared = await ask("Bỏ chuyên khoa", {
    sessionId: departments.body.data.sessionId,
    draft: selected.body.data.draft,
    action: { type: "CLEAR_SELECTION", payload: { field: "department" } },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.draft.departmentId, undefined);
  assert.equal(cleared.body.data.draftSummary, undefined);
});

test("đồng bộ tri thức: chỉ dựng lại phần đổi, xóa đoạn của bản ghi đã bỏ, và cần quyền cấu hình", async () => {
  const faq = await prisma.fAQ.create({ data: { question: "Có nhận bảo hiểm y tế không?", answer: "Có, nhận BHYT đúng tuyến.", keywords: [] } });
  const cookie = await authCookie(fixture.adminUser.id, "ADMIN");

  const first = await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", cookie);
  assert.equal(first.status, 200);
  // FAQ + chuyên khoa + 2 bác sĩ + chính sách; chưa cấu hình thông tin cơ sở nên không có đoạn liên hệ.
  assert.equal(first.body.data.created, 5);
  assert.equal(first.body.data.deleted, 0);
  assert.equal(first.body.data.stats.total, 5);

  const again = await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", cookie);
  assert.equal(again.body.data.created, 0);
  assert.equal(again.body.data.updated, 0);

  await prisma.fAQ.update({ where: { id: faq.id }, data: { answer: "Có, nhận BHYT đúng tuyến và trái tuyến có điều kiện." } });
  const changed = await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", cookie);
  assert.equal(changed.body.data.updated, 1);

  await prisma.fAQ.delete({ where: { id: faq.id } });
  const removed = await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", cookie);
  assert.equal(removed.body.data.deleted, 1);
  assert.equal(removed.body.data.stats.total, 4);

  const unauthenticated = await http.request("/api/v1/dashboard/chatbot/knowledge/sync", { method: "POST" });
  assert.equal(unauthenticated.status, 401);
});

test("sau câu trả lời về gói khám: gợi ý bước tiếp theo theo chủ đề và hiểu 'gói này' ở câu kế tiếp", async () => {
  const pack = await prisma.package.create({
    data: {
      name: "Gói Tim Mạch Nâng Cao",
      slug: "goi-tim-mach-nang-cao",
      basePrice: 1_200_000,
      serviceFee: 50_000,
      departmentId: fixture.department.id,
      items: { create: [{ name: "Siêu âm tim" }, { name: "Điện tâm đồ" }] },
    },
  });

  const first = await ask("gói tim mạch nâng cao giá bao nhiêu");
  assert.equal(first.status, 200);
  const actions = first.body.data.suggestedActions as { type: string; label: string; payload: Record<string, unknown> }[];
  const select = actions.find((action) => action.type === "VIEW_PACKAGE");
  assert.equal(select?.payload.packageId, pack.id);
  const followUp = actions.find((action) => action.type === "ASK_QUESTION");
  assert.match(String(followUp?.payload.question), /Gói Tim Mạch Nâng Cao/);
  assert.equal(first.body.data.draft.focus.type, "package");
  assert.equal(first.body.data.draft.focus.id, pack.id);

  // Câu kế tiếp không nêu tên gói: Kun hiểu "gói này" từ chủ đề vừa nói.
  const next = await ask("gói này giá bao nhiêu", { sessionId: first.body.data.sessionId, draft: first.body.data.draft });
  assert.equal(next.status, 200);
  assert.match(next.body.data.reply, /1\.250\.000 đồng/);
});

test("câu chào và dự phòng đưa ra các hướng khác nhau thay vì một danh sách cố định", async () => {
  const greeting = await ask("Xin chào");
  const types = (greeting.body.data.suggestedActions as { type: string }[]).map((action) => action.type);
  assert.ok(types.includes("ASK_QUESTION"));
  assert.ok(types.includes("VIEW_PACKAGES"));

  const unknown = await ask("hôm nay thời tiết thế nào");
  const fallback = unknown.body.data.suggestedActions as { type: string; payload: Record<string, unknown> }[];
  assert.ok(fallback.some((action) => action.type === "ASK_QUESTION" && /triệu chứng/.test(String(action.payload.question))));

  // Nút hỏi thêm không có câu hỏi thì bị loại, không bao giờ đến người dùng.
  const empty = await ask("Xin chào");
  assert.ok((empty.body.data.suggestedActions as { type: string; payload: Record<string, unknown> }[]).every((action) => action.type !== "ASK_QUESTION" || action.payload.question));
});

test("nguồn là nội dung được duyệt kèm người duyệt và ngày cập nhật; nguồn khác thì không có", async () => {
  const updatedAt = new Date("2026-11-12T03:00:00.000Z");
  await prisma.department.update({
    where: { id: fixture.department.id },
    data: { symptomKeywords: ["đau ngực", "hồi hộp"], contentReviewerName: "TS.BS Trần Minh", contentUpdatedAt: updatedAt },
  });
  await prisma.fAQ.create({ data: { question: "Khám tổng quát có cần nhịn ăn không?", answer: "Bạn nên nhịn ăn 8 giờ.", keywords: [] } });
  KnowledgeService.invalidate();

  const reviewed = await ask("đau ngực hồi hộp");
  assert.equal(reviewed.status, 200);
  const source = reviewed.body.data.sources.find((item: { type: string }) => item.type === "DEPARTMENT");
  assert.ok(source, "phải có nguồn là chuyên khoa");
  assert.equal(source.reviewedBy, "TS.BS Trần Minh");
  assert.equal(source.updatedAt, updatedAt.toISOString());

  const faq = await ask("Khám tổng quát có cần nhịn ăn không?");
  assert.equal(faq.body.data.sources[0].type, "FAQ");
  assert.equal(faq.body.data.sources[0].updatedAt, undefined);
});
