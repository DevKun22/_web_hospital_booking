"use client";

import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { Facility } from "@/lib/types";

// Cột "Địa điểm khám" của footer: danh sách cơ sở đang hoạt động lấy từ dữ liệu công khai (tối đa 3 mục). Chưa có dữ liệu hoặc tải lỗi thì dùng
// địa chỉ trong cấu hình cơ sở (nếu có); không có gì thì ẩn cột.

const MAX_FACILITIES = 3;
const STALE_MS = 10 * 60_000;

const externalUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

type Item = { key: string; name: string | null; address: string; mapUrl: string | null };

export function FooterFacilities({ fallbackAddress, fallbackMapUrl }: { fallbackAddress?: string | null; fallbackMapUrl?: string | null }) {
  const query = useQuery({
    queryKey: ["public-footer", "facilities"],
    queryFn: () => apiRequest<Facility[]>("/facilities"),
    staleTime: STALE_MS,
    retry: false,
  });

  const fromData: Item[] = (query.data ?? []).slice(0, MAX_FACILITIES).map((item) => ({ key: item.id, name: item.name, address: item.address, mapUrl: item.mapUrl }));
  const items: Item[] = fromData.length
    ? fromData
    : fallbackAddress?.trim()
      ? [{ key: "settings", name: null, address: fallbackAddress.trim(), mapUrl: fallbackMapUrl?.trim() || null }]
      : [];
  if (!items.length) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-white">Địa điểm khám</p>
      <ul className="mt-4 space-y-4 text-sm leading-6 text-white/80">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#7fe0cf]" aria-hidden="true" />
            <span>
              {item.name ? <strong className="block font-medium text-white">{item.name}</strong> : null}
              {item.address}
              {item.mapUrl ? (
                <a href={externalUrl(item.mapUrl)} target="_blank" rel="noreferrer" className="mt-1 block font-medium text-white underline underline-offset-4 hover:text-[#7fe0cf]">
                  Xem chỉ đường
                </a>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
