import { assert, http, prisma, test } from "./support/context.js";
import PublicSearchService from "../../src/services/search/search.service.js";

// Tìm kiếm công khai bằng full-text Postgres trên view vật chất SearchDocument: khớp không dấu, tiền tố, nhiều trường,
// gõ sai (trigram) và làm mới sau khi nội dung đổi.
type Item = { id: string; type: string; title: string; departmentName?: string | null; price?: number | null; url: string };

const search = async (q: string, type = "all") => {
  const response = await http.request("/api/v1/search?q=" + encodeURIComponent(q) + "&type=" + type);
  assert.equal(response.status, 200);
  return response.body.data.items as Item[];
};

const seedCatalog = async () => {
  const heart = await prisma.department.create({
    data: { name: "Tim mạch", slug: "tim-mach", description: "Khám các bệnh lý tim và mạch máu", symptomKeywords: ["đau ngực", "hồi hộp"] },
  });
  const skin = await prisma.department.create({ data: { name: "Da liễu", slug: "da-lieu" } });
  const doctorUser = await prisma.user.create({
    data: { fullName: "Nguyễn Minh Hùng", email: "hung.search@example.test", phone: "0901000111", role: "DOCTOR", isEmailVerified: true },
  });
  const doctor = await prisma.doctorProfile.create({
    data: {
      slug: "nguyen-minh-hung",
      userId: doctorUser.id,
      departmentId: heart.id,
      title: "BS.CKII",
      specialization: "Can thiệp tim mạch",
      bio: "Hơn hai mươi năm kinh nghiệm",
      consultationFee: 300000,
    },
  });
  const pack = await prisma.package.create({
    data: {
      name: "Gói khám sức khỏe tổng quát",
      slug: "goi-kham-tong-quat",
      departmentId: heart.id,
      basePrice: 1_000_000,
      serviceFee: 50_000,
      isPopular: true,
      summary: "Kiểm tra toàn diện",
      items: { create: [{ name: "Điện tâm đồ", price: 200_000, included: true }, { name: "Siêu âm tim", price: 300_000, included: true }] },
    },
  });
  const faq = await prisma.fAQ.create({
    data: { question: "Làm sao để hủy lịch hẹn?", answer: "Vào mục lịch hẹn và chọn hủy.", category: "booking", keywords: ["hủy lịch"] },
  });
  await PublicSearchService.refresh();
  return { heart, skin, doctor, pack, faq };
};

test("search matches Vietnamese text without accents, by prefix and across fields", async () => {
  const { heart, doctor, pack, faq } = await seedCatalog();

  assert.deepEqual((await search("tim mach", "department")).map((item) => item.id), [heart.id]);
  assert.deepEqual((await search("Tim Mạch", "department")).map((item) => item.id), [heart.id]);
  // Gõ dở vẫn khớp tiền tố.
  assert.ok((await search("tim ma", "department")).some((item) => item.id === heart.id));
  // Từ khóa triệu chứng và nội dung.
  assert.ok((await search("dau nguc")).some((item) => item.id === heart.id));
  // Bác sĩ: họ tên (có chức danh) kết hợp tên chuyên khoa ở trường khác.
  const byName = await search("nguyen minh hung tim mach", "doctor");
  assert.deepEqual(byName.map((item) => item.id), [doctor.id]);
  assert.equal(byName[0].departmentName, "Tim mạch");
  assert.equal(byName[0].price, 300000);
  // Gói khám: tên hạng mục bên trong gói, giá = tổng hạng mục đã gồm + phí dịch vụ.
  const byItem = await search("dien tam do", "package");
  assert.deepEqual(byItem.map((item) => item.id), [pack.id]);
  assert.equal(byItem[0].price, 550_000);
  // Hỏi đáp: có danh mục thì dẫn tới trang hỏi đáp theo danh mục.
  const answers = await search("huy lich", "faq");
  assert.deepEqual(answers.map((item) => item.id), [faq.id]);
  assert.equal(answers[0].url, "/hoi-dap?category=booking");
});

test("every word must match, the type filter applies, and junk input is safe", async () => {
  await seedCatalog();
  // Bốn từ không có mục nào chứa đủ: không khớp từ và quá dài để khớp gần đúng.
  assert.deepEqual(await search("tim mach da lieu nhi"), []);
  assert.deepEqual(await search("tim mach", "faq"), []);
  assert.deepEqual(await search("x"), []);
  assert.deepEqual(await search("!!! ... :*"), []);
  // Ký tự đặc biệt của tsquery/SQL không làm hỏng truy vấn.
  assert.equal((await http.request("/api/v1/search?q=" + encodeURIComponent("tim' | !mach & (x):* --"))).status, 200);
});

test("title matches rank above body-only matches", async () => {
  const { heart } = await seedCatalog();
  const ranked = await search("tim mach");
  assert.equal(ranked[0].id, heart.id);
  assert.ok(ranked.length >= 3);
});

test("a typo falls back to trigram similarity on the title", async () => {
  const { heart } = await seedCatalog();
  const fuzzy = await search("tim mahc", "department");
  assert.deepEqual(fuzzy.map((item) => item.id), [heart.id]);
});

test("content changes show up after a refresh and inactive items are excluded", async () => {
  const { skin } = await seedCatalog();
  assert.equal((await search("da lieu", "department")).length, 1);

  await prisma.department.update({ where: { id: skin.id }, data: { isActive: false } });
  // View vật chất giữ ảnh chụp cho tới khi làm mới.
  assert.equal((await search("da lieu", "department")).length, 1);
  await PublicSearchService.refresh();
  assert.equal((await search("da lieu", "department")).length, 0);
});
