export class AppError extends Error {
  statusCode: number;
  code?: string;
  // Với lỗi cần chờ (429): số giây phải chờ, đưa vào thân phản hồi để giao diện đếm ngược.
  retryAfterSeconds?: number;

  constructor(message: string, statusCode = 400, code?: string, options: { retryAfterSeconds?: number } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
