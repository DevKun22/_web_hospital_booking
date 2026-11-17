import type { ChatbotContext } from "../chatbot.context.js";
import { sanitizeBookingDraft } from "../rules/draft-sanitizer.js";
import type {
  AIChatbotOutput,
  ChatBookingDraft,
  ChatbotResultGroup,
  SuggestedAction,
} from "../chatbot.types.js";

// Dựng kết quả (thẻ khoa, gói, bác sĩ, khung giờ) và nút gợi ý của luồng đặt lịch từ dữ liệu DB đã nạp.
// Chỉ có hàm thuần, không gọi DB hay AI.

export const createOutput = (
  output: Omit<AIChatbotOutput, "confidence"> & { confidence?: number },
): AIChatbotOutput => {
  const resultActionTypes = new Set<string>(
    (output.results || []).map((group) => {
      if (group.type === "departments") return "VIEW_DEPARTMENT";
      if (group.type === "packages") return "VIEW_PACKAGE";
      if (group.type === "doctors") return "VIEW_DOCTOR";
      return "VIEW_AVAILABLE_SLOTS";
    }),
  );

  return {
    confidence: output.confidence ?? 0.82,
    ...output,
    // Result cards own item selection; actions only offer alternate paths.
    suggestedActions: output.suggestedActions.filter(
      (action) => !resultActionTypes.has(action.type),
    ),
  };
};

export const formatDateLabel = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const findDepartment = (
  context: ChatbotContext,
  _message: string,
  draft: ChatBookingDraft,
) => {
  if (draft.departmentId) {
    return context.departments.find(
      (department) => department.id === draft.departmentId,
    );
  }

  if (draft.departmentSlug) {
    return context.departments.find(
      (department) => department.slug === draft.departmentSlug,
    );
  }

  return undefined;
};

export const getDepartmentActions = (context: ChatbotContext, department?: ChatbotContext["departments"][number]) => {
  if (department) {
    return [
      {
        type: "VIEW_DEPARTMENT",
        label: `Xem ${department.name}`,
        payload: {
          departmentId: department.id,
          departmentSlug: department.slug,
        },
      },
    ] satisfies SuggestedAction[];
  }

  return context.departments.slice(0, 3).map((item) => ({
    type: "VIEW_DEPARTMENT" as const,
    label: item.name,
    payload: {
      departmentId: item.id,
      departmentSlug: item.slug,
    },
  }));
};

export const buildDepartmentResults = (
  context: ChatbotContext,
  department?: ChatbotContext["departments"][number],
  // Danh mục chuyên khoa nhỏ: hiện đủ để người dùng không bị giấu khoa nào (trước đây chỉ 6 khoa đầu).
  limit = 12,
): ChatbotResultGroup[] => {
  const departments = department ? [department] : context.departments.slice(0, limit);
  if (!departments.length) return [];

  return [
    {
      type: "departments",
      title: department ? "Chuyên khoa phù hợp" : "Danh sách chuyên khoa",
      description: department
        ? "Bạn có thể mở chuyên khoa để xem bác sĩ, gói khám và lịch phù hợp."
        : "Chọn một chuyên khoa để tiếp tục xem gói khám, bác sĩ và lịch trống.",
      items: departments.map((item) => ({
        type: "department" as const,
        id: item.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
      })),
      total: department ? 1 : context.departments.length,
      limit,
    },
  ];
};

export const buildPackageResults = (
  context: ChatbotContext,
  departmentId?: string,
  limit = 6,
): ChatbotResultGroup[] => {
  const packages = context.packages
    .filter((item) => !departmentId || item.departmentId === departmentId)
    .slice(0, limit);
  if (!packages.length) return [];

  return [
    {
      type: "packages",
      title: "Gói khám phù hợp",
      description: "Bạn có thể xem nhanh gói khám trước khi chọn bác sĩ và khung giờ.",
      items: packages.map((item) => ({
        type: "package" as const,
        id: item.id,
        name: item.name,
        slug: item.slug,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        summary: item.summary,
        finalPrice: item.finalPrice,
      })),
      total: context.packages.filter((item) => !departmentId || item.departmentId === departmentId).length,
      limit,
    },
  ];
};

export const buildDoctorResults = (
  context: ChatbotContext,
  departmentId?: string,
  limit = 6,
): ChatbotResultGroup[] => {
  const doctors = context.doctors
    .filter((doctor) => !departmentId || doctor.departmentId === departmentId)
    .slice(0, limit);
  if (!doctors.length) return [];

  return [
    {
      type: "doctors",
      title: "Bác sĩ phù hợp",
      description: "Chọn bác sĩ để xem lịch trống và tiếp tục đặt khám.",
      items: doctors.map((doctor) => ({
        type: "doctor" as const,
        id: doctor.id,
        fullName: doctor.fullName,
        title: doctor.title,
        specialization: doctor.specialization,
        departmentId: doctor.departmentId,
        departmentName: doctor.departmentName,
        consultationFee: doctor.consultationFee,
      })),
      total: context.doctors.filter((doctor) => !departmentId || doctor.departmentId === departmentId).length,
      limit,
    },
  ];
};
export const getPackageActions = (
  context: ChatbotContext,
  departmentId?: string,
) =>
  context.packages
    .filter((item) => !departmentId || item.departmentId === departmentId)
    .slice(0, 3)
    .map((item) => ({
      type: "VIEW_PACKAGE" as const,
      label: item.name,
      payload: {
        packageId: item.id,
        packageSlug: item.slug,
      },
    }));

export const getDoctorActions = (
  context: ChatbotContext,
  departmentId?: string,
) =>
  context.doctors
    .filter((doctor) => !departmentId || doctor.departmentId === departmentId)
    .slice(0, 3)
    .map((doctor) => ({
      type: "VIEW_DOCTOR" as const,
      label: `${doctor.title || ""} ${doctor.fullName}`.trim(),
      payload: {
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
      },
    }));

export const getSlotActions = (
  context: ChatbotContext,
  doctorId?: string,
) =>
  context.availableSlots
    .filter((slot) => !doctorId || slot.doctorId === doctorId)
    .slice(0, 2)
    .map((slot) => {
      const doctor = context.doctors.find((item) => item.id === slot.doctorId);
      const doctorName = doctor ? `${doctor.title || ""} ${doctor.fullName}`.trim() : "";

      return {
        type: "VIEW_AVAILABLE_SLOTS" as const,
        label: doctorId || !doctorName
          ? `${formatDateLabel(slot.date)} ${slot.startTime}-${slot.endTime}`
          : `${doctorName} - ${formatDateLabel(slot.date)} ${slot.startTime}-${slot.endTime}`,
        payload: {
          doctorId: slot.doctorId,
          date: slot.date,
          timeSlotId: slot.id,
        },
      };
    });

const getMatchingSlots = (
  context: ChatbotContext,
  doctorId?: string,
) => context.availableSlots.filter((slot) => !doctorId || slot.doctorId === doctorId);

export const buildSlotResults = (
  context: ChatbotContext,
  doctorId?: string,
  limit = 6,
): ChatbotResultGroup[] => {
  const slots = getMatchingSlots(context, doctorId);
  if (!slots.length) return [];

  const items = slots.slice(0, limit).map((slot) => {
    const doctor = context.doctors.find((item) => item.id === slot.doctorId);

    return {
      type: "slot" as const,
      id: slot.id,
      doctorId: slot.doctorId,
      doctorName: doctor ? `${doctor.title || ""} ${doctor.fullName}`.trim() : undefined,
      departmentName: doctor?.departmentName,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  });

  return [
    {
      type: "slots",
      title: "Lịch trống phù hợp",
      description: slots.length > limit
        ? `Đang hiển thị ${limit}/${slots.length} khung giờ. Bạn có thể xem thêm ở phần đặt lịch.`
        : "Bạn có thể chọn nhanh một khung giờ bên dưới hoặc mở phần đặt lịch.",
      items,
      total: slots.length,
      limit,
    },
  ];
};

export const buildOpenBookingAction = (
  draft: ChatBookingDraft,
  date?: string,
): SuggestedAction => ({
  type: "START_BOOKING",
  label: "Xem thêm ở phần đặt lịch",
  payload: {
    prefill: {
      departmentId: draft.departmentId,
      packageId: draft.packageId,
      doctorId: draft.doctorId,
      date: date || draft.date,
    },
  },
});

export const hasExactDateSlot = (
  context: ChatbotContext,
  draft: ChatBookingDraft,
) =>
  Boolean(
    draft.date &&
      context.availableSlots.some((slot) =>
        slot.date === draft.date && (!draft.doctorId || slot.doctorId === draft.doctorId),
      ),
  );

export const getNearestSlotDate = (
  context: ChatbotContext,
  doctorId?: string,
) =>
  context.availableSlots.find((slot) => !doctorId || slot.doctorId === doctorId)?.date;

export const resolveBookingDraft = (
  context: ChatbotContext,
  draft: ChatBookingDraft,
) => {
  const selectedDoctor = draft.doctorId
    ? context.doctors.find((doctor) => doctor.id === draft.doctorId)
    : undefined;
  const selectedSlot = draft.timeSlotId
    ? context.availableSlots.find((slot) => slot.id === draft.timeSlotId)
    : undefined;

  return sanitizeBookingDraft({
    ...draft,
    departmentId: draft.departmentId || selectedDoctor?.departmentId,
    doctorId: selectedDoctor?.id || selectedSlot?.doctorId || draft.doctorId,
    date: selectedSlot?.date || draft.date,
    timeSlotId: selectedSlot?.id || draft.timeSlotId,
  });
};
