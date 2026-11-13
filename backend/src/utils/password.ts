import argon2 from "argon2";
import bcrypt from "bcrypt";

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

// Mọi mật khẩu mới đều dùng Argon2id. bcrypt chỉ còn để xác thực hash cũ đã lưu sẵn.
export const hashPassword = async (password: string) =>
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

// Hash giả để thời gian phản hồi không lộ việc tài khoản có tồn tại hay không.
export const DUMMY_PASSWORD_HASH = await argon2.hash(
  "hospital-booking-invalid-password",
  ARGON2ID_OPTIONS,
);
