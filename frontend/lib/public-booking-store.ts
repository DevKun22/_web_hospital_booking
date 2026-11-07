"use client";

import { create } from "zustand";
import { getVietnamDateInput } from "@/lib/date";

export type BookingServiceMode = "" | "DOCTOR_ONLY" | "PACKAGE";

export type PublicBookingSelection = {
  departmentId: string;
  doctorId: string;
  packageId: string;
  serviceMode: BookingServiceMode;
};

export type PublicBookingDraft = {
  date: string;
  timeSlotId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  otpChannel: "SMS" | "EMAIL";
  reason: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  dateOfBirth: string;
  address: string;
  cccd: string;
  hasBHYT: boolean;
  healthInsuranceCode: string;
  registeredHospital: string;
  allergies: string;
  medicalHistory: string;
  familyHistory: string;
  // Đồng ý cho bệnh viện lưu thông tin sức khỏe; bắt buộc khi có khai báo ở trên.
  healthConsent: boolean;
};

export type PublicBookingPrefill = Partial<PublicBookingSelection> &
  Partial<Pick<PublicBookingDraft, "date" | "timeSlotId">>;

export type PublicLookupDraft = {
  bookingCode: string;
  phone: string;
  savedAt: number;
};

const lookupDraftStorageKey = "hospital_booking_lookup_draft";

const readLookupDraft = (): PublicLookupDraft | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(lookupDraftStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PublicLookupDraft>;
    if (
      !parsed.bookingCode ||
      !parsed.phone ||
      typeof parsed.savedAt !== "number"
    )
      return null;

    return {
      bookingCode: parsed.bookingCode,
      phone: parsed.phone,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
};

export const getPublicLookupDraft = () => readLookupDraft();

const writeLookupDraft = (draft: PublicLookupDraft | null) => {
  if (typeof window === "undefined") return;

  if (!draft) {
    window.sessionStorage.removeItem(lookupDraftStorageKey);
    return;
  }

  window.sessionStorage.setItem(lookupDraftStorageKey, JSON.stringify(draft));
};

export const initialBookingSelection: PublicBookingSelection = {
  departmentId: "",
  doctorId: "",
  packageId: "",
  serviceMode: "",
};

export const initialBookingDraft: PublicBookingDraft = {
  date: getVietnamDateInput(),
  timeSlotId: "",
  patientName: "",
  patientPhone: "",
  patientEmail: "",
  otpChannel: "EMAIL",
  reason: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  cccd: "",
  hasBHYT: false,
  healthInsuranceCode: "",
  registeredHospital: "",
  allergies: "",
  medicalHistory: "",
  familyHistory: "",
  healthConsent: false,
};

type PublicBookingStore = {
  selection: PublicBookingSelection;
  draft: PublicBookingDraft;
  lookupDraft: PublicLookupDraft | null;
  profileOwnerId: string | null;
  hydratedFromUrl: boolean;
  setSelectionPatch: (patch: Partial<PublicBookingSelection>) => void;
  setDraftPatch: (patch: Partial<PublicBookingDraft>) => void;
  setLookupDraft: (draft: Omit<PublicLookupDraft, "savedAt">) => void;
  clearLookupDraft: () => void;
  applyPatientProfile: (
    ownerId: string,
    patch: Partial<PublicBookingDraft>,
  ) => void;
  clearPatientProfile: () => void;
  hydrateFromUrl: (prefill: PublicBookingPrefill) => void;
};

export const usePublicBookingStore = create<PublicBookingStore>((set) => ({
  selection: initialBookingSelection,
  draft: initialBookingDraft,
  lookupDraft: readLookupDraft(),
  profileOwnerId: null,
  hydratedFromUrl: false,
  setSelectionPatch: (patch) =>
    set((state) => ({
      selection: { ...state.selection, ...patch },
    })),
  setDraftPatch: (patch) =>
    set((state) => ({
      draft: { ...state.draft, ...patch },
    })),
  setLookupDraft: (draft) =>
    set(() => {
      const nextDraft = {
        bookingCode: draft.bookingCode.trim().toUpperCase(),
        phone: draft.phone.trim(),
        savedAt: Date.now(),
      };

      writeLookupDraft(nextDraft);
      return { lookupDraft: nextDraft };
    }),
  clearLookupDraft: () =>
    set(() => {
      writeLookupDraft(null);
      return { lookupDraft: null };
    }),
  applyPatientProfile: (ownerId, patch) =>
    set((state) => {
      const identityChanged = Boolean(
        state.profileOwnerId && state.profileOwnerId !== ownerId,
      );
      const baseDraft = identityChanged
        ? {
            ...initialBookingDraft,
            date: state.draft.date,
            timeSlotId: state.draft.timeSlotId,
          }
        : state.draft;

      return {
        draft: { ...baseDraft, ...patch },
        profileOwnerId: ownerId,
      };
    }),
  clearPatientProfile: () =>
    set((state) => {
      if (!state.profileOwnerId) return state;
      return {
        draft: {
          ...initialBookingDraft,
          date: state.draft.date,
          timeSlotId: state.draft.timeSlotId,
        },
        profileOwnerId: null,
      };
    }),
  hydrateFromUrl: (prefill) =>
    set((state) => ({
      selection: {
        ...state.selection,
        departmentId: prefill.departmentId ?? state.selection.departmentId,
        doctorId: prefill.doctorId ?? state.selection.doctorId,
        packageId: prefill.packageId ?? state.selection.packageId,
        serviceMode:
          prefill.serviceMode ??
          (prefill.packageId
            ? "PACKAGE"
            : prefill.doctorId
              ? "DOCTOR_ONLY"
              : state.selection.serviceMode),
      },
      draft: {
        ...state.draft,
        date: prefill.date || state.draft.date,
        timeSlotId: prefill.timeSlotId ?? state.draft.timeSlotId,
      },
      hydratedFromUrl: true,
    })),
}));
