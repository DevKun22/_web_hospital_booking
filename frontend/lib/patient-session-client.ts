"use client";

import { useQuery } from "@tanstack/react-query";
import { PatientApiError, patientApiRequest } from "@/lib/patient-portal-api";
import type { PatientUser } from "@/lib/patient-portal-types";

export const patientSessionQueryKey = ["patient-session"] as const;

export const PATIENT_APPOINTMENTS_PATH = "/tai-khoan/lich-hen";
export const PATIENT_LOGIN_LOOKUP_HREF = `/tai-khoan/dang-nhap?next=${PATIENT_APPOINTMENTS_PATH}`;

// Liên kết tra cứu lịch hẹn theo phiên: đã đăng nhập (hoặc đang kiểm tra) vào thẳng cổng, chưa đăng nhập mới qua đăng nhập.
export function patientLookupLink(user: PatientUser | null | undefined) {
  return user === null
    ? { href: PATIENT_LOGIN_LOOKUP_HREF, label: "Tra cứu lịch hẹn" }
    : { href: PATIENT_APPOINTMENTS_PATH, label: user ? "Lịch hẹn của tôi" : "Tra cứu lịch hẹn" };
}

export function usePatientLookupLink() {
  const query = useQuery({ queryKey: patientSessionQueryKey, queryFn: loadOptionalPatientSession, retry: false, staleTime: 30_000, refetchOnWindowFocus: true });
  return patientLookupLink(query.data);
}

export async function loadOptionalPatientSession(): Promise<PatientUser | null> {
  try {
    return (await patientApiRequest<PatientUser>("/phien")).data;
  } catch (error) {
    if (error instanceof PatientApiError && error.status === 401) return null;
    throw error;
  }
}
