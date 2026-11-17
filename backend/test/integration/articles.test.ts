import KnowledgeService from "../../src/services/chatbot/rag/knowledge.service.js";
import ChatbotContextService from "../../src/services/chatbot/chatbot.context.js";
import { assert, authCookie, beforeEach, dashboardCall, fixture, http, prisma, test } from "./support/context.js";

// Bài viết kiến thức sức khỏe: người viết lưu bản nháp → bác sĩ duyệt bằng tài khoản của mình → quản trị xuất bản.
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

const cookies = async () => ({
  admin: await authCookie(fixture.adminUser.id, "ADMIN"),
  doctor: await authCookie(fixture.doctorOneUser.id, "DOCTOR"),
  doctorTwo: await authCookie(fixture.doctorTwoUser.id, "DOCTOR"),
});

const createArticle = async (cookie: string, extra: Record<string, unknown> = {}) => {
  const created = await dashboardCall("POST", "/api/v1/dashboard/articles", cookie, {
    title: "Ăn uống khi trời nắng nóng",
    summary: "Gợi ý ăn uống và uống nước mùa nóng.",
    content: LONG_BODY,
    category: "Dinh dưỡng",
    departmentId: fixture.department.id,
    ...extra,
  });
  assert.equal(created.status, 201);
  return created.body.data as { id: string; slug: string; status: string; authorName: string };
};

test("luồng duyệt: bản nháp ẩn, chưa duyệt thì chưa xuất bản, bác sĩ duyệt bằng tài khoản rồi quản trị xuất bản", async () => {
  const { admin, doctor } = await cookies();
  const article = await createArticle(admin);
  assert.equal(article.status, "DRAFT");
  assert.equal(article.slug, "an-uong-khi-troi-nang-nong");
  assert.equal(article.authorName, "Phase 0 Admin");

  assert.equal((await http.request("/api/v1/articles/an-uong-khi-troi-nang-nong")).status, 404);

  // Chưa có bác sĩ duyệt.
  const early = await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin);
  assert.equal(early.status, 400);
  assert.match(early.body.message, /chưa được bác sĩ duyệt/);

  // Quản trị không phải người duyệt nội dung.
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, admin)).status, 403);

  const reviewed = await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.reviewerName, "Doctor One");
  assert.ok(reviewed.body.data.reviewedAt);

  const published = await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin);
  assert.equal(published.status, 200);
  assert.equal(published.body.data.status, "PUBLISHED");

  const list = await http.request("/api/v1/articles");
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.items[0].content, undefined);
  assert.equal(list.body.data.items[0].reviewedById, undefined, "trang công khai không lộ mã tài khoản nhân sự");
  assert.equal(list.body.data.items[0].authorId, undefined);
  assert.deepEqual(list.body.data.categories, [{ name: "Dinh dưỡng", count: 1 }]);
  const detail = await http.request("/api/v1/articles/an-uong-khi-troi-nang-nong");
  assert.equal(detail.body.data.reviewerName, "Doctor One");
  assert.match(detail.body.data.content, /uống đủ nước/);
});

test("người viết không tự duyệt bài của mình; bác sĩ khác duyệt được", async () => {
  const { doctor, doctorTwo } = await cookies();
  const article = await createArticle(doctor);
  const self = await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  assert.equal(self.status, 403);
  assert.match(self.body.message, /không tự duyệt/);
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctorTwo)).status, 200);
});

test("bác sĩ không xuất bản và không sửa bài đã xuất bản; sửa nội dung xóa dấu duyệt và đưa bài về bản nháp", async () => {
  const { admin, doctor } = await cookies();
  const article = await createArticle(admin);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, doctor)).status, 403);
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin)).status, 200);

  assert.equal((await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, doctor, { summary: "Sửa lén" })).status, 403);

  // Đổi phân loại không làm mất dấu duyệt (nội dung không đổi).
  const category = await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, admin, { category: "Phòng bệnh" });
  assert.equal(category.status, 200);
  assert.equal(category.body.data.status, "PUBLISHED");
  assert.ok(category.body.data.reviewedAt);

  // Sửa nội dung: bài về nháp, dấu duyệt bị xóa, biến mất khỏi website.
  const edited = await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, admin, { content: `${LONG_BODY}\n\nThêm một đoạn mới.` });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.status, "DRAFT");
  assert.equal(edited.body.data.reviewedAt, null);
  assert.equal(edited.body.data.reviewerName, null);
  assert.equal((await http.request("/api/v1/articles/an-uong-khi-troi-nang-nong")).status, 404);
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin)).status, 400);
});

test("đường dẫn đổi được khi còn nháp và khóa sau lần xuất bản đầu, kể cả khi gỡ rồi xuất bản lại", async () => {
  const { admin, doctor } = await cookies();
  const article = await createArticle(admin);
  const renamed = await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, admin, { slug: "nang-nong-an-uong" });
  assert.equal(renamed.body.data.slug, "nang-nong-an-uong");

  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin);
  const locked = await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, admin, { slug: "doi-lai" });
  assert.equal(locked.status, 400);
  assert.match(locked.body.message, /không đổi được/);

  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/unpublish`, admin);
  assert.equal((await dashboardCall("PATCH", `/api/v1/dashboard/articles/${article.id}`, admin, { slug: "doi-lai" })).status, 400);
  // Gỡ không làm mất dấu duyệt nên xuất bản lại được ngay.
  assert.equal((await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin)).status, 200);
});

test("danh sách quản trị lọc theo giai đoạn: chờ duyệt, đã duyệt chờ xuất bản, đã xuất bản", async () => {
  const { admin, doctor } = await cookies();
  const pending = await createArticle(admin, { title: "Bài chờ duyệt" });
  const ready = await createArticle(admin, { title: "Bài đã duyệt" });
  const live = await createArticle(admin, { title: "Bài đã xuất bản" });
  await dashboardCall("POST", `/api/v1/dashboard/articles/${ready.id}/review`, doctor);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${live.id}/review`, doctor);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${live.id}/publish`, admin);

  const idsFor = async (stage: string) =>
    ((await dashboardCall("GET", `/api/v1/dashboard/articles?stage=${stage}`, admin)).body.data.items as { id: string }[]).map((item) => item.id);
  assert.deepEqual(await idsFor("PENDING_REVIEW"), [pending.id]);
  assert.deepEqual(await idsFor("READY"), [ready.id]);
  assert.deepEqual(await idsFor("PUBLISHED"), [live.id]);
});

test("bài đã xuất bản thành nguồn tri thức: chatbot trả lời kèm liên kết tới đúng mục và lời nhắc tham khảo", async () => {
  const { admin, doctor } = await cookies();
  const article = await createArticle(admin);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin);

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
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/unpublish`, admin);
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

test("câu hỏi nối tiếp ngắn vẫn hiểu chủ đề của câu trước và dẫn tới đúng bài viết", async () => {
  const { admin, doctor } = await cookies();
  const article = await createArticle(admin);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/review`, doctor);
  await dashboardCall("POST", `/api/v1/dashboard/articles/${article.id}/publish`, admin);
  await dashboardCall("POST", "/api/v1/dashboard/chatbot/knowledge/sync", admin);

  const first = await ask("ăn uống thế nào khi trời nắng nóng");
  assert.equal(first.body.data.sources[0].type, "ARTICLE");
  const next = await http.request("/api/v1/chatbot/message", { method: "POST", body: { sessionId: first.body.data.sessionId, message: "khi nào cần đi khám" } });
  assert.equal(next.status, 200);
  assert.equal(next.body.data.sources[0].url, "/kien-thuc/an-uong-khi-troi-nang-nong#khi-nao-can-di-kham");
});
