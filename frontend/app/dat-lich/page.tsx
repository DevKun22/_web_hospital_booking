import { PublicBookingPageClient } from "@/components/public/public-booking-page-client";
import { loadPublicBootstrap } from "@/lib/public-bootstrap-server";

export const revalidate = 300;

export default async function BookingPage() {
  return <PublicBookingPageClient snapshot={await loadPublicBootstrap("full", 300)} />;
}
