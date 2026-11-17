import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Kiến thức sức khỏe",
  description: "Bài viết kiến thức sức khỏe do đội ngũ bác sĩ biên soạn và duyệt: dinh dưỡng, phòng bệnh, chăm sóc sức khỏe hằng ngày.",
  path: "/kien-thuc",
  keywords: ["kiến thức sức khỏe", "phòng bệnh", "dinh dưỡng", "chăm sóc sức khỏe"],
});

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
