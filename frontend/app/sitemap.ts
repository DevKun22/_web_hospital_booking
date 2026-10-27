import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
};

type PublicDepartment = {
  slug: string | null;
  updatedAt?: string;
};

type PublicDoctor = {
  id: string;
  slug?: string;
  updatedAt?: string;
};

type PublicPackage = {
  slug: string | null;
  id: string;
  updatedAt?: string;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

const parseLastModified = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const route = (
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
  lastModified?: string,
): MetadataRoute.Sitemap[number] => ({
  url: `${SITE_URL}${path}`,
  changeFrequency,
  priority,
  lastModified: parseLastModified(lastModified),
});

async function fetchPublicData<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload.data || null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [departments, doctors, packages] = await Promise.all([
    fetchPublicData<PublicDepartment[]>("/departments"),
    fetchPublicData<PublicDoctor[]>("/doctors?seo=slug-v1"),
    fetchPublicData<PublicPackage[]>("/packages"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    route("/", "daily", 1),
    route("/departments", "weekly", 0.85),
    route("/bac-si", "weekly", 0.85),
    route("/packages", "weekly", 0.85),
    route("/faqs", "weekly", 0.7),
    route("/guide/booking", "monthly", 0.7),
  ];

  const departmentRoutes =
    departments
      ?.filter((item) => item.slug)
      .map((item) => route(`/departments/${encodeURIComponent(item.slug!)}`, "weekly", 0.75, item.updatedAt)) || [];

  const doctorRoutes = doctors?.map((item) => route(`/bac-si/${encodeURIComponent(item.slug || item.id)}`, "weekly", 0.65, item.updatedAt)) || [];

  const packageRoutes =
    packages?.map((item) => route(`/packages/${encodeURIComponent(item.slug || item.id)}`, "weekly", 0.75, item.updatedAt)) || [];

  return [
    ...staticRoutes,
    ...departmentRoutes,
    ...doctorRoutes,
    ...packageRoutes,
  ];
}
