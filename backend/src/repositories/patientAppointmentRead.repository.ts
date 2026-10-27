import { Prisma } from "../../generated/prisma/client.js";
import type { AppointmentStatus } from "../../generated/prisma/enums.js";
import { databaseSchema, prisma } from "../config/prisma.js";

type AppointmentReadRow = {
  id: string;
  bookingCode: string;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  patientName: string;
  dependentProfileId: string | null;
  reason: string | null;
  estimatedPrice: number;
  serviceFee: number;
  hasBHYT: boolean;
  bhytDiscount: number;
  finalAmount: number;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  completedAt: Date | null;
  createdAt: Date;
  doctorId: string;
  doctorTitle: string | null;
  doctorSpecialization: string | null;
  doctorFullName: string;
  doctorAvatar: string | null;
  departmentId: string;
  departmentName: string;
  departmentSlug: string | null;
  packageId: string | null;
  packageName: string | null;
  packageSlug: string | null;
};

const appointmentProjection = Prisma.sql`
  a."id",
  a."bookingCode",
  a."appointmentDate",
  a."startTime",
  a."endTime",
  a."status",
  a."patientName",
  a."dependentProfileId",
  a."reason",
  a."estimatedPrice",
  a."serviceFee",
  a."hasBHYT",
  a."bhytDiscount",
  a."finalAmount",
  a."confirmedAt",
  a."cancelledAt",
  a."cancelledReason",
  a."completedAt",
  a."createdAt",
  doctor."id" AS "doctorId",
  doctor."title" AS "doctorTitle",
  doctor."specialization" AS "doctorSpecialization",
  doctor_user."fullName" AS "doctorFullName",
  doctor_user."avatar" AS "doctorAvatar",
  department."id" AS "departmentId",
  department."name" AS "departmentName",
  department."slug" AS "departmentSlug",
  package."id" AS "packageId",
  package."name" AS "packageName",
  package."slug" AS "packageSlug"
`;

// The driver adapter applies `schema=` to Prisma model operations but raw SQL
// still needs explicit qualification. The value is validated before export by
// config/prisma.ts; table names below are compile-time constants.
const qualifiedTable = (table: string) =>
  Prisma.raw(`"${databaseSchema}"."${table}"`);
const appointmentTable = qualifiedTable("Appointment");
const doctorProfileTable = qualifiedTable("DoctorProfile");
const userTable = qualifiedTable("User");
const departmentTable = qualifiedTable("Department");
const packageTable = qualifiedTable("Package");
const appointmentStatusType = qualifiedTable("AppointmentStatus");

const appointmentJoins = Prisma.sql`
  FROM ${appointmentTable} AS a
  INNER JOIN ${doctorProfileTable} AS doctor ON doctor."id" = a."doctorId"
  INNER JOIN ${userTable} AS doctor_user ON doctor_user."id" = doctor."userId"
  INNER JOIN ${departmentTable} AS department ON department."id" = a."departmentId"
  LEFT JOIN ${packageTable} AS package ON package."id" = a."packageId"
`;

const mapAppointment = (row: AppointmentReadRow) => ({
  id: row.id,
  bookingCode: row.bookingCode,
  appointmentDate: row.appointmentDate,
  startTime: row.startTime,
  endTime: row.endTime,
  status: row.status,
  patientName: row.patientName,
  dependentProfileId: row.dependentProfileId,
  recipientType: row.dependentProfileId ? "DEPENDENT" : "SELF",
  reason: row.reason,
  estimatedPrice: row.estimatedPrice,
  serviceFee: row.serviceFee,
  hasBHYT: row.hasBHYT,
  bhytDiscount: row.bhytDiscount,
  finalAmount: row.finalAmount,
  confirmedAt: row.confirmedAt,
  cancelledAt: row.cancelledAt,
  cancelledReason: row.cancelledReason,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  doctor: {
    id: row.doctorId,
    title: row.doctorTitle,
    specialization: row.doctorSpecialization,
    user: {
      fullName: row.doctorFullName,
      avatar: row.doctorAvatar,
    },
  },
  department: {
    id: row.departmentId,
    name: row.departmentName,
    slug: row.departmentSlug,
  },
  package: row.packageId
    ? {
        id: row.packageId,
        name: row.packageName!,
        slug: row.packageSlug,
      }
    : null,
});

class PatientAppointmentReadRepository {
  async list(input: {
    patientId: string;
    page: number;
    limit: number;
    status?: AppointmentStatus;
  }) {
    const where: Prisma.AppointmentWhereInput = {
      patientId: input.patientId,
      status: input.status,
    };
    const statusFilter = input.status
      ? Prisma.sql`AND a."status" = CAST(${input.status} AS ${appointmentStatusType})`
      : Prisma.empty;
    const offset = (input.page - 1) * input.limit;

    // Prisma's current driver adapter expands nested relations into several
    // round-trips. This read model keeps the public contract while fetching
    // the four display relations in one parameterized PostgreSQL query.
    const [rows, total] = await Promise.all([
      prisma.$queryRaw<AppointmentReadRow[]>(Prisma.sql`
        SELECT ${appointmentProjection}
        ${appointmentJoins}
        WHERE a."patientId" = ${input.patientId}
        ${statusFilter}
        ORDER BY a."appointmentDate" DESC, a."startTime" DESC
        OFFSET ${offset}
        LIMIT ${input.limit}
      `),
      prisma.appointment.count({ where }),
    ]);

    return { items: rows.map(mapAppointment), total };
  }

  async findById(patientId: string, appointmentId: string) {
    const rows = await prisma.$queryRaw<AppointmentReadRow[]>(Prisma.sql`
      SELECT ${appointmentProjection}
      ${appointmentJoins}
      WHERE a."patientId" = ${patientId}
        AND a."id" = ${appointmentId}
      LIMIT 1
    `);

    return rows[0] ? mapAppointment(rows[0]) : null;
  }
}

export default new PatientAppointmentReadRepository();
