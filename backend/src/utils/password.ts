import argon2 from "argon2";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

export const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export type PasswordHashAlgorithm = "argon2id" | "bcrypt" | "unsupported";

export const getPasswordHashAlgorithm = (
  hashedPassword: string,
): PasswordHashAlgorithm => {
  if (hashedPassword.startsWith("$argon2id$")) return "argon2id";
  if (/^\$2[aby]\$/.test(hashedPassword)) return "bcrypt";
  return "unsupported";
};

// Giai đoạn tương thích: vẫn tạo bcrypt để phiên bản production trước đó có thể
// rollback và đọc mọi hash mới. Giai đoạn chuyển đổi sau sẽ đổi duy nhất hàm này.
export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const hashArgon2Password = async (password: string) =>
  argon2.hash(password, ARGON2ID_OPTIONS);

export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => {
  switch (getPasswordHashAlgorithm(hashedPassword)) {
    case "argon2id":
      return argon2.verify(hashedPassword, password);
    case "bcrypt":
      return bcrypt.compare(password, hashedPassword);
    default:
      return false;
  }
};

// Giữ cùng chi phí với bcrypt production trong giai đoạn chưa chuyển thuật toán
// mặc định, nhằm hạn chế suy đoán tài khoản qua chênh lệch thời gian phản hồi.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "hospital-booking-invalid-password",
  BCRYPT_ROUNDS,
);
