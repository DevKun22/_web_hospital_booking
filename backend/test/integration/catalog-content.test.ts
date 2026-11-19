import { assert, authCookie, dashboardHeaders, fixture, http, prisma, test } from "./support/context.js";

// Nội dung công khai của chuyên khoa, gói khám, bác sĩ: lưu theo cấu trúc, bác sĩ soạn rồi quản trị duyệt mới hiện.

const admin = async () => dashboardHeaders(await authCookie(fixture.adminUser.id, "ADMIN"));
const doctor = async () => dashboardHeaders(await authCookie(fixture.doctorOneUser.id, "DOCTOR"));

const draft = {
  bio: "Tiểu sử do bác sĩ soạn",
  motto: "Tận tâm với người bệnh",
  careerTimeline: [{ period: "2010-2015", place: "Bệnh viện A", role: "Bác sĩ điều trị" }],
  memberships: ["Hội Tim mạch"],
  expertise: ["Siêu âm tim", "Tăng huyết áp"],
};

test("department sections are saved with an update time and shown on the public page", async () => {
  const headers = await admin();
  const sections = [
    { title: "Tổng quan", body: "Khám và điều trị bệnh lý chuyên khoa." },
    { title: "Thiết bị", body: "Máy siêu âm, điện tim." },
  ];
  const saved = await http.request(`/api/v1/dashboard/departments/${fixture.department.id}`, {
    method: "PATCH",
    headers,
    body: { sections, contentReviewerName: "PGS.TS Nguyễn Văn A" },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  const publicPage = await http.request(`/api/v1/departments/${fixture.department.slug}`);
  assert.equal(publicPage.status, 200, JSON.stringify(publicPage.body));
  assert.deepEqual(publicPage.body.data.sections, sections);
  assert.equal(publicPage.body.data.contentReviewerName, "PGS.TS Nguyễn Văn A");
  assert.ok(publicPage.body.data.contentUpdatedAt);

  // Quá nhiều mục hoặc mục rỗng bị từ chối, nội dung cũ giữ nguyên.
  const tooMany = await http.request(`/api/v1/dashboard/departments/${fixture.department.id}`, {
    method: "PATCH",
    headers,
    body: { sections: Array.from({ length: 9 }, (_, index) => ({ title: `Mục ${index}`, body: "x" })) },
  });
  assert.equal(tooMany.status, 400);
  const empty = await http.request(`/api/v1/dashboard/departments/${fixture.department.id}`, {
    method: "PATCH",
    headers,
    body: { sections: [{ title: "", body: "x" }] },
  });
  assert.equal(empty.status, 400);
});

test("package audience, result time and FAQ are saved and public", async () => {
  const headers = await admin();
  const created = await prisma.package.create({
    data: {
      name: "Gói kiểm thử nội dung",
      slug: "goi-kiem-thu-noi-dung",
      basePrice: 500000,
      items: { create: [{ name: "Xét nghiệm máu", included: true }] },
    },
  });
  const saved = await http.request(`/api/v1/dashboard/packages/${created.id}`, {
    method: "PATCH",
    headers,
    body: {
      audience: ["Người trên 40 tuổi"],
      resultTime: "Trong ngày",
      faq: [{ question: "Có cần nhịn ăn không?", answer: "Nên nhịn ăn 8 giờ." }],
    },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  const publicPage = await http.request(`/api/v1/packages/${created.slug}`);
  assert.equal(publicPage.status, 200, JSON.stringify(publicPage.body));
  assert.deepEqual(publicPage.body.data.audience, ["Người trên 40 tuổi"]);
  assert.equal(publicPage.body.data.resultTime, "Trong ngày");
  assert.equal(publicPage.body.data.faq[0].question, "Có cần nhịn ăn không?");

  const tooLong = await http.request(`/api/v1/dashboard/packages/${created.id}`, {
    method: "PATCH",
    headers,
    body: { faq: Array.from({ length: 11 }, () => ({ question: "q", answer: "a" })) },
  });
  assert.equal(tooLong.status, 400);
});

test("a doctor's own profile text stays a draft until an administrator approves it", async () => {
  const doctorHeaders = await doctor();
  const adminHeaders = await admin();
  const publicDoctor = () => http.request(`/api/v1/doctors/${fixture.doctorOne.id}`);

  const sent = await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: doctorHeaders, body: draft });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));

  // Bản nháp chưa hiện công khai.
  const before = await publicDoctor();
  assert.equal(before.status, 200);
  assert.equal(before.body.data.motto ?? null, null);
  assert.notEqual(before.body.data.bio, draft.bio);

  const mine = await http.request("/api/v1/dashboard/doctors/me/profile", { headers: doctorHeaders });
  assert.equal(mine.body.data.profileDraft.motto, draft.motto);
  const pending = await http.request("/api/v1/dashboard/doctors/profile-reviews", { headers: adminHeaders });
  assert.equal(pending.status, 200);
  assert.deepEqual(pending.body.data.map((item: { id: string }) => item.id), [fixture.doctorOne.id]);

  const approved = await http.request(`/api/v1/dashboard/doctors/${fixture.doctorOne.id}/profile/approve`, { method: "POST", headers: adminHeaders });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));

  const after = await publicDoctor();
  assert.equal(after.body.data.motto, draft.motto);
  assert.equal(after.body.data.bio, draft.bio);
  assert.deepEqual(after.body.data.expertise, draft.expertise);
  assert.deepEqual(after.body.data.careerTimeline, draft.careerTimeline);
  assert.equal(after.body.data.profileReviewerName, fixture.adminUser.fullName);
  assert.ok(after.body.data.profileUpdatedAt);
  const afterMine = await http.request("/api/v1/dashboard/doctors/me/profile", { headers: doctorHeaders });
  assert.equal(afterMine.body.data.profileDraft, null);

  // Không còn bản nháp thì duyệt hay từ chối đều báo rõ.
  const again = await http.request(`/api/v1/dashboard/doctors/${fixture.doctorOne.id}/profile/approve`, { method: "POST", headers: adminHeaders });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "NO_PENDING_DRAFT");
});

test("rejecting or discarding a draft leaves the published profile untouched", async () => {
  const doctorHeaders = await doctor();
  const adminHeaders = await admin();
  const body = { motto: "Bản nháp bị từ chối" };

  await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: doctorHeaders, body });
  const rejected = await http.request(`/api/v1/dashboard/doctors/${fixture.doctorOne.id}/profile/reject`, { method: "POST", headers: adminHeaders });
  assert.equal(rejected.status, 200);
  assert.equal((await prisma.doctorProfile.findUniqueOrThrow({ where: { id: fixture.doctorOne.id } })).motto, null);

  await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: doctorHeaders, body });
  const discarded = await http.request("/api/v1/dashboard/doctors/me/profile", { method: "DELETE", headers: doctorHeaders });
  assert.equal(discarded.status, 200);
  const stored = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: fixture.doctorOne.id } });
  assert.equal(stored.profileDraft, null);
  assert.equal(stored.profileDraftAt, null);
});

test("doctors can only draft their own text fields, and only reviewers can publish", async () => {
  const doctorHeaders = await doctor();
  const adminHeaders = await admin();

  // Phí khám, chuyên khoa, học hàm học vị do quản trị giữ: bản nháp của bác sĩ không nhận các trường đó.
  const overreach = await http.request("/api/v1/dashboard/doctors/me/profile", {
    method: "PUT",
    headers: doctorHeaders,
    body: { motto: "x", consultationFee: 1 },
  });
  assert.equal(overreach.status, 400);
  const empty = await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: doctorHeaders, body: {} });
  assert.equal(empty.status, 400);

  // Quản trị không có quyền soạn bản nháp thay bác sĩ; bác sĩ không có quyền duyệt.
  const adminDraft = await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: adminHeaders, body: { motto: "x" } });
  assert.equal(adminDraft.status, 403);
  await http.request("/api/v1/dashboard/doctors/me/profile", { method: "PUT", headers: doctorHeaders, body: { motto: "Tự duyệt" } });
  const selfApprove = await http.request(`/api/v1/dashboard/doctors/${fixture.doctorOne.id}/profile/approve`, { method: "POST", headers: doctorHeaders });
  assert.equal(selfApprove.status, 403);
  assert.equal((await prisma.doctorProfile.findUniqueOrThrow({ where: { id: fixture.doctorOne.id } })).motto, null);
});

test("an administrator editing the profile publishes immediately under their own name", async () => {
  const adminHeaders = await admin();
  const saved = await http.request(`/api/v1/dashboard/doctors/${fixture.doctorOne.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { motto: "Quản trị cập nhật", expertise: ["Nội tổng quát"] },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const publicDoctor = await http.request(`/api/v1/doctors/${fixture.doctorOne.id}`);
  assert.equal(publicDoctor.body.data.motto, "Quản trị cập nhật");
  assert.equal(publicDoctor.body.data.profileReviewerName, fixture.adminUser.fullName);
});
