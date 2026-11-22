// Che thông tin liên hệ người dùng gõ vào khung chat trước khi lưu nhật ký và trước khi gửi cho dịch vụ AI bên ngoài.
// Chatbot không cần số điện thoại, email hay số giấy tờ để trả lời; phần đặt lịch có biểu mẫu riêng.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Số giấy tờ (CCCD 12 số, CMND 9 số) khi đứng riêng; làm trước số điện thoại để không bị cắt dở.
const ID_NUMBER = /(?<![\d])(?:\d{12}|\d{9})(?![\d])/g;
// Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84/84 xxxxxxxxx, cho phép cách, chấm, gạch ngang giữa các số.
const PHONE = /(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,9}(?![\d])/g;

export const maskPersonalData = (text: string) =>
  text.replace(EMAIL, "[email]").replace(PHONE, "[số điện thoại]").replace(ID_NUMBER, "[số giấy tờ]");
