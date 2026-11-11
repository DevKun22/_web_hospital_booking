import { NextResponse } from "next/server";
import { clearPatientSessionCookies, getAuthorizedPatientRawRequest, setPatientSessionCookies } from "@/lib/patient-session-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ recordId: string; labId: string }> }) {
  const { recordId, labId } = await params;
  if (!UUID.test(recordId) || !UUID.test(labId)) return NextResponse.json({ success: false, message: "Mã tệp không hợp lệ." }, { status: 400 });
  const result = await getAuthorizedPatientRawRequest(`/me/medical-records/${recordId}/lab-results/${labId}/file`);
  if (!result.response.ok) {
    const response = NextResponse.json({ success: false, message: result.response.status === 404 ? "Xét nghiệm chưa có tệp đính kèm." : "Không thể tải tệp xét nghiệm." }, { status: result.response.status });
    if (result.response.status === 401) clearPatientSessionCookies(response);
    return response;
  }
  const response = new NextResponse(result.response.body, { status: 200, headers: { "Content-Type": result.response.headers.get("content-type") || "application/octet-stream", "Content-Disposition": result.response.headers.get("content-disposition") || `inline; filename="lab-result-${labId}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  if (result.rotated) setPatientSessionCookies(response, result.rotated);
  return response;
}

