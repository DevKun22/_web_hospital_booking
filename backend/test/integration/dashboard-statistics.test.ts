import { assert, authCookie, createStoredAppointment, dashboardCall, fixture, prisma, test } from "./support/context.js";

// Thống kê lịch hẹn theo ngày được gom trong cơ sở dữ liệu (groupBy ngày và trạng thái); bài này khóa các con số theo ngày và theo trạng thái.

test("dashboard-statistics: thống kê lịch hẹn đếm đúng tổng, hoàn tất và hủy theo ngày", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  await createStoredAppointment({ status: "COMPLETED", phone: "0911111111", bookingCode: "STAT-DONE" });
  const confirmed = await createStoredAppointment({ status: "CONFIRMED", phone: "0911111112", bookingCode: "STAT-CONF", timeSlotId: fixture.slotOne.id });
  await prisma.appointment.update({ where: { id: confirmed.id }, data: { status: "CANCELLED_BY_ADMIN" } });

  const day = fixture.appointmentDate;
  const response = await dashboardCall("GET", `/api/v1/dashboard/statistics/appointments?from=${day}&to=${day}`, admin);
  assert.equal(response.status, 200);
  const data = response.body.data;
  assert.equal(data.metrics.total, 2);
  assert.deepEqual(data.daily, [{ date: day, total: 2, completed: 1, cancelled: 1 }]);
  const byStatus = Object.fromEntries((data.byStatus as { value: string; count: number }[]).map((row) => [row.value, row.count]));
  assert.equal(byStatus.COMPLETED, 1);
  assert.equal(byStatus.CANCELLED_BY_ADMIN, 1);
});
