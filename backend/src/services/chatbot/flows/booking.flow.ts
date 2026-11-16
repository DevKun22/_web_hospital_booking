import type { NLUResult } from "../ai/nlu.schema.js";
import type { ChatbotContext } from "../chatbot.context.js";
import type { TriageRecommendation } from "./triage.flow.js";
import { sanitizeBookingDraft } from "../rules/draft-sanitizer.js";
import { chatbotReplies } from "../chatbot.responses.js";
import {
  buildDepartmentResults,
  buildDoctorResults,
  buildOpenBookingAction,
  buildPackageResults,
  buildSlotResults,
  createOutput,
  findDepartment,
  formatDateLabel,
  getDepartmentActions,
  getDoctorActions,
  getNearestSlotDate,
  getPackageActions,
  getSlotActions,
  hasExactDateSlot,
  resolveBookingDraft,
} from "./booking.builders.js";
import type {
  AIChatbotOutput,
  ChatAction,
  ChatBookingDraft,
  ChatIntent,
} from "../chatbot.types.js";

type WorkflowInput = {
  message: string;
  detectedIntent: ChatIntent;
  context: ChatbotContext;
  draft: ChatBookingDraft;
  action?: ChatAction;
  nlu?: NLUResult;
  triageRecommendation?: TriageRecommendation | null;
};

// Luồng đặt lịch: máy chủ quyết định bước tiếp theo (khoa, gói, bác sĩ, ngày, giờ) và dựng kết quả từ DB; AI không sinh dữ liệu.

class BookingFlow {
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

export default new BookingFlow();
