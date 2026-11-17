import KnowledgeService from "../../src/services/chatbot/rag/knowledge.service.js";
import ChatbotContextService from "../../src/services/chatbot/chatbot.context.js";
import { assert, authCookie, beforeEach, dashboardCall, fixture, http, prisma, test } from "./support/context.js";

// Bài viết kiến thức sức khỏe: soạn bản nháp, người duyệt xuất bản, hiện công khai và thành nguồn tri thức của chatbot.
// Môi trường test không có khóa AI nên chatbot trả nguyên văn đoạn khớp nhất (đường lùi), đủ để kiểm nguồn và lời nhắc.

for (const key of ["GEMINI_API_KEY"]) process.env[key] = "";

const LONG_BODY = [
  "## Ăn uống khi trời nắng nóng",
  "Khi trời nắng nóng, bạn nên uống đủ nước trong ngày, chia thành nhiều lần nhỏ thay vì uống một lần thật nhiều. Ưu tiên rau củ quả tươi, các món canh và trái cây giàu nước như dưa hấu, cam, bưởi.",
  "Hạn chế đồ chiên rán nhiều dầu mỡ, đồ uống có cồn và nước ngọt có ga vì dễ làm cơ thể mất nước và khó chịu.",
  "## Khi nào cần đi khám",
  "Nếu bạn có dấu hiệu mệt lả, chóng mặt kéo dài, buồn nôn, nhịp tim nhanh hoặc ngất trong khi trời nóng, hãy nghỉ ở nơi mát và đến cơ sở y tế gần nhất để được kiểm tra.",
].join("\n\n");

beforeEach(async () => {
  await prisma.chatKnowledgeChunk.deleteMany();
  await prisma.article.deleteMany();
  await prisma.fAQ.deleteMany();
  KnowledgeService.invalidate();
  ChatbotContextService.invalidate();
});

const ask = (message: string) => http.request("/api/v1/chatbot/message", { method: "POST", body: { message } });

test("bản nháp chưa hiện công khai; xuất bản cần người duyệt và đủ nội dung", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  const created = await dashboardCall("POST", "/api/v1/dashboard/articles", admin, {
    title: "Ăn uống khi trời nắng nóng",
    summary: "Gợi ý ăn uống và uống nước mùa nóng.",
    content: LONG_BODY,
    category: "Dinh dưỡng",
    departmentId: fixture.department.id,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, "DRAFT");
  assert.equal(created.body.data.slug, "an-uong-khi-troi-nang-nong");
  assert.equal(created.body.data.authorName, "Phase 0 Admin");
  const id = created.body.data.id as string;

  assert.equal((await http.request("/api/v1/articles/an-uong-khi-troi-nang-nong")).status, 404);
  assert.equal((await http.request("/api/v1/articles")).body.data.items.length, 0);

  // Thiếu người duyệt.
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${id}/publish`, admin, {})).status, 400);

  // Nội dung quá ngắn.
  const shortArticle = await dashboardCall("POST", "/api/v1/dashboard/articles", admin, { title: "Bài ngắn", content: "Quá ngắn." });
  const tooShort = await dashboardCall("POST", `/api/v1/dashboard/articles/${shortArticle.body.data.id}/publish`, admin, { reviewerName: "BS Hùng" });
  assert.equal(tooShort.status, 400);

  const published = await dashboardCall("POST", `/api/v1/dashboard/articles/${id}/publish`, admin, { reviewerName: "BS.CKII Nguyễn Minh Hùng" });
  assert.equal(published.status, 200);
  assert.equal(published.body.data.status, "PUBLISHED");
  assert.equal(published.body.data.reviewerName, "BS.CKII Nguyễn Minh Hùng");

  const list = await http.request("/api/v1/articles");
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.items[0].content, undefined);
  assert.deepEqual(list.body.data.categories, [{ name: "Dinh dưỡng", count: 1 }]);
  const detail = await http.request("/api/v1/articles/an-uong-khi-troi-nang-nong");
  assert.equal(detail.status, 200);
  assert.match(detail.body.data.content, /uống đủ nước/);
});

test("bác sĩ chỉ soạn nháp: không xuất bản, không sửa bài đã xuất bản; quản trị gỡ thì bài biến mất khỏi công khai", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctor = await authCookie(fixture.doctorOneUser.id, "DOCTOR");

  const draft = await dashboardCall("POST", "/api/v1/dashboard/articles", doctor, { title: "Giấc ngủ cho người lớn", content: LONG_BODY });
  assert.equal(draft.status, 201);
  const id = draft.body.data.id as string;
  assert.equal((await dashboardCall("PATCH", `/api/v1/dashboard/articles/${id}`, doctor, { summary: "Tóm tắt" })).status, 200);
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${id}/publish`, doctor, { reviewerName: "Tôi" })).status, 403);

  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${id}/publish`, admin, { reviewerName: "BS Hùng" })).status, 200);
  assert.equal((await dashboardCall("PATCH", `/api/v1/dashboard/articles/${id}`, doctor, { summary: "Sửa lén" })).status, 403);
  assert.equal((await dashboardCall("PATCH", `/api/v1/dashboard/articles/${id}`, admin, { summary: "Quản trị sửa" })).status, 200);

  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${id}/unpublish`, admin)).status, 200);
  assert.equal((await http.request("/api/v1/articles/giac-ngu-cho-nguoi-lon")).status, 404);
});

test("bài đã xuất bản thành nguồn tri thức: chatbot trả lời kèm liên kết tới đúng mục và lời nhắc tham khảo", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  const created = await dashboardCall("POST", "/api/v1/dashboard/articles", admin, { title: "Ăn uống khi trời nắng nóng", content: LONG_BODY });
  await dashboardCall("POST", `/api/v1/dashboard/articles/${created.body.data.id}/publish`, admin, { reviewerName: "BS Hùng" });

  const sync = await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", admin);
  assert.equal(sync.status, 200);
  assert.ok(sync.body.data.stats.byType.ARTICLE >= 2, "mỗi mục của bài là một đoạn tri thức");

  const answer = await ask("khi nào cần đi khám nếu mệt lả chóng mặt trời nóng");
  assert.equal(answer.status, 200);
  const sources = answer.body.data.sources as { type: string; url: string }[];
  assert.equal(sources[0].type, "ARTICLE");
  assert.equal(sources[0].url, "/kien-thuc/an-uong-khi-troi-nang-nong#khi-nao-can-di-kham");
  assert.match(answer.body.data.reply, /không thay thế tư vấn của bác sĩ/);

  // Gỡ bài: tri thức cũng biến mất sau lần đồng bộ kế tiếp.
  await dashboardCall("POST", `/api/v1/dashboard/articles/${created.body.data.id}/unpublish`, admin);
  await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", admin);
  const after = await ask("khi nào cần đi khám nếu mệt lả chóng mặt trời nóng");
  assert.notEqual(after.body.data.sources?.[0]?.type, "ARTICLE");
});

test("hỏi lại đúng câu chưa có thông tin thì Kun không lặp y nguyên mà đưa người dùng tới nhân viên", async () => {
  await prisma.fAQ.create({ data: { question: "Giờ làm việc của bệnh viện?", answer: "Từ 7 giờ đến 17 giờ.", keywords: [] } });
  const first = await ask("hôm nay thời tiết thế nào");
  const second = await http.request("/api/v1/chatbot/message", { method: "POST", body: { sessionId: first.body.data.sessionId, message: "hôm nay thời tiết thế nào" } });
  assert.equal(second.status, 200);
  assert.notEqual(second.body.data.reply, first.body.data.reply);
  assert.equal(second.body.data.suggestedActions[0].type, "CONTACT_STAFF");
});
