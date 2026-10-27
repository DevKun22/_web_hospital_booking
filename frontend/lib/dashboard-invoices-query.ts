"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Invoice, ListResult } from "@/lib/types";

export type DashboardInvoiceFilters = {
  status?: string;
  paymentMethod?: string;
  phone?: string;
  invoiceCode?: string;
  barcode?: string;
  page?: number;
  limit?: number;
};

export const fetchDashboardInvoices = (filters: DashboardInvoiceFilters) =>
  apiRequest<ListResult<Invoice>>("/dashboard/invoices", {
    query: filters,
  });

export const fetchDashboardInvoice = (id: string) =>
  apiRequest<Invoice>(`/dashboard/invoices/${id}`);

export function useDashboardInvoices(filters: DashboardInvoiceFilters) {
  return useQuery({
    queryKey: queryKeys.dashboardInvoicesList(filters),
    queryFn: () => fetchDashboardInvoices(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardInvoice(id?: string) {
  return useQuery({
    queryKey: queryKeys.dashboardInvoice(id),
    queryFn: () => fetchDashboardInvoice(id || ""),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}
