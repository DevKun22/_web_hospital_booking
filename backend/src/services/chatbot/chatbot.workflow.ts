import type { NLUResult } from "./ai/nlu.schema.js";
import type { ChatbotContext } from "./chatbot.context.js";
import type { TriageRecommendation } from "./retrieval/triage.repository.js";
import { sanitizeBookingDraft } from "./rules/draft-sanitizer.js";
import { chatbotReplies } from "./chatbot.responses.js";
import type {
  AIChatbotOutput,
  ChatAction,
  ChatBookingDraft,
  ChatIntent,
  ChatbotResultGroup,
  SuggestedAction,
} from "./chatbot.types.js";

type WorkflowInput = {
  message: string;
  detectedIntent: ChatIntent;
  context: ChatbotContext;
  draft: ChatBookingDraft;
  action?: ChatAction;
  nlu?: NLUResult;
  triageRecommendation?: TriageRecommendation | null;
};

const createOutput = (
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

const formatDateLabel = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
};

const findDepartment = (
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

const getDepartmentActions = (context: ChatbotContext, department?: ChatbotContext["departments"][number]) => {
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

const buildDepartmentResults = (
  context: ChatbotContext,
  department?: ChatbotContext["departments"][number],
  limit = 6,
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

const buildPackageResults = (
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

const buildDoctorResults = (
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
const getPackageActions = (
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

const getDoctorActions = (
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

const getSlotActions = (
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

const buildSlotResults = (
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

const buildOpenBookingAction = (
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

const hasExactDateSlot = (
  context: ChatbotContext,
  draft: ChatBookingDraft,
) =>
  Boolean(
    draft.date &&
      context.availableSlots.some((slot) =>
        slot.date === draft.date && (!draft.doctorId || slot.doctorId === draft.doctorId),
      ),
  );

const getNearestSlotDate = (
  context: ChatbotContext,
  doctorId?: string,
) =>
  context.availableSlots.find((slot) => !doctorId || slot.doctorId === doctorId)?.date;

const resolveBookingDraft = (
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

class ChatbotWorkflowService {
  resolve(input: WorkflowInput): AIChatbotOutput | null {
    const draft = resolveBookingDraft(input.context, input.draft);
    const actionOutput = this.resolveSelectedAction(input, draft);

    if (actionOutput) return actionOutput;

    if (input.detectedIntent === "APPOINTMENT_LOOKUP_GUIDE") {
      return createOutput({
        reply: chatbotReplies.appointmentLookupGuide,
        intent: "APPOINTMENT_LOOKUP_GUIDE",
        state: "BOOKING_GUIDE",
        nextStep: "SHOW_BOOKING_GUIDE",
        draft,
        suggestedActions: [
          { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} },
          { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
        ],
      });
    }

    if (input.detectedIntent === "PAYMENT_GUIDE") {
      return createOutput({
        reply: chatbotReplies.paymentGuide,
        intent: "PAYMENT_GUIDE",
        state: "BOOKING_GUIDE",
        nextStep: "SHOW_PAYMENT_GUIDE",
        draft,
        suggestedActions: [
          { type: "LOOKUP_APPOINTMENT", label: "Tra cứu lịch hẹn", payload: {} },
          { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
        ],
      });
    }

    if (
      input.detectedIntent === "SYMPTOM_TRIAGE" ||
      input.detectedIntent === "DEPARTMENT_LIST" ||
      input.detectedIntent === "BOOKING_START"
    ) {
      return this.resolveDepartmentStep(input, draft);
    }

    if (
      input.detectedIntent === "PACKAGE_LIST" ||
      input.detectedIntent === "PACKAGE_DETAIL"
    ) {
      return this.resolvePackageStep(input, draft);
    }

    if (input.detectedIntent === "UNKNOWN" && draft.departmentId && !draft.doctorId && !draft.timeSlotId) {
      return this.resolveDepartmentStep(input, draft);
    }

    if (
      input.detectedIntent === "DOCTOR_LIST" ||
      input.detectedIntent === "AVAILABLE_SLOT_LOOKUP" ||
      draft.doctorId ||
      draft.departmentId
    ) {
      return this.resolveDoctorAndSlotStep(input, draft);
    }

    return null;
  }

  private resolveSelectedAction(input: WorkflowInput, draft: ChatBookingDraft) {
    if (!input.action) return null;

    switch (input.action.type) {
      case "VIEW_DEPARTMENTS":
        return this.handleDepartmentList(input, draft);
      case "VIEW_PACKAGES":
        return this.handlePackageList(input, draft);
      case "VIEW_DOCTORS":
        return this.handleDoctorChange(input, draft);
      case "VIEW_DEPARTMENT":
      case "SELECT_DEPARTMENT":
        return this.handleDepartmentSelected(input, draft);
      case "VIEW_PACKAGE":
      case "SELECT_PACKAGE":
        return this.handlePackageSelected(input, draft);
      case "VIEW_DOCTOR":
      case "SELECT_DOCTOR":
        return this.handleDoctorSelected(input, draft);
      case "VIEW_AVAILABLE_SLOTS":
      case "SELECT_SLOT":
        return this.handleSlotSelected(draft);
      case "CHANGE_DATE":
        return createOutput({
          reply: chatbotReplies.changeDatePrompt,
          intent: "AVAILABLE_SLOT_LOOKUP",
          state: "CHOOSING_DATE",
          nextStep: "CHOOSE_DATE",
          draft,
          suggestedActions: [
            { type: "CHANGE_DOCTOR", label: "Đổi bác sĩ", payload: { departmentId: draft.departmentId } },
            { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
          ],
        });
      case "CHANGE_DOCTOR":
        return this.handleDoctorChange(input, draft);
      default:
        return null;
    }
  }

  private handleDepartmentSelected(input: WorkflowInput, draft: ChatBookingDraft) {
    const department = findDepartment(input.context, input.message, draft);
    const departmentId = draft.departmentId || department?.id;
    const packageActions = getPackageActions(input.context, departmentId);

    return createOutput({
      reply: department
        ? chatbotReplies.departmentSelected(department.name)
        : chatbotReplies.departmentSelected(),
      intent: "DEPARTMENT_DETAIL",
      state: packageActions.length ? "SUGGESTING_PACKAGE" : "CHOOSING_DOCTOR",
      nextStep: packageActions.length ? "CHOOSE_PACKAGE" : "CHOOSE_DOCTOR",
      results: packageActions.length
        ? buildPackageResults(input.context, departmentId)
        : buildDoctorResults(input.context, departmentId),
      draft: sanitizeBookingDraft({
        ...draft,
        departmentId,
        departmentSlug: draft.departmentSlug || department?.slug || undefined,
        doctorId: undefined,
        timeSlotId: undefined,
      }),
      suggestedActions: [
        ...packageActions,
        {
          type: "VIEW_DOCTORS",
          label: "Khám theo bác sĩ",
          payload: { departmentId, serviceMode: "DOCTOR_ONLY" },
        },
      ],
    });
  }

  private handleDepartmentList(input: WorkflowInput, draft: ChatBookingDraft) {
    return createOutput({
      reply: chatbotReplies.departmentListGuide,
      intent: "DEPARTMENT_LIST",
      state: "SUGGESTING_DEPARTMENT",
      nextStep: "CHOOSE_DEPARTMENT",
      results: buildDepartmentResults(input.context),
      draft: sanitizeBookingDraft({
        ...draft,
        departmentId: undefined,
        departmentSlug: undefined,
        packageId: undefined,
        packageSlug: undefined,
        doctorId: undefined,
        timeSlotId: undefined,
      }),
      suggestedActions: getDepartmentActions(input.context),
    });
  }

  private handlePackageList(input: WorkflowInput, draft: ChatBookingDraft) {
    const packageActions = getPackageActions(input.context, draft.departmentId);

    return createOutput({
      reply: packageActions.length
        ? chatbotReplies.packageList(true)
        : chatbotReplies.packageList(false),
      intent: "PACKAGE_LIST",
      state: packageActions.length ? "SUGGESTING_PACKAGE" : "SUGGESTING_DEPARTMENT",
      nextStep: packageActions.length ? "CHOOSE_PACKAGE" : "CHOOSE_DEPARTMENT",
      draft,
      results: buildPackageResults(input.context, draft.departmentId),
      suggestedActions: packageActions.length
        ? packageActions
        : [
            { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
            { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
          ],
    });
  }

  private handlePackageSelected(input: WorkflowInput, draft: ChatBookingDraft) {
    const packageItem = draft.packageId
      ? input.context.packages.find((item) => item.id === draft.packageId)
      : draft.packageSlug
        ? input.context.packages.find((item) => item.slug === draft.packageSlug)
        : undefined;
    const departmentId =
      draft.departmentId || packageItem?.departmentId || undefined;
    const doctorActions = getDoctorActions(input.context, departmentId);
    const slotActions = getSlotActions(input.context, draft.doctorId);
    const nextDraft = sanitizeBookingDraft({
      ...draft,
      departmentId,
    });

    if (slotActions.length) {
      const nearestDate = getNearestSlotDate(input.context, draft.doctorId);

      return createOutput({
        reply: packageItem
          ? chatbotReplies.packageSelectedWithSlots(packageItem.name)
          : chatbotReplies.packageSelectedWithSlots(),
        intent: "PACKAGE_DETAIL",
        state: "CHOOSING_SLOT",
        nextStep: "CHOOSE_SLOT",
        results: buildSlotResults(input.context, draft.doctorId),
        draft: nextDraft,
        suggestedActions: [
          buildOpenBookingAction(nextDraft, nearestDate || draft.date),
        ],
      });
    }

    return createOutput({
      reply: packageItem
        ? chatbotReplies.packageSelected(packageItem.name)
        : chatbotReplies.packageSelected(),
      intent: "PACKAGE_DETAIL",
      state: "CHOOSING_DOCTOR",
      nextStep: "CHOOSE_DOCTOR",
      results: buildDoctorResults(input.context, departmentId),
      draft: nextDraft,
      suggestedActions: doctorActions.length
        ? doctorActions
        : [
            {
              type: "CHANGE_DATE",
              label: "Chọn ngày khám",
              payload: { departmentId },
            },
            {
              type: "CONTACT_STAFF",
              label: "Liên hệ hỗ trợ",
              payload: {},
            },
          ],
    });
  }

  private handleDoctorSelected(input: WorkflowInput, draft: ChatBookingDraft) {
    const selectedDoctor = draft.doctorId
      ? input.context.doctors.find((doctor) => doctor.id === draft.doctorId)
      : undefined;
    const slotActions = getSlotActions(input.context, draft.doctorId);
    const nextDraft = sanitizeBookingDraft({
      ...draft,
      departmentId: draft.departmentId || selectedDoctor?.departmentId,
    });

    if (slotActions.length) {
      const exactDateSlot = hasExactDateSlot(input.context, draft);
      const nearestDate = getNearestSlotDate(input.context, draft.doctorId);
      const results = buildSlotResults(input.context, draft.doctorId);

      return createOutput({
        reply: draft.date && !exactDateSlot && nearestDate
          ? chatbotReplies.doctorSlotFoundAfterDateMiss(formatDateLabel(draft.date), formatDateLabel(nearestDate))
          : selectedDoctor
            ? chatbotReplies.doctorSelectedWithSlots(`${selectedDoctor.title || ""} ${selectedDoctor.fullName}`.trim())
            : chatbotReplies.doctorSelectedWithSlots(),
        intent: "AVAILABLE_SLOT_LOOKUP",
        state: "CHOOSING_SLOT",
        nextStep: "CHOOSE_SLOT",
        draft: nextDraft,
        results,
        suggestedActions: [buildOpenBookingAction(nextDraft, nearestDate || draft.date)],
      });
    }

    return createOutput({
      reply: selectedDoctor
        ? chatbotReplies.doctorSelectedNoSlots(`${selectedDoctor.title || ""} ${selectedDoctor.fullName}`.trim())
        : chatbotReplies.doctorSelectedNoSlots(),
      intent: "AVAILABLE_SLOT_LOOKUP",
      state: "CHOOSING_DATE",
      nextStep: "CHOOSE_DATE",
      draft: nextDraft,
      suggestedActions: [
        { type: "CHANGE_DATE", label: "Đổi ngày khám", payload: { doctorId: draft.doctorId, departmentId: nextDraft.departmentId } },
        { type: "CHANGE_DOCTOR", label: "Đổi bác sĩ", payload: { departmentId: nextDraft.departmentId } },
        { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
      ],
    });
  }

  private handleSlotSelected(draft: ChatBookingDraft) {
    return createOutput({
      reply: chatbotReplies.slotSelected,
      intent: "BOOKING_START",
      state: "READY_TO_BOOK",
      nextStep: "READY_TO_BOOK",
      draft,
      suggestedActions: [],
    });
  }

  private handleDoctorChange(input: WorkflowInput, draft: ChatBookingDraft) {
    const doctorActions = getDoctorActions(input.context, draft.departmentId);

    return createOutput({
      reply: doctorActions.length
        ? chatbotReplies.doctorChange(true)
        : chatbotReplies.doctorChange(false),
      intent: "DOCTOR_LIST",
      state: doctorActions.length ? "CHOOSING_DOCTOR" : "SUGGESTING_DEPARTMENT",
      nextStep: doctorActions.length ? "CHOOSE_DOCTOR" : "CHOOSE_DEPARTMENT",
      draft,
      results: buildDoctorResults(input.context, draft.departmentId),
      suggestedActions: doctorActions.length
        ? doctorActions
        : [
            { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
            { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
          ],
    });
  }

  private resolveDepartmentStep(input: WorkflowInput, draft: ChatBookingDraft) {
    const department = findDepartment(input.context, input.message, draft);
    const nextDraft = sanitizeBookingDraft({
      ...draft,
      departmentId: draft.departmentId || department?.id,
      departmentSlug: draft.departmentSlug || department?.slug || undefined,
    });
    const clarificationQuestion =
      input.nlu?.triage.clarificationQuestion?.trim() || undefined;
    const repeatedQuestion =
      clarificationQuestion &&
      clarificationQuestion.toLocaleLowerCase("vi") ===
        draft.triageLastQuestion?.toLocaleLowerCase("vi");

    if (
      input.detectedIntent === "SYMPTOM_TRIAGE" &&
      input.triageRecommendation &&
      department
    ) {
      const recommendation = input.triageRecommendation;
      const reply = recommendation.fallback
        ? chatbotReplies.triageFallback(
            department.name,
            recommendation.triageDescription,
          )
        : chatbotReplies.triageMatched(
            department.name,
            recommendation.triageDescription,
          );

      return createOutput({
        reply,
        intent: "SYMPTOM_TRIAGE",
        state: "SUGGESTING_DEPARTMENT",
        nextStep: "CHOOSE_DEPARTMENT",
        draft: sanitizeBookingDraft({
          ...nextDraft,
          triageLastQuestion: undefined,
        }),
        results: buildDepartmentResults(input.context, department),
        suggestedActions: [
          { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
        ],
        confidence: recommendation.confidence,
      });
    }

    if (!department && input.detectedIntent === "SYMPTOM_TRIAGE") {
      const nextQuestion = repeatedQuestion ? undefined : clarificationQuestion;

      return createOutput({
        reply: nextQuestion
          ? chatbotReplies.triageClarification(nextQuestion)
          : chatbotReplies.triageNoMatch,
        intent: "SYMPTOM_TRIAGE",
        state: "ASKING_SYMPTOMS",
        nextStep: "ASK_SYMPTOM_DETAILS",
        draft: sanitizeBookingDraft({
          ...nextDraft,
          triageLastQuestion: nextQuestion || draft.triageLastQuestion,
        }),
        suggestedActions: [
          { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
          { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
        ],
        confidence: 0.7,
      });
    }

    return createOutput({
      reply: department
        ? chatbotReplies.departmentSuggestion(department.name)
        : chatbotReplies.departmentSuggestion(),
      intent:
        input.detectedIntent === "UNKNOWN"
          ? "DEPARTMENT_LIST"
          : input.detectedIntent,
      state: department ? "SUGGESTING_DEPARTMENT" : "BOOKING_GUIDE",
      nextStep: "CHOOSE_DEPARTMENT",
      draft: nextDraft,
      results: buildDepartmentResults(input.context, department),
      suggestedActions: department
        ? [
            {
              type: "VIEW_PACKAGES",
              label: "Xem gói khám",
              payload: { departmentId: nextDraft.departmentId },
            },
            {
              type: "VIEW_DOCTORS",
              label: "Khám theo bác sĩ",
              payload: {
                departmentId: nextDraft.departmentId,
                serviceMode: "DOCTOR_ONLY",
              },
            },
          ]
        : [
            ...getDepartmentActions(input.context),
            { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
          ],
    });
  }

  private resolvePackageStep(input: WorkflowInput, draft: ChatBookingDraft) {
    if (draft.packageId || draft.packageSlug) {
      return this.handlePackageSelected(input, draft);
    }
    const department = findDepartment(input.context, input.message, draft);
    const departmentId = draft.departmentId || department?.id;
    const packageActions = getPackageActions(input.context, departmentId);

    return createOutput({
      reply: packageActions.length
        ? chatbotReplies.packageSuggestion(true)
        : chatbotReplies.packageSuggestion(false),
      intent: "PACKAGE_LIST",
      state: "SUGGESTING_PACKAGE",
      nextStep: packageActions.length ? "CHOOSE_PACKAGE" : "CHOOSE_DEPARTMENT",
      results: buildPackageResults(input.context, departmentId),
      draft: sanitizeBookingDraft({
        ...draft,
        departmentId,
        departmentSlug: draft.departmentSlug || department?.slug || undefined,
      }),
      suggestedActions: packageActions.length
        ? packageActions
        : [
            { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
            { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
          ],
    });
  }

  private resolveDoctorAndSlotStep(input: WorkflowInput, draft: ChatBookingDraft) {
    const selectedDoctor = draft.doctorId
      ? input.context.doctors.find((doctor) => doctor.id === draft.doctorId)
      : undefined;
    const departmentId = draft.departmentId || selectedDoctor?.departmentId;
    const slotActions = getSlotActions(input.context, draft.doctorId);

    if (draft.doctorId && draft.timeSlotId) {
      return createOutput({
        reply: chatbotReplies.readyToBook,
        intent: "BOOKING_START",
        state: "READY_TO_BOOK",
        nextStep: "READY_TO_BOOK",
        draft,
        suggestedActions: [],
      });
    }

    if (slotActions.length) {
      const exactDateSlot = hasExactDateSlot(input.context, draft);
      const nearestDate = getNearestSlotDate(input.context, draft.doctorId);
      const results = buildSlotResults(input.context, draft.doctorId);

      return createOutput({
        reply: draft.date && !exactDateSlot && nearestDate
          ? chatbotReplies.slotLookupAfterDateMiss(formatDateLabel(draft.date), formatDateLabel(nearestDate))
          : draft.doctorId
            ? chatbotReplies.doctorSlotsFound
            : chatbotReplies.nearestSlotsFound,
        intent: "AVAILABLE_SLOT_LOOKUP",
        state: "CHOOSING_SLOT",
        nextStep: "CHOOSE_SLOT",
        draft,
        results,
        suggestedActions: [buildOpenBookingAction(draft, nearestDate || draft.date)],
      });
    }

    if (draft.doctorId) {
      return createOutput({
        reply: draft.date
          ? chatbotReplies.noDoctorSlots(true)
          : chatbotReplies.noDoctorSlots(false),
        intent: "AVAILABLE_SLOT_LOOKUP",
        state: "CHOOSING_DATE",
        nextStep: "CHOOSE_DATE",
        draft,
        suggestedActions: [
          {
            type: "CHANGE_DATE",
            label: "Đổi ngày khám",
            payload: {
              doctorId: draft.doctorId,
              departmentId,
            },
          },
          {
            type: "CHANGE_DOCTOR",
            label: "Đổi bác sĩ",
            payload: {
              departmentId,
            },
          },
          { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
        ],
        confidence: 0.78,
      });
    }

    const doctorActions = getDoctorActions(input.context, departmentId);

    if (doctorActions.length) {
      return createOutput({
        reply: draft.date
          ? chatbotReplies.chooseDoctorForSlots(true)
          : chatbotReplies.chooseDoctorForSlots(false),
        intent: "DOCTOR_LIST",
        state: "CHOOSING_DOCTOR",
        nextStep: "CHOOSE_DOCTOR",
        draft,
        results: buildDoctorResults(input.context, departmentId),
        suggestedActions: doctorActions,
      });
    }

    return createOutput({
      reply: chatbotReplies.noMatchingDoctorOrSlot,
      intent: "AVAILABLE_SLOT_LOOKUP",
      state: departmentId ? "CHOOSING_DATE" : "SUGGESTING_DEPARTMENT",
      nextStep: departmentId ? "CHOOSE_DATE" : "CHOOSE_DEPARTMENT",
      draft,
      suggestedActions: [
        { type: "VIEW_DEPARTMENTS", label: "Xem chuyên khoa", payload: {} },
        { type: "CONTACT_STAFF", label: "Liên hệ hỗ trợ", payload: {} },
      ],
      confidence: 0.74,
    });
  }
}

export default new ChatbotWorkflowService();
