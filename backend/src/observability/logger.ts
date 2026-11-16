// Bộ ghi log duy nhất của backend: một chỗ quyết định mức độ và định dạng thay vì rải `console` khắp nơi.
// Môi trường production ghi mỗi dòng một đối tượng JSON (dễ lọc theo level, message); môi trường khác giữ dạng văn bản như cũ.
// Mức tối thiểu đặt bằng biến LOG_LEVEL (debug, info, warn, error; mặc định info). Không import mã khác của dự án để tránh vòng phụ thuộc.

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = () => {
  const configured = (process.env.LOG_LEVEL || "").toLowerCase() as Level;
  return LEVELS[configured] ?? LEVELS.info;
};

const serialize = (value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

const write = (level: Level, args: unknown[]) => {
  if (LEVELS[level] < threshold()) return;
  const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (process.env.NODE_ENV !== "production") {
    output(...args);
    return;
  }
  const [first, ...details] = args;
  output(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message: typeof first === "string" ? first : serialize(first),
      ...(details.length > 0 ? { details: details.map(serialize) } : {}),
    }),
  );
};

export const logger = {
  debug: (...args: unknown[]) => write("debug", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
};
