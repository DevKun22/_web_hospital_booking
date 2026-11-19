import { assert, authCookie, bookingBody, dashboardHeaders, fixture, futureDate, http, prisma, test } from "./support/context.js";

// Cơ sở khám mức nhỏ: danh mục cơ sở, ca làm việc gắn cơ sở, khung giờ và lịch hẹn đi theo cơ sở.

const admin = async () => dashboardHeaders(await authCookie(fixture.adminUser.id, "ADMIN"));

const createFacility = async (name: string, extra: Record<string, unknown> = {}) => {
  const response = await http.request("/api/v1/dashboard/facilities", {
    method: "POST",
    headers: await admin(),
    body: { name, address: `Số 1, đường ${name}`, phone: "1900 1234", ...extra },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body.data as { id: string; slug: string; isDefault: boolean };
};

// Ngày trong 14 ngày tới (cửa sổ tự sinh khung giờ) và thứ tương ứng.
const targetDay = () => {
  const date = futureDate(4);
  return { date, dayOfWeek: new Date(`${date}T00:00:00.000Z`).getUTCDay() };
};

const createSchedule = async (doctorId: string, dayOfWeek: number, extra: Record<string, unknown> = {}) =>
  http.request("/api/v1/dashboard/doctor-schedules", {
    method: "POST",
    headers: await admin(),
    body: { doctorId, dayOfWeek, startTime: "14:00", endTime: "15:00", slotDuration: 30, ...extra },
  });

test("a default facility always exists and the public list shows only active facilities", async () => {
  const listed = await http.request("/api/v1/dashboard/facilities", { headers: await admin() });
  assert.equal(listed.status, 200);
  const defaults = listed.body.data.filter((item: { isDefault: boolean }) => item.isDefault);
  assert.equal(defaults.length, 1);

  const second = await createFacility("Chi nhánh Một", { isActive: false });
  const publicList = await http.request("/api/v1/facilities");
  assert.equal(publicList.status, 200);
  assert.ok(!publicList.body.data.some((item: { id: string }) => item.id === second.id), "inactive facility stays hidden");
  assert.equal(publicList.body.data[0].isDefault, true);
});

test("exactly one facility is the default, and the default cannot be removed or switched off", async () => {
  const headers = await admin();
  const first = await createFacility("Chi nhánh Hai");
  assert.equal(first.isDefault, false);

  const promoted = await http.request(`/api/v1/dashboard/facilities/${first.id}`, { method: "PATCH", headers, body: { isDefault: true } });
  assert.equal(promoted.status, 200);
  assert.equal(await prisma.facility.count({ where: { isDefault: true } }), 1);

  const demote = await http.request(`/api/v1/dashboard/facilities/${first.id}`, { method: "PATCH", headers, body: { isDefault: false } });
  assert.equal(demote.status, 409);
  assert.equal(demote.body.code, "FACILITY_DEFAULT_REQUIRED");
  const deactivate = await http.request(`/api/v1/dashboard/facilities/${first.id}`, { method: "PATCH", headers, body: { isActive: false } });
  assert.equal(deactivate.status, 409);
  const remove = await http.request(`/api/v1/dashboard/facilities/${first.id}`, { method: "DELETE", headers });
  assert.equal(remove.status, 409);
});

test("a facility with schedules cannot be deleted, an unused one can", async () => {
  const headers = await admin();
  const used = await createFacility("Chi nhánh Ba");
  const unused = await createFacility("Chi nhánh Bốn");
  const { dayOfWeek } = targetDay();
  assert.equal((await createSchedule(fixture.doctorTwo.id, dayOfWeek, { facilityId: used.id })).status, 201);

  const blocked = await http.request(`/api/v1/dashboard/facilities/${used.id}`, { method: "DELETE", headers });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "FACILITY_IN_USE");
  assert.equal((await http.request(`/api/v1/dashboard/facilities/${unused.id}`, { method: "DELETE", headers })).status, 200);
});

test("slots and appointments follow the facility of the schedule", async () => {
  const branch = await createFacility("Chi nhánh Năm");
  const { date, dayOfWeek } = targetDay();
  const created = await createSchedule(fixture.doctorTwo.id, dayOfWeek, { facilityId: branch.id });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.facilityId, branch.id);

  const slots = await prisma.doctorTimeSlot.findMany({ where: { doctorId: fixture.doctorTwo.id, scheduleId: created.body.data.id } });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => slot.facilityId === branch.id));

  // Người khám thấy khung giờ kèm nơi khám.
  const available = await http.request(`/api/v1/doctors/${fixture.doctorTwo.id}/available-slots?date=${date}`);
  assert.equal(available.status, 200);
  assert.equal(available.body.data[0].facility.id, branch.id);
  assert.match(available.body.data[0].facility.address, /Chi nhánh Năm/);

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0955810001", doctorId: fixture.doctorTwo.id, timeSlotId: available.body.data[0].id }),
  });
  assert.equal(booking.status, 201, JSON.stringify(booking.body));
  const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booking.body.data.appointmentId } });
  assert.equal(appointment.facilityId, branch.id);
});

test("moving a schedule to another facility moves open slots but keeps booked ones where they were", async () => {
  const from = await createFacility("Chi nhánh Sáu");
  const to = await createFacility("Chi nhánh Bảy");
  const { date, dayOfWeek } = targetDay();
  const created = await createSchedule(fixture.doctorTwo.id, dayOfWeek, { facilityId: from.id });
  assert.equal(created.status, 201);
  const scheduleId = created.body.data.id as string;

  const slots = await prisma.doctorTimeSlot.findMany({ where: { scheduleId, date: new Date(`${date}T00:00:00.000Z`) }, orderBy: { startTime: "asc" } });
  assert.ok(slots.length >= 2, `expected two slots on ${date}`);
  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0955810002", doctorId: fixture.doctorTwo.id, timeSlotId: slots[0].id }),
  });
  assert.equal(booking.status, 201, JSON.stringify(booking.body));

  const moved = await http.request(`/api/v1/dashboard/doctor-schedules/${scheduleId}`, { method: "PATCH", headers: await admin(), body: { facilityId: to.id } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const after = await prisma.doctorTimeSlot.findMany({ where: { scheduleId, date: new Date(`${date}T00:00:00.000Z`) }, orderBy: { startTime: "asc" } });
  assert.equal(after[0].facilityId, from.id, "booked slot keeps its facility");
  assert.equal(after[1].facilityId, to.id, "open slot follows the schedule");
});

test("a new schedule defaults to the default facility, and an inactive facility is refused", async () => {
  const { dayOfWeek } = targetDay();
  const defaultFacility = await prisma.facility.findFirstOrThrow({ where: { isDefault: true } });
  const plain = await createSchedule(fixture.doctorTwo.id, dayOfWeek);
  assert.equal(plain.status, 201, JSON.stringify(plain.body));
  assert.equal(plain.body.data.facilityId, defaultFacility.id);

  const closed = await createFacility("Chi nhánh Tám", { isActive: false });
  const otherDay = (dayOfWeek + 1) % 7;
  const refused = await createSchedule(fixture.doctorTwo.id, otherDay, { facilityId: closed.id });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "FACILITY_INACTIVE");
});

test("only users who manage the catalog can change facilities", async () => {
  const doctor = dashboardHeaders(await authCookie(fixture.doctorOneUser.id, "DOCTOR"));
  assert.equal((await http.request("/api/v1/dashboard/facilities", { headers: doctor })).status, 200);
  const create = await http.request("/api/v1/dashboard/facilities", { method: "POST", headers: doctor, body: { name: "Trái phép", address: "Nơi nào đó" } });
  assert.equal(create.status, 403);
  const invalid = await http.request("/api/v1/dashboard/facilities", { method: "POST", headers: await admin(), body: { name: "A", address: "x" } });
  assert.equal(invalid.status, 400);
});
