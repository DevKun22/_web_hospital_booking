import { NextResponse } from "next/server";
import {
  clearPatientSessionCookies,
  getAuthorizedPatientRequest,
  patientErrorResponse,
  setPatientSessionCookies,
} from "@/lib/patient-session-server";

// Trợ lý Kun cho người khám ĐÃ đăng nhập trên web: token nằm trong cookie httpOnly nên trình duyệt không tự gắn được vào API;
// tuyến này gắn token (làm mới khi hết hạn) rồi chuyển tiếp nguyên văn tới /chatbot/message. Khách chưa đăng nhập gọi thẳng API
// (giới hạn tần suất theo IP của chính họ), không qua đây. Máy chủ chatbot tự xác định danh tính từ token, không tin body.

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const body = await request.text();
  if (!body || body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, message: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  const result = await getAuthorizedPatientRequest<unknown>("/chatbot/message", { method: "POST", body });
  if (!result.response.ok) {
    const response = patientErrorResponse(result.payload, result.response.status);
    // Phiên đăng nhập hết hạn hẳn: xóa cookie để giao diện chuyển về chế độ khách.
    if (result.response.status === 401) clearPatientSessionCookies(response);
    return response;
  }
  const response = NextResponse.json({ success: true, data: result.payload?.data ?? null });
  if (result.rotated) setPatientSessionCookies(response, result.rotated);
  return response;
}
